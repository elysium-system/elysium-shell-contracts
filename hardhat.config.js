require('dotenv').config();

require('@nomiclabs/hardhat-etherscan');
require('@nomiclabs/hardhat-waffle');
require('hardhat-gas-reporter');
require('solidity-coverage');

const axios = require('axios').default;

const { CODE, RANDOMIZER, API_URL = 'http://localhost:3000' } = process.env;

task('setPreSaleMintTime', 'Set pre sale mint time')
  .addOptionalParam('address', `Code's address`, CODE)
  .addParam('start', `Start time`)
  .addParam('end', `End time`)
  .setAction(async (args) => {
    const [owner] = await ethers.getSigners();
    const code = await ethers.getContractAt('Code', args.address);
    const tx = await code
      .connect(owner)
      .setPreSaleMintTime(args.start, args.end);
    const receipt = await tx.wait();
    console.log(receipt.transactionHash);
  });

task('setPublicSaleMintTime', 'Set public sale mint time')
  .addOptionalParam('address', `Code's address`, CODE)
  .addParam('start', `Start time`)
  .addParam('end', `End time`)
  .setAction(async (args) => {
    const [owner] = await ethers.getSigners();
    const code = await ethers.getContractAt('Code', args.address);
    const tx = await code
      .connect(owner)
      .setPublicSaleMintTime(args.start, args.end);
    const receipt = await tx.wait();
    console.log(receipt.transactionHash);
  });

task('publicSaleMint', 'Public sale mint')
  .addOptionalParam('address', `Code's address`, CODE)
  .addOptionalParam('index', `Account's index`, 0, types.int)
  .addParam('quantity', `Quantity`)
  .setAction(async (args) => {
    const [, ...accounts] = await ethers.getSigners();
    const accountAddrs = await Promise.all(
      accounts.map((account) => account.getAddress()),
    );
    const res = await axios.get(
      `${API_URL}/public/${accountAddrs[args.index]}`,
    );
    const { ticket, signature } = res.data;
    const code = await ethers.getContractAt('Code', args.address);
    const PRICE_PER_TOKEN = await code.PRICE_PER_TOKEN();
    const tx = await code
      .connect(accounts[args.index])
      .publicSaleMint(args.quantity, ticket, signature, {
        value: PRICE_PER_TOKEN.mul(args.quantity),
      });
    const receipt = await tx.wait();
    console.log(receipt.transactionHash);
  });

task('reveal', 'Reveal shell')
  .addOptionalParam('address', `Randomizer's address`, RANDOMIZER)
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

task('withdrawLINK', 'Withdraw LINK')
  .addOptionalParam('address', `Randomizer's address`, RANDOMIZER)
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
