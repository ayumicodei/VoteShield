// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, ebool, euint8, euint32, externalEuint8} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title VoteShield
/// @notice Confidential voting with encrypted ballots and publicly-decryptable results after the poll ends.
contract VoteShield is ZamaEthereumConfig {
    struct Poll {
        string name;
        string[] options;
        uint64 endTime;
        address creator;
        uint8 optionsCount;
        bool finalized;
        euint32[4] encryptedCounts;
    }

    uint256 public pollCount;
    mapping(uint256 => Poll) private _polls;
    mapping(uint256 => mapping(address => bool)) public hasVoted;

    event PollCreated(uint256 indexed pollId, address indexed creator, uint64 endTime, uint8 optionsCount);
    event VoteCast(uint256 indexed pollId, address indexed voter);
    event PollFinalized(uint256 indexed pollId, address indexed finalizer);

    error PollNotFound(uint256 pollId);
    error InvalidOptionsCount();
    error InvalidOptionIndex();
    error InvalidEndTime();
    error PollEnded();
    error PollNotEnded();
    error PollAlreadyFinalized();
    error AlreadyVoted();

    function createPoll(string calldata name, string[] calldata options, uint64 endTime) external returns (uint256 pollId) {
        uint256 optionsLength = options.length;
        if (optionsLength < 2 || optionsLength > 4) revert InvalidOptionsCount();
        if (endTime <= block.timestamp) revert InvalidEndTime();

        pollId = ++pollCount;

        Poll storage poll = _polls[pollId];
        poll.name = name;
        poll.endTime = endTime;
        poll.creator = msg.sender;
        poll.optionsCount = uint8(optionsLength);

        for (uint256 i = 0; i < optionsLength; i++) {
            poll.options.push(options[i]);
        }

        for (uint256 i = 0; i < 4; i++) {
            poll.encryptedCounts[i] = FHE.asEuint32(0);
            FHE.allowThis(poll.encryptedCounts[i]);
        }

        emit PollCreated(pollId, msg.sender, endTime, uint8(optionsLength));
    }

    function vote(uint256 pollId, externalEuint8 encryptedChoice, bytes calldata inputProof) external {
        Poll storage poll = _getPollOrRevert(pollId);
        if (poll.finalized) revert PollAlreadyFinalized();
        if (block.timestamp >= poll.endTime) revert PollEnded();
        if (hasVoted[pollId][msg.sender]) revert AlreadyVoted();

        hasVoted[pollId][msg.sender] = true;

        euint8 choice = FHE.fromExternal(encryptedChoice, inputProof);

        for (uint8 i = 0; i < poll.optionsCount; i++) {
            ebool isSelected = FHE.eq(choice, FHE.asEuint8(i));
            euint32 increment = FHE.select(isSelected, FHE.asEuint32(1), FHE.asEuint32(0));
            poll.encryptedCounts[i] = FHE.add(poll.encryptedCounts[i], increment);
            FHE.allowThis(poll.encryptedCounts[i]);
        }

        emit VoteCast(pollId, msg.sender);
    }

    function finalize(uint256 pollId) external {
        Poll storage poll = _getPollOrRevert(pollId);
        if (poll.finalized) revert PollAlreadyFinalized();
        if (block.timestamp < poll.endTime) revert PollNotEnded();

        poll.finalized = true;

        for (uint8 i = 0; i < poll.optionsCount; i++) {
            FHE.makePubliclyDecryptable(poll.encryptedCounts[i]);
        }

        emit PollFinalized(pollId, msg.sender);
    }

    function getPollMeta(
        uint256 pollId
    )
        external
        view
        returns (string memory name, uint64 endTime, uint8 optionsCount, address creator, bool finalized)
    {
        Poll storage poll = _getPollOrRevert(pollId);
        return (poll.name, poll.endTime, poll.optionsCount, poll.creator, poll.finalized);
    }

    function getPollOptions(uint256 pollId) external view returns (string[] memory options) {
        Poll storage poll = _getPollOrRevert(pollId);
        uint256 n = poll.options.length;
        options = new string[](n);
        for (uint256 i = 0; i < n; i++) {
            options[i] = poll.options[i];
        }
    }

    function getEncryptedCount(uint256 pollId, uint8 optionIndex) external view returns (euint32) {
        Poll storage poll = _getPollOrRevert(pollId);
        if (optionIndex >= poll.optionsCount) revert InvalidOptionIndex();
        return poll.encryptedCounts[optionIndex];
    }

    function _getPollOrRevert(uint256 pollId) private view returns (Poll storage poll) {
        poll = _polls[pollId];
        if (poll.endTime == 0) revert PollNotFound(pollId);
    }
}
