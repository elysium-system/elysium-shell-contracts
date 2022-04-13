const { EM } = process.env;

(async () => {
  const [owner] = await ethers.getSigners();

  const Code = await ethers.getContractFactory('Code');
  const code = await Code.deploy(EM);
  await code.deployed();

  console.log(`Code deployed to ${code.address}`);

  const Shell = await ethers.getContractFactory('Shell');
  const shell = await Shell.deploy();
  await shell.deployed();

  console.log(`Shell deployed to ${shell.address}`);

  let receipt;

  receipt = await (
    await code.connect(owner).setPreSaleMintTime(0, 10000000000)
  ).wait();

  console.log(`Code: Pre sale mint time set: ${receipt.transactionHash}`);

  receipt = await (
    await code.connect(owner).setPublicSaleMintTime(0, 10000000000)
  ).wait();

  console.log(`Code: Public sale mint time set: ${receipt.transactionHash}`);

  receipt = await (await code.connect(owner).setShell(shell.address)).wait();

  console.log(`Code: Shell set: ${receipt.transactionHash}`);

  receipt = await (
    await code.connect(owner).setMigrationTime(0, 10000000000)
  ).wait();

  console.log(`Code: Migration time set: ${receipt.transactionHash}`);

  receipt = await (
    await shell.connect(owner).setAuthorized(code.address, true)
  ).wait();

  console.log(`Shell: Authorized set: ${receipt.transactionHash}`);
})();
