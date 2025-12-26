import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

task("vote:address", "Prints the VoteShield address").setAction(async function (_taskArguments: TaskArguments, hre) {
  const { deployments } = hre;
  const voteShield = await deployments.get("VoteShield");
  console.log("VoteShield address is " + voteShield.address);
});

task("vote:create-poll", "Creates a new poll on VoteShield")
  .addParam("name", "Poll name")
  .addParam("options", "Comma-separated options (2-4)")
  .addParam("end", "Poll end time (unix seconds)")
  .addOptionalParam("address", "Optionally specify the VoteShield contract address")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments } = hre;

    const endTime = BigInt(taskArguments.end);
    const options = String(taskArguments.options)
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const deployment = taskArguments.address ? { address: taskArguments.address } : await deployments.get("VoteShield");
    const [signer] = await ethers.getSigners();
    const contract = await ethers.getContractAt("VoteShield", deployment.address, signer);

    const tx = await contract.createPoll(String(taskArguments.name), options, endTime);
    console.log(`Wait for tx:${tx.hash}...`);
    const receipt = await tx.wait();
    console.log(`tx:${tx.hash} status=${receipt?.status}`);
  });

task("vote:vote", "Casts an encrypted vote in a poll")
  .addParam("poll", "Poll id")
  .addParam("option", "Option index (0-based)")
  .addOptionalParam("address", "Optionally specify the VoteShield contract address")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments, fhevm } = hre;

    await fhevm.initializeCLIApi();

    const pollId = BigInt(taskArguments.poll);
    const optionIndex = Number(taskArguments.option);
    if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex > 3) {
      throw new Error(`Argument --option must be an integer between 0 and 3`);
    }

    const deployment = taskArguments.address ? { address: taskArguments.address } : await deployments.get("VoteShield");
    const [signer] = await ethers.getSigners();

    const encryptedChoice = await fhevm
      .createEncryptedInput(deployment.address, signer.address)
      .add8(optionIndex)
      .encrypt();

    const contract = await ethers.getContractAt("VoteShield", deployment.address, signer);
    const tx = await contract.vote(pollId, encryptedChoice.handles[0], encryptedChoice.inputProof);
    console.log(`Wait for tx:${tx.hash}...`);
    const receipt = await tx.wait();
    console.log(`tx:${tx.hash} status=${receipt?.status}`);
  });

task("vote:finalize", "Finalizes a poll and makes results publicly decryptable")
  .addParam("poll", "Poll id")
  .addOptionalParam("address", "Optionally specify the VoteShield contract address")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments } = hre;
    const pollId = BigInt(taskArguments.poll);
    const deployment = taskArguments.address ? { address: taskArguments.address } : await deployments.get("VoteShield");
    const [signer] = await ethers.getSigners();

    const contract = await ethers.getContractAt("VoteShield", deployment.address, signer);
    const tx = await contract.finalize(pollId);
    console.log(`Wait for tx:${tx.hash}...`);
    const receipt = await tx.wait();
    console.log(`tx:${tx.hash} status=${receipt?.status}`);
  });

task("vote:public-decrypt", "Publicly decrypts poll results (requires finalized poll)")
  .addParam("poll", "Poll id")
  .addOptionalParam("address", "Optionally specify the VoteShield contract address")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments } = hre;
    const pollId = BigInt(taskArguments.poll);
    const deployment = taskArguments.address ? { address: taskArguments.address } : await deployments.get("VoteShield");

    const contract = await ethers.getContractAt("VoteShield", deployment.address);
    const meta = await contract.getPollMeta(pollId);
    const optionsCount = Number(meta[2]);
    const finalized = Boolean(meta[4]);

    if (!finalized) {
      throw new Error(`Poll is not finalized yet`);
    }

    const relayer = await import("@zama-fhe/relayer-sdk/node");
    await relayer.initSDK();
    const instance = await relayer.createInstance(relayer.SepoliaConfig);

    const handles: string[] = [];
    for (let i = 0; i < optionsCount; i++) {
      const handle = (await contract.getEncryptedCount(pollId, i)) as string;
      handles.push(handle);
    }

    const result = await instance.publicDecrypt(handles);
    for (const handle of handles) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const value = (result as any).clearValues?.[handle];
      console.log(`${handle} => ${String(value)}`);
    }
  });
