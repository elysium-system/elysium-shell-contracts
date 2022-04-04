(async () => {
  const Randomizer = await ethers.getContractFactory('Randomizer');
  const randomizer = await Randomizer.deploy();
  await randomizer.deployed();

  console.log(`Deployed at ${randomizer.address}`);
})();
