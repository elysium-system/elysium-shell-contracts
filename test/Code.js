const { expect } = require('chai');
const { ethers } = require('hardhat');

const emAbi = require('./Em.json');

describe('Code', function () {
  before(async function () {
    const [owner, ...accounts] = await ethers.getSigners();
    const ownerAddr = await owner.getAddress();
    const accountAddrs = await Promise.all(
      accounts.map((acct) => acct.getAddress()),
    );
    this.owner = owner;
    this.ownerAddr = ownerAddr;
    this.accounts = accounts;
    this.accountAddrs = accountAddrs;

    const EM_ADDRESS = '0x2ab99216416018c2af55eB9376E9FB188C4F5c9C';
    const em = await ethers.getContractAt(emAbi, EM_ADDRESS);
    this.em = em;
  });

  beforeEach(async function () {
    const Code = await ethers.getContractFactory('Code');
    const code = await Code.deploy(this.em.address);
    await code.deployed();
    this.code = code;

    const PRICE_PER_TOKEN = await code.PRICE_PER_TOKEN();
    this.PRICE_PER_TOKEN = PRICE_PER_TOKEN;

    const Hacker = await ethers.getContractFactory('Hacker');
    const hacker = await Hacker.deploy(this.code.address);
    await hacker.deployed();
    this.hacker = hacker;
  });

  describe('#preSaleMint', function () {
    beforeEach(async function () {
      const preSaleMintStartTime = new Date();
      preSaleMintStartTime.setFullYear(2022, 3, 15);
      preSaleMintStartTime.setHours(21, 0, 0, 0);
      const preSaleMintEndTime = new Date();
      preSaleMintEndTime.setFullYear(2022, 3, 17);
      preSaleMintEndTime.setHours(21, 0, 0, 0);
      await this.code
        .connect(this.owner)
        .setPreSaleMintTime(
          Math.floor(preSaleMintStartTime.getTime() / 1000),
          Math.floor(preSaleMintEndTime.getTime() / 1000),
        );

      await this.code.connect(this.owner).setSigner(this.ownerAddr);
    });

    it('should revert if not from EOA', async function () {
      await expect(
        this.hacker.hackPreSaleMint(0, 0, 0, 0, 0, 0, 0, []),
      ).to.be.revertedWith('NotEOA');
    });

    it('should revert if pre sale mint has not started', async function () {
      await expect(
        this.code
          .connect(this.accounts[0])
          .preSaleMint(0, 0, 0, 0, 0, 0, 0, []),
      ).to.be.revertedWith('NotStarted');
    });

    it('should revert if pre sale mint has ended', async function () {
      const snapshotId = await ethers.provider.send('evm_snapshot');

      const nextBlockTime = new Date();
      nextBlockTime.setFullYear(2022, 3, 17);
      nextBlockTime.setHours(21, 1, 0, 0);
      await ethers.provider.send('evm_setNextBlockTimestamp', [
        Math.ceil(nextBlockTime / 1000),
      ]);
      await ethers.provider.send('evm_mine');

      await expect(
        this.code
          .connect(this.accounts[0])
          .preSaleMint(0, 0, 0, 0, 0, 0, 0, []),
      ).to.be.revertedWith('Ended');

      await ethers.provider.send('evm_revert', [snapshotId]);
    });

    context('who is eligible for free mint', function () {
      beforeEach(async function () {
        const minter = this.accounts[0];
        const minterAddr = await minter.getAddress();
        this.minter = minter;
        this.minterAddr = minterAddr;

        const FREE_MINT_QUANTITY = 1;
        const FREE_MINT_TICKET = 0;
        const WHITELIST_MINT_ALLOWED_QUANTITY = 0;
        const EM_WHITELIST_MINT_ALLOWED_QUANTITY = 0;
        const SNAPSHOTED_EM_QUANTITY = 0;
        this.FREE_MINT_QUANTITY = FREE_MINT_QUANTITY;
        this.FREE_MINT_TICKET = FREE_MINT_TICKET;
        this.WHITELIST_MINT_ALLOWED_QUANTITY = WHITELIST_MINT_ALLOWED_QUANTITY;
        this.EM_WHITELIST_MINT_ALLOWED_QUANTITY =
          EM_WHITELIST_MINT_ALLOWED_QUANTITY;
        this.SNAPSHOTED_EM_QUANTITY = SNAPSHOTED_EM_QUANTITY;

        const validSignature = await this.owner.signMessage(
          ethers.utils.arrayify(
            ethers.utils.solidityKeccak256(
              [
                'address',
                'uint256',
                'uint256',
                'uint256',
                'uint256',
                'uint256',
              ],
              [
                minterAddr,
                FREE_MINT_QUANTITY,
                FREE_MINT_TICKET,
                WHITELIST_MINT_ALLOWED_QUANTITY,
                EM_WHITELIST_MINT_ALLOWED_QUANTITY,
                SNAPSHOTED_EM_QUANTITY,
              ],
            ),
          ),
        );
        this.validSignature = validSignature;

        const invalidSignature = await this.owner.signMessage(
          ethers.utils.arrayify(
            ethers.utils.solidityKeccak256(
              [
                'address',
                'uint256',
                'uint256',
                'uint256',
                'uint256',
                'uint256',
              ],
              [
                minterAddr,
                FREE_MINT_QUANTITY + 1,
                FREE_MINT_TICKET,
                WHITELIST_MINT_ALLOWED_QUANTITY + 1,
                EM_WHITELIST_MINT_ALLOWED_QUANTITY + 1,
                SNAPSHOTED_EM_QUANTITY,
              ],
            ),
          ),
        );
        this.invalidSignature = invalidSignature;
      });

      it('should revert if signature is invalid', async function () {
        const nextBlockTime = new Date();
        nextBlockTime.setFullYear(2022, 3, 15);
        nextBlockTime.setHours(21, 1, 0, 0);
        await ethers.provider.send('evm_setNextBlockTimestamp', [
          Math.ceil(nextBlockTime / 1000),
        ]);
        await ethers.provider.send('evm_mine');

        await expect(
          this.code
            .connect(this.minter)
            .preSaleMint(
              this.FREE_MINT_QUANTITY,
              this.FREE_MINT_TICKET,
              0,
              this.WHITELIST_MINT_ALLOWED_QUANTITY,
              0,
              this.EM_WHITELIST_MINT_ALLOWED_QUANTITY,
              this.SNAPSHOTED_EM_QUANTITY,
              this.invalidSignature,
            ),
        ).to.be.revertedWith('InvalidSignature');
      });

      it('should revert if free mint ticket has been used', async function () {
        await this.code
          .connect(this.minter)
          .preSaleMint(
            this.FREE_MINT_QUANTITY,
            this.FREE_MINT_TICKET,
            0,
            this.WHITELIST_MINT_ALLOWED_QUANTITY,
            0,
            this.EM_WHITELIST_MINT_ALLOWED_QUANTITY,
            this.SNAPSHOTED_EM_QUANTITY,
            this.validSignature,
          );
        await expect(
          this.code
            .connect(this.minter)
            .preSaleMint(
              this.FREE_MINT_QUANTITY,
              this.FREE_MINT_TICKET,
              0,
              this.WHITELIST_MINT_ALLOWED_QUANTITY,
              0,
              this.EM_WHITELIST_MINT_ALLOWED_QUANTITY,
              this.SNAPSHOTED_EM_QUANTITY,
              this.validSignature,
            ),
        ).to.be.revertedWith('TicketUsed');
      });

      it('should mint successfully', async function () {
        await this.code
          .connect(this.minter)
          .preSaleMint(
            this.FREE_MINT_QUANTITY,
            this.FREE_MINT_TICKET,
            0,
            this.WHITELIST_MINT_ALLOWED_QUANTITY,
            0,
            this.EM_WHITELIST_MINT_ALLOWED_QUANTITY,
            this.SNAPSHOTED_EM_QUANTITY,
            this.validSignature,
          );
        expect(await this.code.balanceOf(this.minterAddr, 1)).to.be.eq(
          this.FREE_MINT_QUANTITY,
        );
      });
    });

    context('who is eligible for whitelist mint', function () {
      beforeEach(async function () {
        const minter = this.accounts[0];
        const minterAddr = await minter.getAddress();
        this.minter = minter;
        this.minterAddr = minterAddr;

        const FREE_MINT_QUANTITY = 0;
        const FREE_MINT_TICKET = 0;
        const WHITELIST_MINT_ALLOWED_QUANTITY = 3;
        const EM_WHITELIST_MINT_ALLOWED_QUANTITY = 0;
        const SNAPSHOTED_EM_QUANTITY = 0;
        this.FREE_MINT_QUANTITY = FREE_MINT_QUANTITY;
        this.FREE_MINT_TICKET = FREE_MINT_TICKET;
        this.WHITELIST_MINT_ALLOWED_QUANTITY = WHITELIST_MINT_ALLOWED_QUANTITY;
        this.EM_WHITELIST_MINT_ALLOWED_QUANTITY =
          EM_WHITELIST_MINT_ALLOWED_QUANTITY;
        this.SNAPSHOTED_EM_QUANTITY = SNAPSHOTED_EM_QUANTITY;

        const validSignature = await this.owner.signMessage(
          ethers.utils.arrayify(
            ethers.utils.solidityKeccak256(
              [
                'address',
                'uint256',
                'uint256',
                'uint256',
                'uint256',
                'uint256',
              ],
              [
                minterAddr,
                FREE_MINT_QUANTITY,
                FREE_MINT_TICKET,
                WHITELIST_MINT_ALLOWED_QUANTITY,
                EM_WHITELIST_MINT_ALLOWED_QUANTITY,
                SNAPSHOTED_EM_QUANTITY,
              ],
            ),
          ),
        );
        this.validSignature = validSignature;

        const invalidSignature = await this.owner.signMessage(
          ethers.utils.arrayify(
            ethers.utils.solidityKeccak256(
              [
                'address',
                'uint256',
                'uint256',
                'uint256',
                'uint256',
                'uint256',
              ],
              [
                minterAddr,
                FREE_MINT_QUANTITY,
                FREE_MINT_TICKET,
                WHITELIST_MINT_ALLOWED_QUANTITY + 1,
                EM_WHITELIST_MINT_ALLOWED_QUANTITY,
                SNAPSHOTED_EM_QUANTITY,
              ],
            ),
          ),
        );
        this.invalidSignature = invalidSignature;
      });

      it('should revert if signature is invalid', async function () {
        const whitelistMintQuantity = this.WHITELIST_MINT_ALLOWED_QUANTITY;
        await expect(
          this.code
            .connect(this.minter)
            .preSaleMint(
              this.FREE_MINT_QUANTITY,
              this.FREE_MINT_TICKET,
              whitelistMintQuantity,
              this.WHITELIST_MINT_ALLOWED_QUANTITY,
              0,
              this.EM_WHITELIST_MINT_ALLOWED_QUANTITY,
              this.SNAPSHOTED_EM_QUANTITY,
              this.invalidSignature,
            ),
        ).to.be.revertedWith('InvalidSignature');
      });

      it('should revert if not enough ETH', async function () {
        const whitelistMintQuantity = this.WHITELIST_MINT_ALLOWED_QUANTITY;
        await expect(
          this.code
            .connect(this.minter)
            .preSaleMint(
              this.FREE_MINT_QUANTITY,
              this.FREE_MINT_TICKET,
              whitelistMintQuantity,
              this.WHITELIST_MINT_ALLOWED_QUANTITY,
              0,
              this.EM_WHITELIST_MINT_ALLOWED_QUANTITY,
              this.SNAPSHOTED_EM_QUANTITY,
              this.validSignature,
            ),
        ).to.be.revertedWith('NotEnoughETH');
      });

      it('should revert if not enough quota', async function () {
        const whitelistMintQuantity = this.WHITELIST_MINT_ALLOWED_QUANTITY + 1;
        await expect(
          this.code
            .connect(this.minter)
            .preSaleMint(
              this.FREE_MINT_QUANTITY,
              this.FREE_MINT_TICKET,
              whitelistMintQuantity,
              this.WHITELIST_MINT_ALLOWED_QUANTITY,
              0,
              this.EM_WHITELIST_MINT_ALLOWED_QUANTITY,
              this.SNAPSHOTED_EM_QUANTITY,
              this.validSignature,
              {
                value: this.PRICE_PER_TOKEN.mul(whitelistMintQuantity),
              },
            ),
        ).to.be.revertedWith('NotEnoughQuota');
      });

      it('should mint successfully', async function () {
        const whitelistMintQuantity = this.WHITELIST_MINT_ALLOWED_QUANTITY;
        await this.code
          .connect(this.minter)
          .preSaleMint(
            this.FREE_MINT_QUANTITY,
            this.FREE_MINT_TICKET,
            whitelistMintQuantity,
            this.WHITELIST_MINT_ALLOWED_QUANTITY,
            0,
            this.EM_WHITELIST_MINT_ALLOWED_QUANTITY,
            this.SNAPSHOTED_EM_QUANTITY,
            this.validSignature,
            {
              value: this.PRICE_PER_TOKEN.mul(whitelistMintQuantity),
            },
          );
        expect(await this.code.balanceOf(this.minterAddr, 1)).to.be.eq(
          whitelistMintQuantity,
        );
      });
    });

    context('who is eligible for em whitelist mint', function () {
      beforeEach(async function () {
        const emHolderAddr = '0x570DC2127F98ce3cF841f3e0038a6257E31F6A4d';
        await ethers.provider.send('hardhat_impersonateAccount', [
          emHolderAddr,
        ]);
        const minter = await ethers.getSigner(emHolderAddr);
        const minterAddr = await minter.getAddress();
        this.minter = minter;
        this.minterAddr = minterAddr;

        await ethers.provider.send('hardhat_setBalance', [
          emHolderAddr,
          '0x100000000000000000000000',
        ]);

        const FREE_MINT_QUANTITY = 0;
        const FREE_MINT_TICKET = 0;
        const WHITELIST_MINT_ALLOWED_QUANTITY = 0;
        const EM_WHITELIST_MINT_ALLOWED_QUANTITY = 2;
        const SNAPSHOTED_EM_QUANTITY = 2;
        this.FREE_MINT_QUANTITY = FREE_MINT_QUANTITY;
        this.FREE_MINT_TICKET = FREE_MINT_TICKET;
        this.WHITELIST_MINT_ALLOWED_QUANTITY = WHITELIST_MINT_ALLOWED_QUANTITY;
        this.EM_WHITELIST_MINT_ALLOWED_QUANTITY =
          EM_WHITELIST_MINT_ALLOWED_QUANTITY;
        this.SNAPSHOTED_EM_QUANTITY = SNAPSHOTED_EM_QUANTITY;

        const validSignature = await this.owner.signMessage(
          ethers.utils.arrayify(
            ethers.utils.solidityKeccak256(
              [
                'address',
                'uint256',
                'uint256',
                'uint256',
                'uint256',
                'uint256',
              ],
              [
                minterAddr,
                FREE_MINT_QUANTITY,
                FREE_MINT_TICKET,
                WHITELIST_MINT_ALLOWED_QUANTITY,
                EM_WHITELIST_MINT_ALLOWED_QUANTITY,
                SNAPSHOTED_EM_QUANTITY,
              ],
            ),
          ),
        );
        this.validSignature = validSignature;

        const invalidSignature = await this.owner.signMessage(
          ethers.utils.arrayify(
            ethers.utils.solidityKeccak256(
              [
                'address',
                'uint256',
                'uint256',
                'uint256',
                'uint256',
                'uint256',
              ],
              [
                minterAddr,
                FREE_MINT_QUANTITY,
                FREE_MINT_TICKET,
                WHITELIST_MINT_ALLOWED_QUANTITY,
                EM_WHITELIST_MINT_ALLOWED_QUANTITY + 1,
                SNAPSHOTED_EM_QUANTITY,
              ],
            ),
          ),
        );
        this.invalidSignature = invalidSignature;
      });

      it('should revert if signature is invalid', async function () {
        const emWhitelistMintQuantity = this.EM_WHITELIST_MINT_ALLOWED_QUANTITY;
        await expect(
          this.code
            .connect(this.minter)
            .preSaleMint(
              this.FREE_MINT_QUANTITY,
              this.FREE_MINT_TICKET,
              0,
              this.WHITELIST_MINT_ALLOWED_QUANTITY,
              emWhitelistMintQuantity,
              this.EM_WHITELIST_MINT_ALLOWED_QUANTITY,
              this.SNAPSHOTED_EM_QUANTITY,
              this.invalidSignature,
            ),
        ).to.be.revertedWith('InvalidSignature');
      });

      it('should revert if not enough ETH', async function () {
        const emWhitelistMintQuantity = this.EM_WHITELIST_MINT_ALLOWED_QUANTITY;
        await expect(
          this.code
            .connect(this.minter)
            .preSaleMint(
              this.FREE_MINT_QUANTITY,
              this.FREE_MINT_TICKET,
              0,
              this.WHITELIST_MINT_ALLOWED_QUANTITY,
              emWhitelistMintQuantity,
              this.EM_WHITELIST_MINT_ALLOWED_QUANTITY,
              this.SNAPSHOTED_EM_QUANTITY,
              this.validSignature,
            ),
        ).to.be.revertedWith('NotEnoughETH');
      });

      it('should revert if not enough quota', async function () {
        const emWhitelistMintQuantity =
          this.EM_WHITELIST_MINT_ALLOWED_QUANTITY + 1;
        await expect(
          this.code
            .connect(this.minter)
            .preSaleMint(
              this.FREE_MINT_QUANTITY,
              this.FREE_MINT_TICKET,
              0,
              this.WHITELIST_MINT_ALLOWED_QUANTITY,
              emWhitelistMintQuantity,
              this.EM_WHITELIST_MINT_ALLOWED_QUANTITY,
              this.SNAPSHOTED_EM_QUANTITY,
              this.validSignature,
              {
                value: this.PRICE_PER_TOKEN.mul(emWhitelistMintQuantity),
              },
            ),
        ).to.be.revertedWith('NotEnoughQuota');
      });

      it('should revert if paper hand', async function () {
        const snapshotId = await ethers.provider.send('evm_snapshot');

        await this.em
          .connect(this.minter)
          .safeTransferFrom(this.minterAddr, this.accountAddrs[1], 1, 1, []);

        const emWhitelistMintQuantity = this.EM_WHITELIST_MINT_ALLOWED_QUANTITY;
        await expect(
          this.code
            .connect(this.minter)
            .preSaleMint(
              this.FREE_MINT_QUANTITY,
              this.FREE_MINT_TICKET,
              0,
              this.WHITELIST_MINT_ALLOWED_QUANTITY,
              emWhitelistMintQuantity,
              this.EM_WHITELIST_MINT_ALLOWED_QUANTITY,
              this.SNAPSHOTED_EM_QUANTITY,
              this.validSignature,
              {
                value: this.PRICE_PER_TOKEN.mul(emWhitelistMintQuantity),
              },
            ),
        ).to.be.revertedWith('PaperHand');

        await ethers.provider.send('evm_revert', [snapshotId]);
      });

      it('should mint successfully', async function () {
        const emWhitelistMintQuantity = this.EM_WHITELIST_MINT_ALLOWED_QUANTITY;
        await this.code
          .connect(this.minter)
          .preSaleMint(
            this.FREE_MINT_QUANTITY,
            this.FREE_MINT_TICKET,
            0,
            this.WHITELIST_MINT_ALLOWED_QUANTITY,
            emWhitelistMintQuantity,
            this.EM_WHITELIST_MINT_ALLOWED_QUANTITY,
            this.SNAPSHOTED_EM_QUANTITY,
            this.validSignature,
            {
              value: this.PRICE_PER_TOKEN.mul(emWhitelistMintQuantity),
            },
          );
      });
    });
  });
});
