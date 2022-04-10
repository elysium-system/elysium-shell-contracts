const { CODE } = process.env;

(async () => {
  const Shell = await ethers.getContractFactory('Shell');
  const shell = await Shell.deploy(CODE);
  await shell.deployed();

  console.log(`Shell deployed to ${shell.address}`);
})();
