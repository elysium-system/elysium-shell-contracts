const { expect } = require('chai');
const { ethers } = require('hardhat');
const { MerkleTree } = require('merkletreejs');

const emAbi = require('./Em.json');

describe('Code', function () {
  before(async function () {
    const [owner, ...accounts] = await ethers.getSigners();
    this.owner = owner;
    this.accounts = accounts;

    const EM_ADDRESS = '0x2ab99216416018c2af55eB9376E9FB188C4F5c9C';
    const em = await ethers.getContractAt(emAbi, EM_ADDRESS);
    this.em = em;

    const addressToFreeMintData = await accounts.slice(0, 3).reduce(
      async (prev, acct, idx) => ({
        ...(await prev),
        [await acct.getAddress()]: {
          quantity: idx + 1,
        },
      }),
      Promise.resolve({}),
    );
    this.addressToFreeMintData = addressToFreeMintData;
    const addressToFreeMintMerkleLeaf = Object.entries(
      addressToFreeMintData,
    ).reduce((prev, [addr, data], idx) => {
      const { quantity } = data;
      const ticket = idx;
      return {
        ...prev,
        [addr]: ethers.utils.solidityPack(
          ['address', 'uint256', 'uint256'],
          [addr, quantity, ticket],
        ),
      };
    }, {});
    const freeMintMerkleTree = new MerkleTree(
      Object.values(addressToFreeMintMerkleLeaf).map(ethers.utils.keccak256),
      ethers.utils.keccak256,
      {
        sort: true,
      },
    );
    this.freeMintMerkleTree = freeMintMerkleTree;
    const addressToFreeMintMerkleProofs = Object.entries(
      addressToFreeMintMerkleLeaf,
    ).reduce(
      (prev, [addr, leaf]) => ({
        ...prev,
        [addr]: freeMintMerkleTree.getHexProof(ethers.utils.keccak256(leaf)),
      }),
      {},
    );
    this.addressToFreeMintMerkleProofs = addressToFreeMintMerkleProofs;
  });

  beforeEach(async function () {
    const Code = await ethers.getContractFactory('Code');
    const code = await Code.deploy(this.em.address);
    await code.deployed();
    this.code = code;

    const Hacker = await ethers.getContractFactory('Hacker');
    const hacker = await Hacker.deploy(this.code.address);
    await hacker.deployed();
    this.hacker = hacker;
  });

  describe('#freeMint', function () {
    it('should revert if not from EOA', async function () {
      await expect(this.hacker.hackFreeMint(1, 0, [])).to.be.revertedWith(
        'NotEOA',
      );
    });

    it('should revert if free mint has not started', async function () {
      await expect(
        this.code.connect(this.accounts[0]).freeMint(1, 0, []),
      ).to.be.revertedWith('NotStarted');
    });

    it('should revert if free mint has ended', async function () {
      await this.code.connect(this.owner).setFreeMintTime(0, 1);
      await expect(
        this.code.connect(this.accounts[0]).freeMint(1, 0, []),
      ).to.be.revertedWith('Ended');
    });

    it('should revert if merkle proofs input is invalid', async function () {
      await this.code
        .connect(this.owner)
        .setFreeMintTime(0, ethers.constants.MaxUint256);
      await expect(
        this.code.connect(this.accounts[0]).freeMint(1, 0, []),
      ).to.be.revertedWith('InvalidProof');
    });

    it('should revert if ticket has been used', async function () {
      await this.code
        .connect(this.owner)
        .setFreeMintMerkleTreeRoot(this.freeMintMerkleTree.getHexRoot());
      await this.code
        .connect(this.owner)
        .setFreeMintTime(0, ethers.constants.MaxUint256);
      const acct = this.accounts[0];
      const acctAddr = await acct.getAddress();
      await this.code
        .connect(acct)
        .freeMint(
          this.addressToFreeMintData[acctAddr].quantity,
          0,
          this.addressToFreeMintMerkleProofs[acctAddr],
        );
      await expect(
        this.code
          .connect(acct)
          .freeMint(
            this.addressToFreeMintData[acctAddr].quantity,
            0,
            this.addressToFreeMintMerkleProofs[acctAddr],
          ),
      ).to.be.revertedWith('TicketUsed');
    });

    it('should mint successfully', async function () {
      await this.code
        .connect(this.owner)
        .setFreeMintMerkleTreeRoot(this.freeMintMerkleTree.getHexRoot());
      await this.code
        .connect(this.owner)
        .setFreeMintTime(0, ethers.constants.MaxUint256);
      const acct = this.accounts[0];
      const acctAddr = await acct.getAddress();
      expect(await this.code.balanceOf(acctAddr, 1)).to.be.eq(0);
      await this.code
        .connect(acct)
        .freeMint(
          this.addressToFreeMintData[acctAddr].quantity,
          0,
          this.addressToFreeMintMerkleProofs[acctAddr],
        );
      expect(await this.code.balanceOf(acctAddr, 1)).to.be.eq(1);
    });
  });
});
