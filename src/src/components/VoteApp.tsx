import { useState } from 'react';
import { useAccount } from 'wagmi';
import { Header } from './Header';
import { CreatePoll } from './CreatePoll';
import { Polls } from './Polls';
import '../styles/VoteApp.css';

export function VoteApp() {
  const [activeTab, setActiveTab] = useState<'polls' | 'create'>('polls');
  const { address } = useAccount();

  return (
    <div className="vote-app">
      <Header />
      <main className="vote-main">
        <div className="vote-tabs">
          <button
            onClick={() => setActiveTab('polls')}
            className={`vote-tab ${activeTab === 'polls' ? 'active' : ''}`}
            type="button"
          >
            Polls
          </button>
          <button
            onClick={() => setActiveTab('create')}
            className={`vote-tab ${activeTab === 'create' ? 'active' : ''}`}
            type="button"
          >
            Create
          </button>
        </div>

        {activeTab === 'create' && !address ? (
          <div className="vote-card">
            <h2 className="vote-card-title">Connect your wallet</h2>
            <p className="vote-muted">Creating polls and voting requires a connected wallet on Sepolia.</p>
          </div>
        ) : null}

        {activeTab === 'create' ? <CreatePoll disabled={!address} /> : null}
        {activeTab === 'polls' ? <Polls /> : null}
      </main>
    </div>
  );
}

