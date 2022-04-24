require('dotenv').config();

require('@nomiclabs/hardhat-etherscan');
require('@nomiclabs/hardhat-waffle');
require('hardhat-gas-reporter');
require('solidity-coverage');

const axios = require('axios').default;

const {
  CODE,
  ESHELL,
  SHELL_RANDOMIZER,
  API_URL = 'http://localhost:3000',
} = process.env;

task('totalNumMintedTokens', 'Total # of minted tokens')
  .addOptionalParam('address', `Code's address`, CODE)
  .setAction(async (args) => {
    const code = await ethers.getContractAt('Code', args.address);
    console.log((await code.totalNumMintedTokens()).toString());
  });

task('preSaleMaxTotalSupply', 'Max total supply of pre sale')
  .addOptionalParam('address', `Code's address`, CODE)
  .setAction(async (args) => {
    const code = await ethers.getContractAt('Code', args.address);
    console.log((await code.PRE_SALE_MAX_TOTAL_SUPPLY()).toString());
  });

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

task('setMigrationTime', 'Set migration time')
  .addOptionalParam('address', `Code's address`, CODE)
  .addParam('start', `Start time`)
  .addParam('end', `End time`)
  .setAction(async (args) => {
    const [owner] = await ethers.getSigners();
    const code = await ethers.getContractAt('Code', args.address);
    const tx = await code.connect(owner).setMigrationTime(args.start, args.end);
    const receipt = await tx.wait();
    console.log(receipt.transactionHash);
  });

task('setShell', 'Set shell')
  .addOptionalParam('address', `Code's address`, CODE)
  .addOptionalParam('eshell', `Shell's address`, ESHELL)
  .setAction(async (args) => {
    const [owner] = await ethers.getSigners();
    const code = await ethers.getContractAt('Code', args.address);
    const tx = await code.connect(owner).setShell(args.eshell);
    const receipt = await tx.wait();
    console.log(receipt.transactionHash);
  });

task('shell__setAuthorized', 'Set authorized for shell')
  .addOptionalParam('address', `Shell's address`, ESHELL)
  .addOptionalParam('authorized', `Address to authorize`, CODE)
  .setAction(async (args) => {
    const [owner] = await ethers.getSigners();
    const code = await ethers.getContractAt('Shell', args.address);
    const tx = await code.connect(owner).setAuthorized(args.authorized, true);
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

task('migrate', 'Migrate code to shell')
  .addOptionalParam('address', `Code's address`, CODE)
  .addOptionalParam('index', `Account's index`, 0, types.int)
  .addParam('ids', `Codes' IDs`)
  .addParam('quantities', `Codes' quantities`)
  .setAction(async (args) => {
    const [, ...accounts] = await ethers.getSigners();
    const code = await ethers.getContractAt('Code', args.address);
    const tx = await code
      .connect(accounts[args.index])
      .migrate(JSON.parse(args.ids), JSON.parse(args.quantities));
    const receipt = await tx.wait();
    console.log(receipt.transactionHash);
  });

task('withdraw', 'Withdraw')
  .addOptionalParam('address', `Code's address`, CODE)
  .addParam('to', `To's address`)
  .addParam('amount', `Amount`)
  .setAction(async (args) => {
    const [owner] = await ethers.getSigners();
    const code = await ethers.getContractAt('Code', args.address);
    const tx = await code.connect(owner).withdraw(args.to, args.amount);
    const receipt = await tx.wait();
    console.log(receipt.transactionHash);
  });

task('shellRandomizer__tokenIdToMetadataId', 'Shell metadata ID')
  .addOptionalParam('address', `ShellRandomizer's address`, SHELL_RANDOMIZER)
  .addParam('id', `Shell's ID`)
  .setAction(async (args) => {
    const shellRandomizer = await ethers.getContractAt(
      'ShellRandomizer',
      args.address,
    );
    const metadataId = await shellRandomizer.tokenIdToMetadataId(args.id);
    console.log(metadataId.toString());
  });

task('shellRandomizer__requestRevealTokens', 'Request reveal shell')
  .addOptionalParam('address', `ShellRandomizer's address`, SHELL_RANDOMIZER)
  .addParam('id', `Shell's ID`)
  .addParam('quantity', `Quantity`)
  .addParam('from', `Revealer's address`)
  .addParam('timestamp', `Timestamp`)
  .setAction(async (args) => {
    const [owner] = await ethers.getSigners();
    const shellRandomizer = await ethers.getContractAt(
      'ShellRandomizer',
      args.address,
    );
    const tx = await shellRandomizer
      .connect(owner)
      .requestRevealTokens(args.id, args.quantity, args.from, args.timestamp);
    const receipt = await tx.wait();
    console.log(receipt.transactionHash);
  });

task('shellRandomizer__withdrawLINK', 'Withdraw LINK')
  .addOptionalParam('address', `ShellRandomizer's address`, SHELL_RANDOMIZER)
  .addParam('to', `To's address`)
  .addParam('amount', `Amount`)
  .setAction(async (args) => {
    const [owner] = await ethers.getSigners();
    const shellRandomizer = await ethers.getContractAt(
      'ShellRandomizer',
      args.address,
    );
    const tx = await shellRandomizer
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
  mocha: {
    timeout: 60 * 60 * 1000,
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
