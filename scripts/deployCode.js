const { EM } = process.env;

(async () => {
  const Code = await ethers.getContractFactory('Code');
  const code = await Code.deploy(EM);
  await code.deployed();

  console.log(`Code deployed to ${code.address}`);
})();
