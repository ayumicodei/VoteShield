# VoteShield

VoteShield is a confidential voting system on Ethereum Sepolia powered by Zama FHEVM. Ballots are encrypted on-chain, tallies remain encrypted during the voting window, and results become publicly decryptable only after the poll ends and is finalized.

## Project Goals

- Enable anyone to create a poll with 2 to 4 options and a clear end time.
- Preserve ballot secrecy while keeping the system on-chain and auditable.
- Prevent early result leakage or manipulation before the poll ends.
- Allow any user to finalize the poll once it is over, with no admin gate.
- Provide a production-grade developer workflow for deployment and front-end use.

## Problems Solved

- **Ballot secrecy on-chain**: Traditional on-chain voting exposes vote choices. VoteShield keeps votes encrypted at all times during the poll.
- **Result leakage**: Partial counts can influence voter behavior. VoteShield keeps tallies encrypted until the end.
- **Trust in tallying**: Results are computed by the contract in encrypted form, avoiding off-chain tallying or trusted parties.
- **Censorship resistance**: Any user can finalize the poll, so results cannot be held hostage by the creator.
- **Auditability**: The full process (poll creation, voting, finalization) is verifiable on-chain.

## Key Features

- **Poll creation**: Name, options (2-4), and end time are stored on-chain.
- **Encrypted voting**: Votes are submitted as FHE-encrypted inputs.
- **Encrypted tallies**: Counts are kept as encrypted euint32 values.
- **Finalization**: After end time, any user can finalize and enable public decryption.
- **Public decryption**: Anyone can decrypt results using the Zama relayer after finalization.
- **One vote per address**: Simple on-chain duplicate vote protection.

## Advantages

- **Strong privacy**: Votes remain confidential until the poll ends.
- **Trust-minimized**: No admin or centralized tallying service.
- **Transparent**: All actions are recorded on-chain with events.
- **Simple UX**: Users vote with their wallet without extra identity steps.
- **Composable**: The contract can be integrated into other dapps.

## Privacy and Security Model

- Votes are submitted as `externalEuint8` with Zama FHE proofs.
- The contract decrypts nothing during the poll and keeps encrypted counts.
- Finalization calls `makePubliclyDecryptable` so anyone can decrypt results.
- Each poll uses a fixed maximum of 4 encrypted counters.
- One vote per address is enforced via `hasVoted`.

Assumptions and limitations:
- Sybil resistance is not provided (one vote per address only).
- Poll end time uses `block.timestamp`, which has minor miner variance.
- Options are limited to 4 to match the fixed encrypted counter array.

## Architecture Overview

### Smart Contract (`contracts/`)
- **VoteShield.sol** manages polls, votes, and finalization.
- Core functions: `createPoll`, `vote`, `finalize`, `getPollMeta`, `getPollOptions`, `getEncryptedCount`.
- Events: `PollCreated`, `VoteCast`, `PollFinalized`.

### Frontend (`src/`)
- React + Vite UI with RainbowKit wallet onboarding.
- **Reads** use `viem`, **writes** use `ethers`.
- No frontend environment variables are used.
- No `localStorage` usage in the app.
- Do not import JSON files in the frontend; copy ABIs from `deployments/sepolia` into TS modules.

### Relayer Integration
- The Zama relayer SDK is used for public decryption after finalization.

## Tech Stack

- **Contracts**: Solidity 0.8.24, Zama FHEVM (`@fhevm/solidity`)
- **Framework**: Hardhat + hardhat-deploy
- **Frontend**: React + Vite
- **Wallet UX**: RainbowKit + wagmi
- **Reads**: viem
- **Writes**: ethers
- **Relayer**: `@zama-fhe/relayer-sdk`
- **Testing**: Mocha + Chai
- **Styling**: Vanilla CSS (no Tailwind)

## Repository Structure

```
.
├── contracts/                 # VoteShield smart contract
├── deploy/                    # Deployment scripts
├── tasks/                     # Hardhat tasks (VoteShield + utilities)
├── test/                      # Contract tests
├── deployments/sepolia/       # Deployed ABI + address for frontend
├── src/                       # React + Vite frontend
├── hardhat.config.ts          # Hardhat configuration
└── README.md
```

## Setup and Installation

### Prerequisites

- Node.js 20+
- npm 7+

### Install Dependencies

From repo root:

```bash
npm install
```

From frontend:

```bash
cd src
npm install
```

## Configuration

### Hardhat and Deployment (.env at repo root)

Set these variables:

- `PRIVATE_KEY` (required, private key only; do not use a mnemonic)
- `INFURA_API_KEY` (required for Sepolia RPC)
- `ETHERSCAN_API_KEY` (optional for contract verification)

### Frontend

- No environment variables are used in the frontend.
- Contract address and ABI are taken from `deployments/sepolia` and copied into TS files.
- Do not configure the frontend to use a localhost RPC; use Sepolia.

## Development Workflow

### 1) Compile and Test

```bash
npm run compile
npm run test
```

### 2) Start a Local Node and Deploy (Contracts Only)

```bash
npm run chain
npm run deploy:localhost
```

### 3) Run Tasks (Local or Sepolia)

VoteShield tasks:

```bash
npx hardhat vote:address --network sepolia
npx hardhat vote:create-poll --network sepolia --name "My Poll" --options "A,B,C" --end 1735689600
npx hardhat vote:vote --network sepolia --poll 1 --option 0
npx hardhat vote:finalize --network sepolia --poll 1
npx hardhat vote:public-decrypt --network sepolia --poll 1
```

Frontend sync task:

```bash
npx hardhat sync:frontend
```

### 4) Deploy to Sepolia

```bash
npm run deploy:sepolia
```

Optional verification:

```bash
npm run verify:sepolia -- <CONTRACT_ADDRESS>
```

## Frontend Usage

From the `src/` folder:

```bash
npm run dev
```

The UI allows users to:
- Create a poll with 2-4 options and an end time.
- Vote privately with encrypted inputs.
- Finalize polls after the end time.
- View decrypted results after finalization.

## Contract Data Model (Summary)

- **Poll**: `name`, `options[]`, `endTime`, `creator`, `optionsCount`, `finalized`, `encryptedCounts[4]`
- **pollCount**: total polls created
- **hasVoted[pollId][voter]**: prevents double voting

## Operational Notes

- Anyone can finalize a poll after its end time.
- Results are only publicly decryptable after finalization.
- Encrypted counts are stored as `euint32` with FHE permissions configured by the contract.

## Limitations

- One vote per address; no identity verification.
- No vote updates or revotes.
- Options capped at 4.
- No partial results before finalization.

## Future Roadmap

- Expand option count with dynamic encrypted arrays.
- Add optional quorum and participation thresholds.
- Add support for multi-round or ranked-choice voting.
- Improve UI for large numbers of polls and pagination.
- Add analytics for poll participation after results are public.
- Extend deployment to additional networks once FHEVM support is available.
- Add more comprehensive integration tests for end-to-end flows.

## License

BSD-3-Clause-Clear. See `LICENSE`.
