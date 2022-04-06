require('dotenv').config();

require('@nomiclabs/hardhat-etherscan');
require('@nomiclabs/hardhat-waffle');
require('hardhat-gas-reporter');
require('solidity-coverage');

task('rs', 'Reveal shell')
  .addParam('address', `Randomizer's address`)
  .addParam('id', `Shell's ID`)
  .addParam('timestamp', `Reveal request's timestamp`)
  .setAction(async (args) => {
    const [owner, revealer] = await ethers.getSigners();
    const randomizer = await ethers.getContractAt('Randomizer', args.address);
    const tx = await randomizer
      .connect(owner)
      .requestRevealForShell(
        args.id,
        await revealer.getAddress(),
        args.timestamp,
      );
    const receipt = await tx.wait();
    console.log(receipt.transactionHash);
  });

task('w', 'Withdraw LINK')
  .addParam('address', `Randomizer's address`)
  .addParam('to', `To's address`)
  .addParam('amount', `Amount`)
  .setAction(async (args) => {
    const [owner] = await ethers.getSigners();
    const randomizer = await ethers.getContractAt('Randomizer', args.address);
    const tx = await randomizer
      .connect(owner)
      .withdrawLINK(args.to, args.amount);
    const receipt = await tx.wait();
    console.log(receipt.transactionHash);
  });

module.exports = {
  solidity: {
    version: '0.8.9',
    settings: {
      optimizer: {
        enabled: true,
        runs: 10000,
      },
    },
  },
  networks: {
    mainnet: {
      url: process.env.MAINNET_RPC_URL,
      accounts: {
        mnemonic: process.env.MNEMONIC,
      },
    },
    rinkeby: {
      url: process.env.RINKEBY_RPC_URL,
      accounts: {
        mnemonic: process.env.MNEMONIC,
      },
    },
    polygon: {
      url: process.env.POLYGON_RPC_URL,
      accounts: {
        mnemonic: process.env.MNEMONIC,
      },
    },
    mumbai: {
      url: process.env.MUMBAI_RPC_URL,
      accounts: {
        mnemonic: process.env.MNEMONIC,
      },
    },
    hardhat: {
      forking: {
        url: process.env.MAINNET_RPC_URL,
        blockNumber: 14463387,
      },
    },
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS === '1',
    currency: 'USD',
    gasPrice: 100,
  },
  etherscan: {
    apiKey: {
      mainnet: process.env.MAINNET_ETHERSCAN_API_KEY,
      rinkeby: process.env.RINKEBY_ETHERSCAN_API_KEY,
      polygon: process.env.POLYGON_ETHERSCAN_API_KEY,
      polygonMumbai: process.env.MUMBAI_ETHERSCAN_API_KEY,
    },
  },
};
