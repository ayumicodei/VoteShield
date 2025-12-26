import { useMemo, useState } from 'react';
import { Contract } from 'ethers';
import { useAccount, usePublicClient, useReadContract } from 'wagmi';
import { CONTRACT_ABI, CONTRACT_ADDRESS } from '../config/contracts';
import '../styles/PollCard.css';

type Props = {
  pollId: bigint;
  signerPromise: Promise<any> | undefined;
  zamaInstance: any;
  zamaLoading: boolean;
};

function formatTime(seconds: bigint): string {
  const ms = Number(seconds) * 1000;
  if (!Number.isFinite(ms)) return '';
  return new Date(ms).toLocaleString();
}

export function PollCard({ pollId, signerPromise, zamaInstance, zamaLoading }: Props) {
  const { address } = useAccount();
  const publicClient = usePublicClient();

  const [txHash, setTxHash] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isActing, setIsActing] = useState(false);
  const [decryptedCounts, setDecryptedCounts] = useState<bigint[] | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);

  const metaQuery = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'getPollMeta',
    args: [pollId],
    query: { refetchInterval: 10_000 },
  });

  const optionsQuery = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'getPollOptions',
    args: [pollId],
    query: { refetchInterval: 30_000 },
  });

  const votedQuery = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'hasVoted',
    args: address ? [pollId, address] : undefined,
    query: { enabled: !!address, refetchInterval: 10_000 },
  });

  const meta = metaQuery.data as unknown as readonly [string, bigint, bigint, string, boolean] | undefined;
  const name = meta?.[0] ?? '';
  const endTime = meta?.[1] ?? 0n;
  const optionsCount = meta ? Number(meta[2]) : 0;
  const creator = meta?.[3] ?? '';
  const finalized = meta?.[4] ?? false;

  const options = (optionsQuery.data as unknown as string[] | undefined) ?? [];
  const hasVoted = Boolean(votedQuery.data);

  const isEnded = useMemo(() => {
    if (!endTime) return false;
    return Math.floor(Date.now() / 1000) >= Number(endTime);
  }, [endTime]);

  const status = finalized ? 'Finalized' : isEnded ? 'Ended' : 'Active';

  const act = async (fn: () => Promise<void>) => {
    setError('');
    setTxHash('');
    setIsActing(true);
    try {
      await fn();
      await Promise.all([metaQuery.refetch(), votedQuery.refetch()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsActing(false);
    }
  };

  const vote = async (optionIndex: number) => {
    if (!address) throw new Error('Wallet not connected');
    if (!signerPromise) throw new Error('Signer not available');
    if (!zamaInstance) throw new Error('Encryption service not ready');

    const signer = await signerPromise;
    if (!signer) throw new Error('Signer not available');

    const input = zamaInstance.createEncryptedInput(CONTRACT_ADDRESS, address);
    input.add8(BigInt(optionIndex));
    const encrypted = await input.encrypt();

    const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
    const tx = await contract.vote(pollId, encrypted.handles[0], encrypted.inputProof);
    setTxHash(tx.hash as string);
    await tx.wait();
  };

  const finalize = async () => {
    if (!signerPromise) throw new Error('Signer not available');
    const signer = await signerPromise;
    if (!signer) throw new Error('Signer not available');
    const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
    const tx = await contract.finalize(pollId);
    setTxHash(tx.hash as string);
    await tx.wait();
  };

  const decryptResults = async () => {
    if (!zamaInstance) throw new Error('Encryption service not ready');
    if (!publicClient) throw new Error('Public client not available');
    if (!finalized) throw new Error('Poll is not finalized');

    setIsDecrypting(true);
    setError('');
    try {
      const handles = await Promise.all(
        Array.from({ length: optionsCount }, (_, i) =>
          publicClient.readContract({
            address: CONTRACT_ADDRESS,
            abi: CONTRACT_ABI,
            functionName: 'getEncryptedCount',
            args: [pollId, i],
          }),
        ),
      );

      const result = await zamaInstance.publicDecrypt(handles as string[]);
      const clear = handles.map((h) => {
        const v = (result?.clearValues?.[h as string] ?? 0n) as bigint;
        return BigInt(v);
      });
      setDecryptedCounts(clear);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsDecrypting(false);
    }
  };

  return (
    <article className="poll-card">
      <div className="poll-top">
        <div>
          <div className="poll-title-row">
            <h3 className="poll-title">{name ? name : `Poll #${pollId}`}</h3>
            <span className={`poll-badge ${status.toLowerCase()}`}>{status}</span>
          </div>
          <div className="poll-meta">
            <span className="vote-muted">Ends: {endTime ? formatTime(endTime) : '—'}</span>
            <span className="vote-muted">Creator: {creator ? `${creator.slice(0, 6)}…${creator.slice(-4)}` : '—'}</span>
          </div>
        </div>
      </div>

      <div className="poll-options">
        {options.slice(0, optionsCount).map((opt, idx) => (
          <button
            key={idx}
            type="button"
            className="option-button"
            disabled={isActing || zamaLoading || !address || hasVoted || finalized || isEnded}
            onClick={() => act(() => vote(idx))}
            title={!address ? 'Connect wallet' : hasVoted ? 'Already voted' : finalized ? 'Finalized' : isEnded ? 'Ended' : ''}
          >
            <span className="option-label">{opt || `Option ${idx + 1}`}</span>
            {hasVoted ? <span className="option-right">Voted</span> : null}
          </button>
        ))}
      </div>

      <div className="poll-actions">
        {!finalized && isEnded ? (
          <button className="primary-button" type="button" onClick={() => act(finalize)} disabled={isActing || !address}>
            Finalize
          </button>
        ) : null}
        {finalized ? (
          <button
            className="small-button"
            type="button"
            onClick={decryptResults}
            disabled={isDecrypting || zamaLoading || !zamaInstance}
          >
            {isDecrypting ? 'Decrypting…' : decryptedCounts ? 'Refresh results' : 'Decrypt results'}
          </button>
        ) : null}
      </div>

      {decryptedCounts ? (
        <div className="results">
          <h4 className="results-title">Results</h4>
          <ul className="results-list">
            {options.slice(0, optionsCount).map((opt, idx) => (
              <li key={idx} className="results-item">
                <span className="results-option">{opt || `Option ${idx + 1}`}</span>
                <span className="results-count">{String(decryptedCounts[idx] ?? 0n)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {error ? <div className="alert error">{error}</div> : null}
      {txHash ? (
        <div className="alert">
          Transaction: <span className="mono">{txHash}</span>
        </div>
      ) : null}
    </article>
  );
}
