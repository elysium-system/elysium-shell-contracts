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
    it('should revert if not from EOA', async function () {
      await expect(
        this.hacker
          .connect(this.accounts[0])
          .hackPreSaleMint(0, 0, 0, 0, 0, 0, 0, []),
      ).to.be.revertedWith('NotEOA');
    });

    context('when pre sale mint time is not set', function () {
      it('should revert', async function () {
        await expect(
          this.code
            .connect(this.accounts[0])
            .preSaleMint(0, 0, 0, 0, 0, 0, 0, []),
        ).to.be.revertedWith('NotStarted');
      });
    });

    context('when pre sale mint time is set', function () {
      beforeEach(async function () {
        const preSaleMintStartTime = new Date();
        preSaleMintStartTime.setFullYear(2023, 3, 15);
        preSaleMintStartTime.setHours(21, 0, 0, 0);
        const preSaleMintEndTime = new Date();
        preSaleMintEndTime.setFullYear(2023, 3, 17);
        preSaleMintEndTime.setHours(21, 0, 0, 0);
        await this.code
          .connect(this.owner)
          .setPreSaleMintTime(
            Math.floor(preSaleMintStartTime.getTime() / 1000),
            Math.floor(preSaleMintEndTime.getTime() / 1000),
          );
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
        nextBlockTime.setFullYear(2023, 3, 17);
        nextBlockTime.setHours(21, 0, 1, 0);
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

      context('when signer is not set', function () {
        beforeEach(async function () {
          const snapshotId = await ethers.provider.send('evm_snapshot');
          this.snapshotId = snapshotId;

          const nextBlockTime = new Date();
          nextBlockTime.setFullYear(2023, 3, 15);
          nextBlockTime.setHours(21, 0, 1, 0);
          await ethers.provider.send('evm_setNextBlockTimestamp', [
            Math.ceil(nextBlockTime / 1000),
          ]);
          await ethers.provider.send('evm_mine');
        });

        afterEach(async function () {
          await ethers.provider.send('evm_revert', [this.snapshotId]);
        });

        it('should revert', async function () {
          const sig = await this.owner.signMessage(
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
                [this.accountAddrs[0], 0, 0, 0, 0, 0],
              ),
            ),
          );

          await expect(
            this.code
              .connect(this.accounts[0])
              .preSaleMint(0, 0, 0, 0, 0, 0, 0, sig),
          ).to.be.revertedWith('InvalidSignature');
        });
      });

      context('when signer is set', function () {
        beforeEach(async function () {
          await this.code.connect(this.owner).setSigner(this.ownerAddr);
        });

        beforeEach(async function () {
          const snapshotId = await ethers.provider.send('evm_snapshot');
          this.snapshotId = snapshotId;

          const nextBlockTime = new Date();
          nextBlockTime.setFullYear(2023, 3, 15);
          nextBlockTime.setHours(21, 0, 1, 0);
          await ethers.provider.send('evm_setNextBlockTimestamp', [
            Math.ceil(nextBlockTime / 1000),
          ]);
          await ethers.provider.send('evm_mine');
        });

        afterEach(async function () {
          await ethers.provider.send('evm_revert', [this.snapshotId]);
        });

        context('who is eligible for free mint', function () {
          beforeEach(async function () {
            const minter = this.accounts[1];
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
            this.WHITELIST_MINT_ALLOWED_QUANTITY =
              WHITELIST_MINT_ALLOWED_QUANTITY;
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
            const minter = this.accounts[2];
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
            this.WHITELIST_MINT_ALLOWED_QUANTITY =
              WHITELIST_MINT_ALLOWED_QUANTITY;
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
            const whitelistMintQuantity =
              this.WHITELIST_MINT_ALLOWED_QUANTITY + 1;
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
            this.WHITELIST_MINT_ALLOWED_QUANTITY =
              WHITELIST_MINT_ALLOWED_QUANTITY;
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
            const emWhitelistMintQuantity =
              this.EM_WHITELIST_MINT_ALLOWED_QUANTITY;
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
            const emWhitelistMintQuantity =
              this.EM_WHITELIST_MINT_ALLOWED_QUANTITY;
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
              .safeTransferFrom(
                this.minterAddr,
                this.accountAddrs[1],
                1,
                1,
                [],
              );

            const emWhitelistMintQuantity =
              this.EM_WHITELIST_MINT_ALLOWED_QUANTITY;
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
            const emWhitelistMintQuantity =
              this.EM_WHITELIST_MINT_ALLOWED_QUANTITY;
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
  });

  describe('#publicSaleMint', function () {
    it('should revert if not from EOA', async function () {
      await expect(
        this.hacker.connect(this.accounts[0]).hackPublicSaleMint(0, 0, []),
      ).to.be.revertedWith('NotEOA');
    });

    context('when public sale mint time is not set', function () {
      it('should revert', async function () {
        await expect(
          this.code.connect(this.accounts[0]).publicSaleMint(0, 0, []),
        ).to.be.revertedWith('NotStarted');
      });
    });

    context('when public sale mint time is set', function () {
      beforeEach(async function () {
        const publicSaleMintStartTime = new Date();
        publicSaleMintStartTime.setFullYear(2023, 3, 18);
        publicSaleMintStartTime.setHours(21, 0, 0, 0);
        const publicSaleMintEndTime = new Date();
        publicSaleMintEndTime.setFullYear(2023, 3, 20);
        publicSaleMintEndTime.setHours(21, 0, 0, 0);
        await this.code
          .connect(this.owner)
          .setPublicSaleMintTime(
            Math.floor(publicSaleMintStartTime.getTime() / 1000),
            Math.floor(publicSaleMintEndTime.getTime() / 1000),
          );
      });

      it('should revert if public sale mint has not started', async function () {
        await expect(
          this.code.connect(this.accounts[0]).publicSaleMint(0, 0, []),
        ).to.be.revertedWith('NotStarted');
      });

      it('should revert if pre sale mint has ended', async function () {
        const snapshotId = await ethers.provider.send('evm_snapshot');

        const nextBlockTime = new Date();
        nextBlockTime.setFullYear(2023, 3, 20);
        nextBlockTime.setHours(21, 0, 1, 0);
        await ethers.provider.send('evm_setNextBlockTimestamp', [
          Math.ceil(nextBlockTime / 1000),
        ]);
        await ethers.provider.send('evm_mine');

        await expect(
          this.code.connect(this.accounts[0]).publicSaleMint(0, 0, []),
        ).to.be.revertedWith('Ended');

        await ethers.provider.send('evm_revert', [snapshotId]);
      });

      context('when signer is not set', function () {
        beforeEach(async function () {
          const snapshotId = await ethers.provider.send('evm_snapshot');
          this.snapshotId = snapshotId;

          const nextBlockTime = new Date();
          nextBlockTime.setFullYear(2023, 3, 18);
          nextBlockTime.setHours(21, 0, 1, 0);
          await ethers.provider.send('evm_setNextBlockTimestamp', [
            Math.ceil(nextBlockTime / 1000),
          ]);
          await ethers.provider.send('evm_mine');
        });

        afterEach(async function () {
          await ethers.provider.send('evm_revert', [this.snapshotId]);
        });

        it('should revert', async function () {
          const sig = await this.owner.signMessage(
            ethers.utils.arrayify(
              ethers.utils.solidityKeccak256(
                ['address', 'uint256'],
                [this.accountAddrs[0], 0],
              ),
            ),
          );

          await expect(
            this.code.connect(this.accounts[0]).publicSaleMint(0, 0, sig),
          ).to.be.revertedWith('InvalidSignature');
        });
      });

      context('when signer is set', function () {
        beforeEach(async function () {
          await this.code.connect(this.owner).setSigner(this.ownerAddr);
        });

        beforeEach(async function () {
          const snapshotId = await ethers.provider.send('evm_snapshot');
          this.snapshotId = snapshotId;

          const nextBlockTime = new Date();
          nextBlockTime.setFullYear(2023, 3, 18);
          nextBlockTime.setHours(21, 0, 1, 0);
          await ethers.provider.send('evm_setNextBlockTimestamp', [
            Math.ceil(nextBlockTime / 1000),
          ]);
          await ethers.provider.send('evm_mine');
        });

        afterEach(async function () {
          await ethers.provider.send('evm_revert', [this.snapshotId]);
        });

        beforeEach(async function () {
          const minter = this.accounts[1];
          const minterAddr = await minter.getAddress();
          this.minter = minter;
          this.minterAddr = minterAddr;

          const QUANTITY = 1;
          const TICKET = 0;
          this.QUANTITY = QUANTITY;
          this.TICKET = TICKET;

          const validSignature = await this.owner.signMessage(
            ethers.utils.arrayify(
              ethers.utils.solidityKeccak256(
                ['address', 'uint256'],
                [minterAddr, TICKET],
              ),
            ),
          );
          this.validSignature = validSignature;

          const invalidSignature = await this.owner.signMessage(
            ethers.utils.arrayify(
              ethers.utils.solidityKeccak256(
                ['address', 'uint256'],
                [minterAddr, TICKET + 1],
              ),
            ),
          );
          this.invalidSignature = invalidSignature;
        });

        it('should revert if signature is invalid', async function () {
          const quantity = this.QUANTITY;
          await expect(
            this.code
              .connect(this.minter)
              .publicSaleMint(quantity, this.TICKET, this.invalidSignature),
          ).to.be.revertedWith('InvalidSignature');
        });

        it('should revert if ticket has been used', async function () {
          const quantity = this.QUANTITY;
          await this.code
            .connect(this.minter)
            .publicSaleMint(quantity, this.TICKET, this.validSignature, {
              value: this.PRICE_PER_TOKEN.mul(quantity),
            });
          await expect(
            this.code
              .connect(this.minter)
              .publicSaleMint(quantity, this.TICKET, this.validSignature, {
                value: this.PRICE_PER_TOKEN.mul(quantity),
              }),
          ).to.be.revertedWith('TicketUsed');
        });

        it('should revert if not enough ETH', async function () {
          const quantity = this.QUANTITY;
          await expect(
            this.code
              .connect(this.minter)
              .publicSaleMint(quantity, this.TICKET, this.validSignature),
          ).to.be.revertedWith('NotEnoughETH');
        });

        it('should revert if mint too many at once', async function () {
          const MAX_NUM_MINTS_PER_TX = await this.code.MAX_NUM_MINTS_PER_TX();
          const quantity = MAX_NUM_MINTS_PER_TX + 1;
          await expect(
            this.code
              .connect(this.minter)
              .publicSaleMint(quantity, this.TICKET, this.validSignature, {
                value: this.PRICE_PER_TOKEN.mul(quantity),
              }),
          ).to.be.revertedWith('MintTooManyAtOnce');
        });

        it('should mint successfully', async function () {
          const quantity = this.QUANTITY;
          await this.code
            .connect(this.minter)
            .publicSaleMint(quantity, this.TICKET, this.validSignature, {
              value: this.PRICE_PER_TOKEN.mul(quantity),
            });
          expect(await this.code.balanceOf(this.minterAddr, 1)).to.be.eq(
            quantity,
          );
        });
      });
    });
  });

  describe('#migrate', function () {
    beforeEach(async function () {
      const Shell = await ethers.getContractFactory('Shell');
      // TODO:
      const shell = await Shell.deploy(this.code.address);
      await shell.deployed();
      this.shell = shell;

      this.code.connect(this.owner).setShell(shell.address);
    });

    it('should revert if not from EOA', async function () {
      await expect(
        this.hacker.connect(this.accounts[0]).hackMigrate(0),
      ).to.be.revertedWith('NotEOA');
    });

    context('when migration time is not set', function () {
      it('should revert', async function () {
        await expect(
          this.code.connect(this.accounts[0]).migrate(0),
        ).to.be.revertedWith('NotStarted');
      });
    });

    context('when migration time is set', function () {
      beforeEach(async function () {
        const migrationStartTime = new Date();
        migrationStartTime.setFullYear(2023, 3, 21);
        migrationStartTime.setHours(21, 0, 0, 0);
        const migrationEndTime = new Date();
        migrationEndTime.setFullYear(2074, 0, 1);
        migrationEndTime.setHours(0, 0, 0, 0);
        await this.code
          .connect(this.owner)
          .setMigrationTime(
            Math.floor(migrationStartTime.getTime() / 1000),
            Math.floor(migrationEndTime.getTime() / 1000),
          );
      });

      it('should revert if migration has not started', async function () {
        await expect(
          this.code.connect(this.accounts[0]).migrate(0),
        ).to.be.revertedWith('NotStarted');
      });

      it('should revert if migration has ended', async function () {
        const snapshotId = await ethers.provider.send('evm_snapshot');

        const nextBlockTime = new Date();
        nextBlockTime.setFullYear(2074, 0, 1);
        nextBlockTime.setHours(0, 0, 1, 0);
        await ethers.provider.send('evm_setNextBlockTimestamp', [
          Math.ceil(nextBlockTime / 1000),
        ]);
        await ethers.provider.send('evm_mine');

        await expect(
          this.code.connect(this.accounts[0]).migrate(0),
        ).to.be.revertedWith('Ended');

        await ethers.provider.send('evm_revert', [snapshotId]);
      });

      context('who has no codes', function () {
        beforeEach(async function () {
          const snapshotId = await ethers.provider.send('evm_snapshot');
          this.snapshotId = snapshotId;

          const nextBlockTime = new Date();
          nextBlockTime.setFullYear(2023, 3, 21);
          nextBlockTime.setHours(21, 0, 1, 0);
          await ethers.provider.send('evm_setNextBlockTimestamp', [
            Math.ceil(nextBlockTime / 1000),
          ]);
          await ethers.provider.send('evm_mine');
        });

        afterEach(async function () {
          await ethers.provider.send('evm_revert', [this.snapshotId]);
        });

        it('should revert', async function () {
          const quantity = 3;
          await expect(
            this.code.connect(this.accounts[1]).migrate(quantity),
          ).to.be.revertedWith('ERC1155: burn amount exceeds balance');
        });
      });

      context('who has codes', function () {
        beforeEach(async function () {});

        beforeEach(async function () {
          const snapshotId = await ethers.provider.send('evm_snapshot');
          this.snapshotId = snapshotId;

          await this.code.connect(this.owner).setSigner(this.ownerAddr);

          const publicSaleMintStartTime = new Date();
          publicSaleMintStartTime.setFullYear(2023, 3, 18);
          publicSaleMintStartTime.setHours(21, 0, 0, 0);
          const publicSaleMintEndTime = new Date();
          publicSaleMintEndTime.setFullYear(2023, 3, 20);
          publicSaleMintEndTime.setHours(21, 0, 0, 0);
          await this.code
            .connect(this.owner)
            .setPublicSaleMintTime(
              Math.floor(publicSaleMintStartTime.getTime() / 1000),
              Math.floor(publicSaleMintEndTime.getTime() / 1000),
            );

          let nextBlockTime;
          nextBlockTime = new Date();
          nextBlockTime.setFullYear(2023, 3, 18);
          nextBlockTime.setHours(21, 0, 1, 0);
          await ethers.provider.send('evm_setNextBlockTimestamp', [
            Math.ceil(nextBlockTime / 1000),
          ]);
          await ethers.provider.send('evm_mine');

          const TICKET = 0;
          const sig = await this.owner.signMessage(
            ethers.utils.arrayify(
              ethers.utils.solidityKeccak256(
                ['address', 'uint256'],
                [this.accountAddrs[2], TICKET],
              ),
            ),
          );
          const quantity = 3;
          await this.code
            .connect(this.accounts[2])
            .publicSaleMint(quantity, TICKET, sig, {
              value: this.PRICE_PER_TOKEN.mul(quantity),
            });

          nextBlockTime = new Date();
          nextBlockTime.setFullYear(2023, 3, 21);
          nextBlockTime.setHours(21, 0, 1, 0);
          await ethers.provider.send('evm_setNextBlockTimestamp', [
            Math.ceil(nextBlockTime / 1000),
          ]);
          await ethers.provider.send('evm_mine');
        });

        afterEach(async function () {
          await ethers.provider.send('evm_revert', [this.snapshotId]);
        });

        it('should migrate successfully', async function () {
          const balance = await this.code.balanceOf(this.accountAddrs[2], 1);
          const quantity = 2;
          await this.code.connect(this.accounts[2]).migrate(quantity);
          expect(await this.code.balanceOf(this.accountAddrs[2], 1)).to.be.eq(
            balance - quantity,
          );
          expect(await this.shell.balanceOf(this.accountAddrs[2])).to.be.eq(
            quantity,
          );
        });
      });
    });
  });
});
