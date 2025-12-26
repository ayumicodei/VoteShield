import { useMemo, useState } from 'react';
import { Contract } from 'ethers';
import { useAccount } from 'wagmi';
import { useEthersSigner } from '../hooks/useEthersSigner';
import { CONTRACT_ABI, CONTRACT_ADDRESS, isContractConfigured } from '../config/contracts';
import '../styles/CreatePoll.css';

type Props = {
  disabled?: boolean;
};

export function CreatePoll({ disabled }: Props) {
  const { address } = useAccount();
  const signerPromise = useEthersSigner();

  const [name, setName] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [endDateTime, setEndDateTime] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txHash, setTxHash] = useState<string>('');
  const [error, setError] = useState<string>('');

  const canAddOption = options.length < 4;
  const canRemoveOption = options.length > 2;

  const endTimestamp = useMemo(() => {
    if (!endDateTime) return null;
    const ms = new Date(endDateTime).getTime();
    if (!Number.isFinite(ms)) return null;
    return Math.floor(ms / 1000);
  }, [endDateTime]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setTxHash('');

    if (!isContractConfigured()) {
      setError('Contract is not configured. Deploy to Sepolia and run `npx hardhat sync:frontend`.');
      return;
    }
    if (disabled || !address) {
      setError('Wallet not connected.');
      return;
    }
    if (!signerPromise) {
      setError('Signer not available.');
      return;
    }

    const trimmedName = name.trim();
    const trimmedOptions = options.map((o) => o.trim()).filter((o) => o.length > 0);
    if (!trimmedName) {
      setError('Poll name is required.');
      return;
    }
    if (trimmedOptions.length < 2 || trimmedOptions.length > 4) {
      setError('Poll must have 2 to 4 non-empty options.');
      return;
    }
    if (!endTimestamp) {
      setError('Poll end time is required.');
      return;
    }
    if (endTimestamp <= Math.floor(Date.now() / 1000)) {
      setError('Poll end time must be in the future.');
      return;
    }

    setIsSubmitting(true);
    try {
      const signer = await signerPromise;
      if (!signer) throw new Error('Signer not available');

      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      const tx = await contract.createPoll(trimmedName, trimmedOptions, BigInt(endTimestamp));
      setTxHash(tx.hash as string);
      await tx.wait();

      setName('');
      setOptions(['', '']);
      setEndDateTime('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="create-poll">
      <div className="vote-card">
        <h2 className="vote-card-title">Create a poll</h2>
        <p className="vote-muted">
          Ballots are encrypted with Zama FHE. Results can only be publicly decrypted after the poll is finalized.
        </p>

        <form onSubmit={submit} className="create-form">
          <label className="field">
            <span className="label">Name</span>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Best programming language"
              disabled={disabled || isSubmitting}
            />
          </label>

          <div className="field">
            <span className="label">Options (2–4)</span>
            <div className="options">
              {options.map((value, i) => (
                <div key={i} className="option-row">
                  <input
                    className="input"
                    value={value}
                    onChange={(e) => {
                      const next = options.slice();
                      next[i] = e.target.value;
                      setOptions(next);
                    }}
                    placeholder={`Option ${i + 1}`}
                    disabled={disabled || isSubmitting}
                  />
                  {canRemoveOption ? (
                    <button
                      type="button"
                      className="small-button danger"
                      onClick={() => setOptions(options.filter((_, idx) => idx !== i))}
                      disabled={disabled || isSubmitting}
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
            <div className="option-actions">
              <button
                type="button"
                className="small-button"
                onClick={() => setOptions([...options, ''])}
                disabled={disabled || isSubmitting || !canAddOption}
              >
                Add option
              </button>
            </div>
          </div>

          <label className="field">
            <span className="label">End time</span>
            <input
              className="input"
              type="datetime-local"
              value={endDateTime}
              onChange={(e) => setEndDateTime(e.target.value)}
              disabled={disabled || isSubmitting}
            />
          </label>

          {error ? <div className="alert error">{error}</div> : null}
          {txHash ? (
            <div className="alert">
              Transaction submitted: <span className="mono">{txHash}</span>
            </div>
          ) : null}

          <button type="submit" className="primary-button" disabled={disabled || isSubmitting}>
            {isSubmitting ? 'Submitting…' : 'Create poll'}
          </button>
        </form>
      </div>
    </section>
  );
}

