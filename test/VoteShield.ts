import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import { FhevmType } from "@fhevm/hardhat-plugin";
import type { VoteShield, VoteShield__factory } from "../types";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
};

async function deployFixture() {
  const factory = (await ethers.getContractFactory("VoteShield")) as unknown as VoteShield__factory;
  const contract = (await factory.deploy()) as unknown as VoteShield;
  const address = await contract.getAddress();
  return { contract, address };
}

async function decryptEuint32(handle: string, contractAddress: string, signer: HardhatEthersSigner): Promise<bigint> {
  const fhevmAny = fhevm as any;
  if (typeof fhevmAny.publicDecryptEuint === "function") {
    return await fhevmAny.publicDecryptEuint(FhevmType.euint32, handle);
  }

  return await fhevm.userDecryptEuint(FhevmType.euint32, handle, contractAddress, signer);
}

describe("VoteShield", function () {
  let signers: Signers;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { deployer: ethSigners[0], alice: ethSigners[1], bob: ethSigners[2] };
  });

  it("creates a poll, collects encrypted votes, and publishes results after finalization", async function () {
    if (!fhevm.isMock) {
      console.warn(`This hardhat test suite cannot run on Sepolia Testnet`);
      this.skip();
    }

    const { contract, address } = await deployFixture();

    const now = await time.latest();
    const endTime = BigInt(now + 60);

    const createTx = await contract
      .connect(signers.alice)
      .createPoll("Best language", ["Solidity", "Rust", "TypeScript"], endTime);
    await createTx.wait();

    const pollId = 1n;

    const encChoice1 = await fhevm.createEncryptedInput(address, signers.alice.address).add8(1).encrypt();
    const vote1 = await contract.connect(signers.alice).vote(pollId, encChoice1.handles[0], encChoice1.inputProof);
    await vote1.wait();

    const encChoice2 = await fhevm.createEncryptedInput(address, signers.bob.address).add8(2).encrypt();
    const vote2 = await contract.connect(signers.bob).vote(pollId, encChoice2.handles[0], encChoice2.inputProof);
    await vote2.wait();

    const meta = await contract.getPollMeta(pollId);
    expect(meta[0]).to.eq("Best language");
    expect(Number(meta[2])).to.eq(3);
    expect(Boolean(meta[4])).to.eq(false);

    await time.increaseTo(Number(endTime));

    const finalizeTx = await contract.connect(signers.bob).finalize(pollId);
    await finalizeTx.wait();

    const count0 = await contract.getEncryptedCount(pollId, 0);
    const count1 = await contract.getEncryptedCount(pollId, 1);
    const count2 = await contract.getEncryptedCount(pollId, 2);

    const clear0 = await decryptEuint32(count0 as unknown as string, address, signers.alice);
    const clear1 = await decryptEuint32(count1 as unknown as string, address, signers.alice);
    const clear2 = await decryptEuint32(count2 as unknown as string, address, signers.alice);

    expect(clear0).to.eq(0n);
    expect(clear1).to.eq(1n);
    expect(clear2).to.eq(1n);
  });
});
