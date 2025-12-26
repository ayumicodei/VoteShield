import { useMemo, useState } from 'react';
import { useReadContract } from 'wagmi';
import { CONTRACT_ABI, CONTRACT_ADDRESS, isContractConfigured } from '../config/contracts';
import { useZamaInstance } from '../hooks/useZamaInstance';
import { useEthersSigner } from '../hooks/useEthersSigner';
import { PollCard } from './PollCard';
import '../styles/Polls.css';

export function Polls() {
  const signerPromise = useEthersSigner();
  const { instance, isLoading: zamaLoading, error: zamaError } = useZamaInstance();

  const [visible, setVisible] = useState(10);
  const configured = isContractConfigured();

  const { data: pollCountData, isLoading } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'pollCount',
    query: { enabled: configured, refetchInterval: 10_000 },
  });

  const pollCount = useMemo(() => Number(pollCountData ?? 0n), [pollCountData]);
  const ids = useMemo(() => {
    const n = Math.min(pollCount, visible);
    return Array.from({ length: n }, (_, i) => BigInt(i + 1)).reverse();
  }, [pollCount, visible]);

  if (!configured) {
    return (
      <div className="vote-card">
        <h2 className="vote-card-title">Contract not configured</h2>
        <p className="vote-muted">
          Deploy `VoteShield` to Sepolia, then run `npx hardhat sync:frontend` to copy the deployed address + ABI into the
          frontend.
        </p>
      </div>
    );
  }

  return (
    <section className="polls">
      <div className="polls-header">
        <h2 className="polls-title">Polls</h2>
        <div className="polls-meta">
          <span className="vote-muted">{isLoading ? 'Loading…' : `${pollCount} total`}</span>
          {zamaLoading ? <span className="vote-muted">Encryption service: loading…</span> : null}
          {zamaError ? <span className="vote-muted">Encryption service: {zamaError}</span> : null}
        </div>
      </div>

      <div className="polls-grid">
        {ids.map((id) => (
          <PollCard
            key={id.toString()}
            pollId={id}
            signerPromise={signerPromise}
            zamaInstance={instance}
            zamaLoading={zamaLoading}
          />
        ))}
      </div>

      {pollCount > visible ? (
        <div className="polls-actions">
          <button className="small-button" type="button" onClick={() => setVisible((v) => v + 10)}>
            Load more
          </button>
        </div>
      ) : null}
    </section>
  );
}

