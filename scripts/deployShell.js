(async () => {
  const Shell = await ethers.getContractFactory('Shell');
  const shell = await Shell.deploy();
  await shell.deployed();

  console.log(`Shell deployed to ${shell.address}`);
})();
