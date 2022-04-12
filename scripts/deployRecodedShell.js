(async () => {
  const RecodedShell = await ethers.getContractFactory('RecodedShell');
  const recodedShell = await RecodedShell.deploy();
  await recodedShell.deployed();

  console.log(`RecodedShell deployed to ${recodedShell.address}`);
})();
