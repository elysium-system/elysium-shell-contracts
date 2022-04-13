(async () => {
  const ShellRandomizer = await ethers.getContractFactory('ShellRandomizer');
  const shellRandomizer = await ShellRandomizer.deploy();
  await shellRandomizer.deployed();

  console.log(`ShellRandomizer deployed to ${shellRandomizer.address}`);
})();
