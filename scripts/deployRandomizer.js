(async () => {
  const Randomizer = await ethers.getContractFactory('Randomizer');
  const randomizer = await Randomizer.deploy();
  await randomizer.deployed();

  console.log(`Randomizer deployed to ${randomizer.address}`);
})();
