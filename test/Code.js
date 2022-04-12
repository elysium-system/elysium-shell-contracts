const crypto = require('crypto');

const { expect } = require('chai');
const { ethers } = require('hardhat');

const emAbi = require('./Em.json');

const { EM } = process.env;

let PRE_SALE_MINT_START_TIME = new Date();
PRE_SALE_MINT_START_TIME.setFullYear(2023, 3, 15);
PRE_SALE_MINT_START_TIME.setHours(21, 0, 0, 0);
PRE_SALE_MINT_START_TIME = Math.floor(
  PRE_SALE_MINT_START_TIME.getTime() / 1000,
);
let PRE_SALE_MINT_END_TIME = new Date();
PRE_SALE_MINT_END_TIME.setFullYear(2023, 3, 17);
PRE_SALE_MINT_END_TIME.setHours(21, 0, 0, 0);
PRE_SALE_MINT_END_TIME = Math.floor(PRE_SALE_MINT_END_TIME.getTime() / 1000);

let PUBLIC_SALE_MINT_START_TIME = new Date();
PUBLIC_SALE_MINT_START_TIME.setFullYear(2023, 3, 18);
PUBLIC_SALE_MINT_START_TIME.setHours(21, 0, 0, 0);
PUBLIC_SALE_MINT_START_TIME = Math.floor(
  PUBLIC_SALE_MINT_START_TIME.getTime() / 1000,
);
let PUBLIC_SALE_MINT_END_TIME = new Date();
PUBLIC_SALE_MINT_END_TIME.setFullYear(2023, 3, 20);
PUBLIC_SALE_MINT_END_TIME.setHours(21, 0, 0, 0);
PUBLIC_SALE_MINT_END_TIME = Math.floor(
  PUBLIC_SALE_MINT_END_TIME.getTime() / 1000,
);

let MIGRATION_START_TIME = new Date();
MIGRATION_START_TIME.setFullYear(2023, 3, 21);
MIGRATION_START_TIME.setHours(21, 0, 0, 0);
MIGRATION_START_TIME = Math.floor(MIGRATION_START_TIME.getTime() / 1000);
let MIGRATION_END_TIME = new Date();
MIGRATION_END_TIME.setFullYear(2074, 0, 1);
MIGRATION_END_TIME.setHours(0, 0, 0, 0);
MIGRATION_END_TIME = Math.floor(MIGRATION_END_TIME.getTime() / 1000);

describe('Code', function () {
  let snapshotId;

  let owner, accounts;
  let ownerAddr, accountAddrs;
  let em, code, hacker;
  let PRICE_PER_TOKEN, MAX_TOTAL_SUPPLY, MAX_NUM_MINTS_PER_TX;

  before(async function () {
    [owner, ...accounts] = await ethers.getSigners();
    ownerAddr = await owner.getAddress();
    accountAddrs = await Promise.all(accounts.map((acct) => acct.getAddress()));

    em = await ethers.getContractAt(emAbi, EM);
  });

  beforeEach(async function () {
    snapshotId = await ethers.provider.send('evm_snapshot');

    const Code = await ethers.getContractFactory('Code');
    code = await Code.deploy(em.address);
    await code.deployed();

    PRICE_PER_TOKEN = await code.PRICE_PER_TOKEN();
    MAX_TOTAL_SUPPLY = await code.MAX_TOTAL_SUPPLY();
    MAX_NUM_MINTS_PER_TX = await code.MAX_NUM_MINTS_PER_TX();

    const Hacker = await ethers.getContractFactory('Hacker');
    hacker = await Hacker.deploy(code.address);
    await hacker.deployed();
  });

  afterEach(async function () {
    await ethers.provider.send('evm_revert', [snapshotId]);
  });

  describe('#preSaleMint', function () {
    it('should revert if not from EOA', async function () {
      await expect(
        hacker.connect(accounts[0]).hackPreSaleMint(0, 0, 0, 0, 0, 0, 0, []),
      ).to.be.revertedWith('NotEOA');
    });

    context('when pre sale mint time is not set', function () {
      it('should revert', async function () {
        await expect(
          code.connect(accounts[0]).preSaleMint(0, 0, 0, 0, 0, 0, 0, []),
        ).to.be.revertedWith('NotStarted');
      });
    });

    context('when pre sale mint time is set', function () {
      let snapshotId;

      beforeEach(async function () {
        snapshotId = await ethers.provider.send('evm_snapshot');

        await code
          .connect(owner)
          .setPreSaleMintTime(PRE_SALE_MINT_START_TIME, PRE_SALE_MINT_END_TIME);
      });

      afterEach(async function () {
        await ethers.provider.send('evm_revert', [snapshotId]);
      });

      context('when pre sale mint has not started', function () {
        it('should revert', async function () {
          await expect(
            code.connect(accounts[0]).preSaleMint(0, 0, 0, 0, 0, 0, 0, []),
          ).to.be.revertedWith('NotStarted');
        });
      });

      context('when pre sale mint has ended', function () {
        let snapshotId;

        beforeEach(async function () {
          snapshotId = await ethers.provider.send('evm_snapshot');

          const nextBlockTime = PRE_SALE_MINT_END_TIME + 1;
          await ethers.provider.send('evm_setNextBlockTimestamp', [
            nextBlockTime,
          ]);
          await ethers.provider.send('evm_mine');
        });

        afterEach(async function () {
          await ethers.provider.send('evm_revert', [snapshotId]);
        });

        it('should revert', async function () {
          await expect(
            code.connect(accounts[0]).preSaleMint(0, 0, 0, 0, 0, 0, 0, []),
          ).to.be.revertedWith('Ended');
        });
      });

      context('when pre sale mint has started and not ended', function () {
        let snapshotId;

        beforeEach(async function () {
          snapshotId = await ethers.provider.send('evm_snapshot');

          const nextBlockTime = PRE_SALE_MINT_START_TIME + 1;
          await ethers.provider.send('evm_setNextBlockTimestamp', [
            nextBlockTime,
          ]);
          await ethers.provider.send('evm_mine');
        });

        afterEach(async function () {
          await ethers.provider.send('evm_revert', [snapshotId]);
        });

        context('who is eligible for free mint', function () {
          const FREE_MINT_ALLOWED_QUANTITIES = [2, 1, 3];

          let minters;
          let minterAddrs;
          const numMinters = FREE_MINT_ALLOWED_QUANTITIES.length;

          let signatures;

          beforeEach(async function () {
            minters = accounts.slice(1);
            minterAddrs = await Promise.all(
              minters.map((minter) => minter.getAddress()),
            );

            signatures = await Promise.all(
              new Array(numMinters)
                .fill(null)
                .map((_, idx) =>
                  owner.signMessage(
                    ethers.utils.arrayify(
                      ethers.utils.solidityKeccak256(
                        ['address', 'uint256', 'uint256', 'uint256', 'uint256'],
                        [
                          minterAddrs[idx],
                          FREE_MINT_ALLOWED_QUANTITIES[idx],
                          0,
                          0,
                          0,
                        ],
                      ),
                    ),
                  ),
                ),
            );
          });

          it('should revert if signature is invalid', async function () {
            await Promise.all(
              new Array(numMinters)
                .fill(null)
                .map((_, idx) =>
                  expect(
                    code
                      .connect(minters[idx])
                      .preSaleMint(
                        FREE_MINT_ALLOWED_QUANTITIES[idx] + 1,
                        FREE_MINT_ALLOWED_QUANTITIES[idx] + 1,
                        0,
                        0,
                        0,
                        0,
                        0,
                        signatures[idx],
                      ),
                  ).to.be.revertedWith('InvalidSignature'),
                ),
            );
            await Promise.all(
              new Array(numMinters)
                .fill(null)
                .map((_, idx) =>
                  expect(
                    code
                      .connect(accounts[0])
                      .preSaleMint(
                        FREE_MINT_ALLOWED_QUANTITIES[idx],
                        FREE_MINT_ALLOWED_QUANTITIES[idx],
                        0,
                        0,
                        0,
                        0,
                        0,
                        signatures[idx],
                      ),
                  ).to.be.revertedWith('InvalidSignature'),
                ),
            );
          });

          it('should revert if not enough quota', async function () {
            await Promise.all(
              new Array(numMinters)
                .fill(null)
                .map((_, idx) =>
                  expect(
                    code
                      .connect(minters[idx])
                      .preSaleMint(
                        FREE_MINT_ALLOWED_QUANTITIES[idx] + 1,
                        FREE_MINT_ALLOWED_QUANTITIES[idx],
                        0,
                        0,
                        0,
                        0,
                        0,
                        signatures[idx],
                      ),
                  ).to.be.revertedWith('NotEnoughQuota'),
                ),
            );

            await new Array(numMinters)
              .fill(null)
              .reduce(async (prev, _, idx) => {
                await prev;
                await code
                  .connect(minters[idx])
                  .preSaleMint(
                    FREE_MINT_ALLOWED_QUANTITIES[idx],
                    FREE_MINT_ALLOWED_QUANTITIES[idx],
                    0,
                    0,
                    0,
                    0,
                    0,
                    signatures[idx],
                  );
              }, Promise.resolve());

            await Promise.all(
              new Array(numMinters)
                .fill(null)
                .map((_, idx) =>
                  expect(
                    code
                      .connect(minters[idx])
                      .preSaleMint(
                        1,
                        FREE_MINT_ALLOWED_QUANTITIES[idx],
                        0,
                        0,
                        0,
                        0,
                        0,
                        signatures[idx],
                      ),
                  ).to.be.revertedWith('NotEnoughQuota'),
                ),
            );
          });

          it('should mint successfully', async function () {
            const totalNumMintedTokens = await code.totalNumMintedTokens();
            const tokenId = await code.nextTokenId();

            await new Array(numMinters)
              .fill(null)
              .reduce(async (prev, _, idx) => {
                await prev;
                await code
                  .connect(minters[idx])
                  .preSaleMint(
                    FREE_MINT_ALLOWED_QUANTITIES[idx],
                    FREE_MINT_ALLOWED_QUANTITIES[idx],
                    0,
                    0,
                    0,
                    0,
                    0,
                    signatures[idx],
                  );
              }, Promise.resolve());

            await Promise.all(
              new Array(numMinters)
                .fill(null)
                .map(async (_, idx) =>
                  expect(
                    await code.balanceOf(minterAddrs[idx], tokenId.add(idx)),
                  ).to.eq(FREE_MINT_ALLOWED_QUANTITIES[idx]),
                ),
            );
            expect(await code.totalNumMintedTokens()).to.eq(
              totalNumMintedTokens.add(
                FREE_MINT_ALLOWED_QUANTITIES.reduce(
                  (prev, curr) => prev + curr,
                  0,
                ),
              ),
            );
            expect(await code.nextTokenId()).to.eq(tokenId.add(numMinters));
          });

          it('should mint the rest successfully', async function () {
            const totalNumMintedTokens = await code.totalNumMintedTokens();

            let tokenId;
            tokenId = await code.nextTokenId();
            await expect(
              await code
                .connect(minters[0])
                .preSaleMint(
                  FREE_MINT_ALLOWED_QUANTITIES[0] - 1,
                  FREE_MINT_ALLOWED_QUANTITIES[0],
                  0,
                  0,
                  0,
                  0,
                  0,
                  signatures[0],
                ),
            );
            expect(await code.balanceOf(minterAddrs[0], tokenId)).to.eq(
              FREE_MINT_ALLOWED_QUANTITIES[0] - 1,
            );
            expect(await code.nextTokenId()).to.eq(tokenId.add(1));

            tokenId = await code.nextTokenId();
            await expect(
              await code
                .connect(minters[0])
                .preSaleMint(
                  1,
                  FREE_MINT_ALLOWED_QUANTITIES[0],
                  0,
                  0,
                  0,
                  0,
                  0,
                  signatures[0],
                ),
            );
            expect(await code.balanceOf(minterAddrs[0], tokenId)).to.eq(1);
            expect(await code.nextTokenId()).to.eq(tokenId.add(1));

            expect(await code.totalNumMintedTokens()).to.eq(
              totalNumMintedTokens.add(FREE_MINT_ALLOWED_QUANTITIES[0]),
            );
          });
        });

        context('who is eligible for whitelist mint', function () {
          const WHITELIST_MINT_ALLOWED_QUANTITIES = [5, 2, 3];

          let minters;
          let minterAddrs;
          const numMinters = WHITELIST_MINT_ALLOWED_QUANTITIES.length;

          let signatures;

          beforeEach(async function () {
            minters = accounts.slice(1);
            minterAddrs = await Promise.all(
              minters.map((minter) => minter.getAddress()),
            );

            signatures = await Promise.all(
              new Array(numMinters)
                .fill(null)
                .map((_, idx) =>
                  owner.signMessage(
                    ethers.utils.arrayify(
                      ethers.utils.solidityKeccak256(
                        ['address', 'uint256', 'uint256', 'uint256', 'uint256'],
                        [
                          minterAddrs[idx],
                          0,
                          WHITELIST_MINT_ALLOWED_QUANTITIES[idx],
                          0,
                          0,
                        ],
                      ),
                    ),
                  ),
                ),
            );
          });

          it('should revert if signature is invalid', async function () {
            await Promise.all(
              new Array(numMinters)
                .fill(null)
                .map((_, idx) =>
                  expect(
                    code
                      .connect(minters[idx])
                      .preSaleMint(
                        0,
                        0,
                        WHITELIST_MINT_ALLOWED_QUANTITIES[idx] + 1,
                        WHITELIST_MINT_ALLOWED_QUANTITIES[idx] + 1,
                        0,
                        0,
                        0,
                        signatures[idx],
                      ),
                  ).to.be.revertedWith('InvalidSignature'),
                ),
            );
            await Promise.all(
              new Array(numMinters)
                .fill(null)
                .map((_, idx) =>
                  expect(
                    code
                      .connect(accounts[0])
                      .preSaleMint(
                        0,
                        0,
                        WHITELIST_MINT_ALLOWED_QUANTITIES[idx],
                        WHITELIST_MINT_ALLOWED_QUANTITIES[idx],
                        0,
                        0,
                        0,
                        signatures[idx],
                      ),
                  ).to.be.revertedWith('InvalidSignature'),
                ),
            );
          });

          it('should revert if not enough quota', async function () {
            await Promise.all(
              new Array(numMinters).fill(null).map((_, idx) =>
                expect(
                  code
                    .connect(minters[idx])
                    .preSaleMint(
                      0,
                      0,
                      WHITELIST_MINT_ALLOWED_QUANTITIES[idx] + 1,
                      WHITELIST_MINT_ALLOWED_QUANTITIES[idx],
                      0,
                      0,
                      0,
                      signatures[idx],
                      {
                        value: PRICE_PER_TOKEN.mul(
                          WHITELIST_MINT_ALLOWED_QUANTITIES[idx] + 1,
                        ),
                      },
                    ),
                ).to.be.revertedWith('NotEnoughQuota'),
              ),
            );

            await new Array(numMinters)
              .fill(null)
              .reduce(async (prev, _, idx) => {
                await prev;
                await code
                  .connect(minters[idx])
                  .preSaleMint(
                    0,
                    0,
                    WHITELIST_MINT_ALLOWED_QUANTITIES[idx],
                    WHITELIST_MINT_ALLOWED_QUANTITIES[idx],
                    0,
                    0,
                    0,
                    signatures[idx],
                    {
                      value: PRICE_PER_TOKEN.mul(
                        WHITELIST_MINT_ALLOWED_QUANTITIES[idx],
                      ),
                    },
                  );
              }, Promise.resolve());

            await Promise.all(
              new Array(numMinters).fill(null).map((_, idx) =>
                expect(
                  code
                    .connect(minters[idx])
                    .preSaleMint(
                      0,
                      0,
                      1,
                      WHITELIST_MINT_ALLOWED_QUANTITIES[idx],
                      0,
                      0,
                      0,
                      signatures[idx],
                      {
                        value: PRICE_PER_TOKEN.mul(1),
                      },
                    ),
                ).to.be.revertedWith('NotEnoughQuota'),
              ),
            );
          });

          it('should revert if not enough ETH', async function () {
            await Promise.all(
              new Array(numMinters)
                .fill(null)
                .map((_, idx) =>
                  expect(
                    code
                      .connect(minters[idx])
                      .preSaleMint(
                        0,
                        0,
                        WHITELIST_MINT_ALLOWED_QUANTITIES[idx],
                        WHITELIST_MINT_ALLOWED_QUANTITIES[idx],
                        0,
                        0,
                        0,
                        signatures[idx],
                      ),
                  ).to.be.revertedWith('NotEnoughETH'),
                ),
            );
            await Promise.all(
              new Array(numMinters).fill(null).map((_, idx) =>
                expect(
                  code
                    .connect(minters[idx])
                    .preSaleMint(
                      0,
                      0,
                      WHITELIST_MINT_ALLOWED_QUANTITIES[idx],
                      WHITELIST_MINT_ALLOWED_QUANTITIES[idx],
                      0,
                      0,
                      0,
                      signatures[idx],
                      {
                        value: PRICE_PER_TOKEN.mul(
                          WHITELIST_MINT_ALLOWED_QUANTITIES[idx],
                        ).sub(1),
                      },
                    ),
                ).to.be.revertedWith('NotEnoughETH'),
              ),
            );
          });

          it('should mint successfully', async function () {
            const totalNumMintedTokens = await code.totalNumMintedTokens();
            const tokenId = await code.nextTokenId();

            await new Array(numMinters)
              .fill(null)
              .reduce(async (prev, _, idx) => {
                await prev;
                await expect(
                  await code
                    .connect(minters[idx])
                    .preSaleMint(
                      0,
                      0,
                      WHITELIST_MINT_ALLOWED_QUANTITIES[idx],
                      WHITELIST_MINT_ALLOWED_QUANTITIES[idx],
                      0,
                      0,
                      0,
                      signatures[idx],
                      {
                        value: PRICE_PER_TOKEN.mul(
                          WHITELIST_MINT_ALLOWED_QUANTITIES[idx],
                        ),
                      },
                    ),
                ).to.changeEtherBalance(
                  code,
                  PRICE_PER_TOKEN.mul(WHITELIST_MINT_ALLOWED_QUANTITIES[idx]),
                );
              }, Promise.resolve());

            await Promise.all(
              new Array(numMinters)
                .fill(null)
                .map(async (_, idx) =>
                  expect(
                    await code.balanceOf(minterAddrs[idx], tokenId.add(idx)),
                  ).to.eq(WHITELIST_MINT_ALLOWED_QUANTITIES[idx]),
                ),
            );
            expect(await code.totalNumMintedTokens()).to.eq(
              totalNumMintedTokens.add(
                WHITELIST_MINT_ALLOWED_QUANTITIES.reduce(
                  (prev, curr) => prev + curr,
                  0,
                ),
              ),
            );
            expect(await code.nextTokenId()).to.eq(tokenId.add(numMinters));
          });

          it('should mint the rest successfully', async function () {
            const totalNumMintedTokens = await code.totalNumMintedTokens();

            let tokenId;
            tokenId = await code.nextTokenId();
            await new Array(numMinters)
              .fill(null)
              .reduce(async (prev, _, idx) => {
                await prev;
                await expect(
                  await code
                    .connect(minters[idx])
                    .preSaleMint(
                      0,
                      0,
                      WHITELIST_MINT_ALLOWED_QUANTITIES[idx] - 1,
                      WHITELIST_MINT_ALLOWED_QUANTITIES[idx],
                      0,
                      0,
                      0,
                      signatures[idx],
                      {
                        value: PRICE_PER_TOKEN.mul(
                          WHITELIST_MINT_ALLOWED_QUANTITIES[idx] - 1,
                        ),
                      },
                    ),
                ).to.changeEtherBalance(
                  code,
                  PRICE_PER_TOKEN.mul(
                    WHITELIST_MINT_ALLOWED_QUANTITIES[idx] - 1,
                  ),
                );
              }, Promise.resolve());
            await Promise.all(
              new Array(numMinters)
                .fill(null)
                .map(async (_, idx) =>
                  expect(
                    await code.balanceOf(minterAddrs[idx], tokenId.add(idx)),
                  ).to.eq(WHITELIST_MINT_ALLOWED_QUANTITIES[idx] - 1),
                ),
            );
            expect(await code.nextTokenId()).to.eq(tokenId.add(numMinters));

            tokenId = await code.nextTokenId();
            await new Array(numMinters)
              .fill(null)
              .reduce(async (prev, _, idx) => {
                await prev;
                await expect(
                  await code
                    .connect(minters[idx])
                    .preSaleMint(
                      0,
                      0,
                      1,
                      WHITELIST_MINT_ALLOWED_QUANTITIES[idx],
                      0,
                      0,
                      0,
                      signatures[idx],
                      {
                        value: PRICE_PER_TOKEN.mul(1),
                      },
                    ),
                ).to.changeEtherBalance(code, PRICE_PER_TOKEN.mul(1));
              }, Promise.resolve());
            await Promise.all(
              new Array(numMinters)
                .fill(null)
                .map(async (_, idx) =>
                  expect(
                    await code.balanceOf(minterAddrs[idx], tokenId.add(idx)),
                  ).to.eq(1),
                ),
            );
            expect(await code.nextTokenId()).to.eq(tokenId.add(numMinters));

            expect(await code.totalNumMintedTokens()).to.eq(
              totalNumMintedTokens.add(
                WHITELIST_MINT_ALLOWED_QUANTITIES.reduce(
                  (prev, curr) => prev + curr,
                  0,
                ),
              ),
            );
          });
        });

        context('who is eligible for em whitelist mint', function () {
          let snapshotId;

          const EM_HOLDER_ADDRS = [
            '0xB893AE8A1824604F6df4Dfde52E2754921ba1A73',
            '0x83e88944c888965Be39b6bAb5c01d1B3C3828802',
            '0x570DC2127F98ce3cF841f3e0038a6257E31F6A4d',
          ];
          const SNAPSHOTED_EM_QUANTITIES = [20, 1, 2];
          const EM_WHITELIST_MINT_ALLOWED_QUANTITIES =
            SNAPSHOTED_EM_QUANTITIES.map((qty) =>
              qty >= 5 ? 3 : qty >= 2 ? 2 : 1,
            );

          let minters;
          let minterAddrs;
          const numMinters = EM_HOLDER_ADDRS.length;

          let signatures;

          beforeEach(async function () {
            snapshotId = await ethers.provider.send('evm_snapshot');

            await Promise.all(
              EM_HOLDER_ADDRS.map((addr) =>
                ethers.provider.send('hardhat_impersonateAccount', [addr]),
              ),
            );
            minters = await Promise.all(
              EM_HOLDER_ADDRS.map((addr) => ethers.getSigner(addr)),
            );
            minterAddrs = await Promise.all(
              minters.map((minter) => minter.getAddress()),
            );

            await Promise.all(
              minterAddrs.map((addr) =>
                ethers.provider.send('hardhat_setBalance', [
                  addr,
                  '0x100000000000000000000000',
                ]),
              ),
            );

            signatures = await Promise.all(
              new Array(numMinters)
                .fill(null)
                .map((_, idx) =>
                  owner.signMessage(
                    ethers.utils.arrayify(
                      ethers.utils.solidityKeccak256(
                        ['address', 'uint256', 'uint256', 'uint256', 'uint256'],
                        [
                          minterAddrs[idx],
                          0,
                          0,
                          EM_WHITELIST_MINT_ALLOWED_QUANTITIES[idx],
                          SNAPSHOTED_EM_QUANTITIES[idx],
                        ],
                      ),
                    ),
                  ),
                ),
            );
          });

          afterEach(async function () {
            await ethers.provider.send('evm_revert', [snapshotId]);
          });

          it('should revert if signature is invalid', async function () {
            await Promise.all(
              new Array(numMinters)
                .fill(null)
                .map((_, idx) =>
                  expect(
                    code
                      .connect(minters[idx])
                      .preSaleMint(
                        0,
                        0,
                        0,
                        0,
                        EM_WHITELIST_MINT_ALLOWED_QUANTITIES[idx] + 1,
                        EM_WHITELIST_MINT_ALLOWED_QUANTITIES[idx] + 1,
                        SNAPSHOTED_EM_QUANTITIES[idx],
                        signatures[idx],
                      ),
                  ).to.be.revertedWith('InvalidSignature'),
                ),
            );
            await Promise.all(
              new Array(numMinters)
                .fill(null)
                .map((_, idx) =>
                  expect(
                    code
                      .connect(accounts[0])
                      .preSaleMint(
                        0,
                        0,
                        0,
                        0,
                        EM_WHITELIST_MINT_ALLOWED_QUANTITIES[idx],
                        EM_WHITELIST_MINT_ALLOWED_QUANTITIES[idx],
                        SNAPSHOTED_EM_QUANTITIES[idx],
                        signatures[idx],
                      ),
                  ).to.be.revertedWith('InvalidSignature'),
                ),
            );
            await Promise.all(
              new Array(numMinters)
                .fill(null)
                .map((_, idx) =>
                  expect(
                    code
                      .connect(minters[idx])
                      .preSaleMint(
                        0,
                        0,
                        0,
                        0,
                        EM_WHITELIST_MINT_ALLOWED_QUANTITIES[idx],
                        EM_WHITELIST_MINT_ALLOWED_QUANTITIES[idx],
                        SNAPSHOTED_EM_QUANTITIES[idx] - 1,
                        signatures[idx],
                      ),
                  ).to.be.revertedWith('InvalidSignature'),
                ),
            );
          });

          it('should revert if not enough quota', async function () {
            await Promise.all(
              new Array(numMinters).fill(null).map((_, idx) =>
                expect(
                  code
                    .connect(minters[idx])
                    .preSaleMint(
                      0,
                      0,
                      0,
                      0,
                      EM_WHITELIST_MINT_ALLOWED_QUANTITIES[idx] + 1,
                      EM_WHITELIST_MINT_ALLOWED_QUANTITIES[idx],
                      SNAPSHOTED_EM_QUANTITIES[idx],
                      signatures[idx],
                      {
                        value: PRICE_PER_TOKEN.mul(
                          EM_WHITELIST_MINT_ALLOWED_QUANTITIES[idx] + 1,
                        ),
                      },
                    ),
                ).to.be.revertedWith('NotEnoughQuota'),
              ),
            );

            await new Array(numMinters)
              .fill(null)
              .reduce(async (prev, _, idx) => {
                await prev;
                await code
                  .connect(minters[idx])
                  .preSaleMint(
                    0,
                    0,
                    0,
                    0,
                    EM_WHITELIST_MINT_ALLOWED_QUANTITIES[idx],
                    EM_WHITELIST_MINT_ALLOWED_QUANTITIES[idx],
                    SNAPSHOTED_EM_QUANTITIES[idx],
                    signatures[idx],
                    {
                      value: PRICE_PER_TOKEN.mul(
                        EM_WHITELIST_MINT_ALLOWED_QUANTITIES[idx],
                      ),
                    },
                  );
              }, Promise.resolve());

            await Promise.all(
              new Array(numMinters).fill(null).map((_, idx) =>
                expect(
                  code
                    .connect(minters[idx])
                    .preSaleMint(
                      0,
                      0,
                      0,
                      0,
                      1,
                      EM_WHITELIST_MINT_ALLOWED_QUANTITIES[idx],
                      SNAPSHOTED_EM_QUANTITIES[idx],
                      signatures[idx],
                      {
                        value: PRICE_PER_TOKEN.mul(1),
                      },
                    ),
                ).to.be.revertedWith('NotEnoughQuota'),
              ),
            );
          });

          it('should revert if paper hand', async function () {
            const snapshotId = await ethers.provider.send('evm_snapshot');

            await em
              .connect(minters[0])
              .safeTransferFrom(minterAddrs[0], accountAddrs[0], 1, 1, []);
            await expect(
              code
                .connect(minters[0])
                .preSaleMint(
                  0,
                  0,
                  0,
                  0,
                  EM_WHITELIST_MINT_ALLOWED_QUANTITIES[0],
                  EM_WHITELIST_MINT_ALLOWED_QUANTITIES[0],
                  SNAPSHOTED_EM_QUANTITIES[0],
                  signatures[0],
                  {
                    value: PRICE_PER_TOKEN.mul(
                      EM_WHITELIST_MINT_ALLOWED_QUANTITIES[0],
                    ),
                  },
                ),
            ).to.be.revertedWith('PaperHand');

            await em
              .connect(minters[1])
              .safeTransferFrom(minterAddrs[1], accountAddrs[0], 0, 1, []);
            await expect(
              code
                .connect(minters[1])
                .preSaleMint(
                  0,
                  0,
                  0,
                  0,
                  EM_WHITELIST_MINT_ALLOWED_QUANTITIES[1],
                  EM_WHITELIST_MINT_ALLOWED_QUANTITIES[1],
                  SNAPSHOTED_EM_QUANTITIES[1],
                  signatures[1],
                  {
                    value: PRICE_PER_TOKEN.mul(
                      EM_WHITELIST_MINT_ALLOWED_QUANTITIES[1],
                    ),
                  },
                ),
            ).to.be.revertedWith('PaperHand');

            await ethers.provider.send('evm_revert', [snapshotId]);
          });

          it('should revert if not enough ETH', async function () {
            await Promise.all(
              new Array(numMinters)
                .fill(null)
                .map((_, idx) =>
                  expect(
                    code
                      .connect(minters[idx])
                      .preSaleMint(
                        0,
                        0,
                        0,
                        0,
                        EM_WHITELIST_MINT_ALLOWED_QUANTITIES[idx],
                        EM_WHITELIST_MINT_ALLOWED_QUANTITIES[idx],
                        SNAPSHOTED_EM_QUANTITIES[idx],
                        signatures[idx],
                      ),
                  ).to.be.revertedWith('NotEnoughETH'),
                ),
            );
            await Promise.all(
              new Array(numMinters).fill(null).map((_, idx) =>
                expect(
                  code
                    .connect(minters[idx])
                    .preSaleMint(
                      0,
                      0,
                      0,
                      0,
                      EM_WHITELIST_MINT_ALLOWED_QUANTITIES[idx],
                      EM_WHITELIST_MINT_ALLOWED_QUANTITIES[idx],
                      SNAPSHOTED_EM_QUANTITIES[idx],
                      signatures[idx],
                      {
                        value: PRICE_PER_TOKEN.mul(
                          EM_WHITELIST_MINT_ALLOWED_QUANTITIES[idx],
                        ).sub(1),
                      },
                    ),
                ).to.be.revertedWith('NotEnoughETH'),
              ),
            );
          });

          it('should mint successfully', async function () {
            const totalNumMintedTokens = await code.totalNumMintedTokens();
            const tokenId = await code.nextTokenId();

            await new Array(numMinters)
              .fill(null)
              .reduce(async (prev, _, idx) => {
                await prev;
                await expect(
                  await code
                    .connect(minters[idx])
                    .preSaleMint(
                      0,
                      0,
                      0,
                      0,
                      EM_WHITELIST_MINT_ALLOWED_QUANTITIES[idx],
                      EM_WHITELIST_MINT_ALLOWED_QUANTITIES[idx],
                      SNAPSHOTED_EM_QUANTITIES[idx],
                      signatures[idx],
                      {
                        value: PRICE_PER_TOKEN.mul(
                          EM_WHITELIST_MINT_ALLOWED_QUANTITIES[idx],
                        ),
                      },
                    ),
                ).to.changeEtherBalance(
                  code,
                  PRICE_PER_TOKEN.mul(
                    EM_WHITELIST_MINT_ALLOWED_QUANTITIES[idx],
                  ),
                );
              }, Promise.resolve());

            await Promise.all(
              new Array(numMinters)
                .fill(null)
                .map(async (_, idx) =>
                  expect(
                    await code.balanceOf(minterAddrs[idx], tokenId.add(idx)),
                  ).to.be.eq(EM_WHITELIST_MINT_ALLOWED_QUANTITIES[idx]),
                ),
            );
            expect(await code.totalNumMintedTokens()).to.eq(
              totalNumMintedTokens.add(
                EM_WHITELIST_MINT_ALLOWED_QUANTITIES.reduce(
                  (prev, curr) => prev + curr,
                  0,
                ),
              ),
            );
            expect(await code.nextTokenId()).to.eq(tokenId.add(numMinters));
          });

          it('should mint the rest successfully', async function () {
            const totalNumMintedTokens = await code.totalNumMintedTokens();

            let tokenId;
            tokenId = await code.nextTokenId();
            await expect(
              await code
                .connect(minters[0])
                .preSaleMint(
                  0,
                  0,
                  0,
                  0,
                  EM_WHITELIST_MINT_ALLOWED_QUANTITIES[0] - 1,
                  EM_WHITELIST_MINT_ALLOWED_QUANTITIES[0],
                  SNAPSHOTED_EM_QUANTITIES[0],
                  signatures[0],
                  {
                    value: PRICE_PER_TOKEN.mul(
                      EM_WHITELIST_MINT_ALLOWED_QUANTITIES[0] - 1,
                    ),
                  },
                ),
            );
            expect(await code.balanceOf(minterAddrs[0], tokenId)).to.eq(
              EM_WHITELIST_MINT_ALLOWED_QUANTITIES[0] - 1,
            );
            expect(await code.nextTokenId()).to.eq(tokenId.add(1));

            tokenId = await code.nextTokenId();
            await expect(
              await code
                .connect(minters[0])
                .preSaleMint(
                  0,
                  0,
                  0,
                  0,
                  1,
                  EM_WHITELIST_MINT_ALLOWED_QUANTITIES[0],
                  SNAPSHOTED_EM_QUANTITIES[0],
                  signatures[0],
                  {
                    value: PRICE_PER_TOKEN.mul(1),
                  },
                ),
            );
            expect(await code.balanceOf(minterAddrs[0], tokenId)).to.eq(1);
            expect(await code.nextTokenId()).to.eq(tokenId.add(1));

            expect(await code.totalNumMintedTokens()).to.eq(
              totalNumMintedTokens.add(EM_WHITELIST_MINT_ALLOWED_QUANTITIES[0]),
            );
          });
        });

        context(
          'who is eligible for free mint and whitelist mint',
          function () {
            const FREE_MINT_ALLOWED_QUANTITIES = [2, 1, 3];
            const WHITELIST_MINT_ALLOWED_QUANTITIES = [5, 2, 3];

            let minters;
            let minterAddrs;
            const numMinters = FREE_MINT_ALLOWED_QUANTITIES.length;

            let signatures;

            beforeEach(async function () {
              minters = accounts.slice(1);
              minterAddrs = await Promise.all(
                minters.map((minter) => minter.getAddress()),
              );

              signatures = await Promise.all(
                new Array(numMinters)
                  .fill(null)
                  .map((_, idx) =>
                    owner.signMessage(
                      ethers.utils.arrayify(
                        ethers.utils.solidityKeccak256(
                          [
                            'address',
                            'uint256',
                            'uint256',
                            'uint256',
                            'uint256',
                          ],
                          [
                            minterAddrs[idx],
                            FREE_MINT_ALLOWED_QUANTITIES[idx],
                            WHITELIST_MINT_ALLOWED_QUANTITIES[idx],
                            0,
                            0,
                          ],
                        ),
                      ),
                    ),
                  ),
              );
            });

            it('should revert if signature is invalid', async function () {
              await Promise.all(
                new Array(numMinters)
                  .fill(null)
                  .map((_, idx) =>
                    expect(
                      code
                        .connect(minters[idx])
                        .preSaleMint(
                          FREE_MINT_ALLOWED_QUANTITIES[idx] + 1,
                          FREE_MINT_ALLOWED_QUANTITIES[idx] + 1,
                          0,
                          WHITELIST_MINT_ALLOWED_QUANTITIES[idx],
                          0,
                          0,
                          0,
                          signatures[idx],
                        ),
                    ).to.be.revertedWith('InvalidSignature'),
                  ),
              );
              await Promise.all(
                new Array(numMinters).fill(null).map((_, idx) =>
                  expect(
                    code
                      .connect(minters[idx])
                      .preSaleMint(
                        0,
                        FREE_MINT_ALLOWED_QUANTITIES[idx],
                        WHITELIST_MINT_ALLOWED_QUANTITIES[idx] + 1,
                        WHITELIST_MINT_ALLOWED_QUANTITIES[idx] + 1,
                        0,
                        0,
                        0,
                        signatures[idx],
                        {
                          value: PRICE_PER_TOKEN.mul(
                            WHITELIST_MINT_ALLOWED_QUANTITIES[idx] + 1,
                          ),
                        },
                      ),
                  ).to.be.revertedWith('InvalidSignature'),
                ),
              );
              await Promise.all(
                new Array(numMinters).fill(null).map((_, idx) =>
                  expect(
                    code
                      .connect(accounts[0])
                      .preSaleMint(
                        FREE_MINT_ALLOWED_QUANTITIES[idx],
                        FREE_MINT_ALLOWED_QUANTITIES[idx],
                        WHITELIST_MINT_ALLOWED_QUANTITIES[idx],
                        WHITELIST_MINT_ALLOWED_QUANTITIES[idx],
                        0,
                        0,
                        0,
                        signatures[idx],
                        {
                          value: PRICE_PER_TOKEN.mul(
                            WHITELIST_MINT_ALLOWED_QUANTITIES[idx],
                          ),
                        },
                      ),
                  ).to.be.revertedWith('InvalidSignature'),
                ),
              );
            });

            it('should revert if not enough quota', async function () {
              await Promise.all(
                new Array(numMinters)
                  .fill(null)
                  .map((_, idx) =>
                    expect(
                      code
                        .connect(minters[idx])
                        .preSaleMint(
                          FREE_MINT_ALLOWED_QUANTITIES[idx] + 1,
                          FREE_MINT_ALLOWED_QUANTITIES[idx],
                          0,
                          WHITELIST_MINT_ALLOWED_QUANTITIES[idx],
                          0,
                          0,
                          0,
                          signatures[idx],
                        ),
                    ).to.be.revertedWith('NotEnoughQuota'),
                  ),
              );
              await Promise.all(
                new Array(numMinters).fill(null).map((_, idx) =>
                  expect(
                    code
                      .connect(minters[idx])
                      .preSaleMint(
                        0,
                        FREE_MINT_ALLOWED_QUANTITIES[idx],
                        WHITELIST_MINT_ALLOWED_QUANTITIES[idx] + 1,
                        WHITELIST_MINT_ALLOWED_QUANTITIES[idx],
                        0,
                        0,
                        0,
                        signatures[idx],
                        {
                          value: PRICE_PER_TOKEN.mul(
                            WHITELIST_MINT_ALLOWED_QUANTITIES[idx] + 1,
                          ),
                        },
                      ),
                  ).to.be.revertedWith('NotEnoughQuota'),
                ),
              );

              await new Array(numMinters)
                .fill(null)
                .reduce(async (prev, _, idx) => {
                  await prev;
                  await code
                    .connect(minters[idx])
                    .preSaleMint(
                      FREE_MINT_ALLOWED_QUANTITIES[idx],
                      FREE_MINT_ALLOWED_QUANTITIES[idx],
                      WHITELIST_MINT_ALLOWED_QUANTITIES[idx],
                      WHITELIST_MINT_ALLOWED_QUANTITIES[idx],
                      0,
                      0,
                      0,
                      signatures[idx],
                      {
                        value: PRICE_PER_TOKEN.mul(
                          WHITELIST_MINT_ALLOWED_QUANTITIES[idx],
                        ),
                      },
                    );
                }, Promise.resolve());

              await Promise.all(
                new Array(numMinters)
                  .fill(null)
                  .map((_, idx) =>
                    expect(
                      code
                        .connect(minters[idx])
                        .preSaleMint(
                          1,
                          FREE_MINT_ALLOWED_QUANTITIES[idx],
                          0,
                          WHITELIST_MINT_ALLOWED_QUANTITIES[idx],
                          0,
                          0,
                          0,
                          signatures[idx],
                        ),
                    ).to.be.revertedWith('NotEnoughQuota'),
                  ),
              );
              await Promise.all(
                new Array(numMinters).fill(null).map((_, idx) =>
                  expect(
                    code
                      .connect(minters[idx])
                      .preSaleMint(
                        0,
                        FREE_MINT_ALLOWED_QUANTITIES[idx],
                        1,
                        WHITELIST_MINT_ALLOWED_QUANTITIES[idx],
                        0,
                        0,
                        0,
                        signatures[idx],
                        {
                          value: PRICE_PER_TOKEN.mul(1),
                        },
                      ),
                  ).to.be.revertedWith('NotEnoughQuota'),
                ),
              );
            });

            it('should revert if not enough ETH', async function () {
              await Promise.all(
                new Array(numMinters)
                  .fill(null)
                  .map((_, idx) =>
                    expect(
                      code
                        .connect(minters[idx])
                        .preSaleMint(
                          FREE_MINT_ALLOWED_QUANTITIES[idx],
                          FREE_MINT_ALLOWED_QUANTITIES[idx],
                          WHITELIST_MINT_ALLOWED_QUANTITIES[idx],
                          WHITELIST_MINT_ALLOWED_QUANTITIES[idx],
                          0,
                          0,
                          0,
                          signatures[idx],
                        ),
                    ).to.be.revertedWith('NotEnoughETH'),
                  ),
              );
              await Promise.all(
                new Array(numMinters).fill(null).map((_, idx) =>
                  expect(
                    code
                      .connect(minters[idx])
                      .preSaleMint(
                        FREE_MINT_ALLOWED_QUANTITIES[idx],
                        FREE_MINT_ALLOWED_QUANTITIES[idx],
                        WHITELIST_MINT_ALLOWED_QUANTITIES[idx],
                        WHITELIST_MINT_ALLOWED_QUANTITIES[idx],
                        0,
                        0,
                        0,
                        signatures[idx],
                        {
                          value: PRICE_PER_TOKEN.mul(
                            WHITELIST_MINT_ALLOWED_QUANTITIES[idx],
                          ).sub(1),
                        },
                      ),
                  ).to.be.revertedWith('NotEnoughETH'),
                ),
              );
            });

            it('should mint successfully', async function () {
              const totalNumMintedTokens = await code.totalNumMintedTokens();
              const tokenId = await code.nextTokenId();

              await new Array(numMinters)
                .fill(null)
                .reduce(async (prev, _, idx) => {
                  await prev;
                  await expect(
                    await code
                      .connect(minters[idx])
                      .preSaleMint(
                        FREE_MINT_ALLOWED_QUANTITIES[idx],
                        FREE_MINT_ALLOWED_QUANTITIES[idx],
                        WHITELIST_MINT_ALLOWED_QUANTITIES[idx],
                        WHITELIST_MINT_ALLOWED_QUANTITIES[idx],
                        0,
                        0,
                        0,
                        signatures[idx],
                        {
                          value: PRICE_PER_TOKEN.mul(
                            WHITELIST_MINT_ALLOWED_QUANTITIES[idx],
                          ),
                        },
                      ),
                  ).to.changeEtherBalance(
                    code,
                    PRICE_PER_TOKEN.mul(WHITELIST_MINT_ALLOWED_QUANTITIES[idx]),
                  );
                }, Promise.resolve());

              await Promise.all(
                new Array(numMinters)
                  .fill(null)
                  .map(async (_, idx) =>
                    expect(
                      await code.balanceOf(minterAddrs[idx], tokenId.add(idx)),
                    ).to.eq(
                      FREE_MINT_ALLOWED_QUANTITIES[idx] +
                        WHITELIST_MINT_ALLOWED_QUANTITIES[idx],
                    ),
                  ),
              );
              expect(await code.totalNumMintedTokens()).to.eq(
                totalNumMintedTokens
                  .add(
                    FREE_MINT_ALLOWED_QUANTITIES.reduce(
                      (prev, curr) => prev + curr,
                      0,
                    ),
                  )
                  .add(
                    WHITELIST_MINT_ALLOWED_QUANTITIES.reduce(
                      (prev, curr) => prev + curr,
                      0,
                    ),
                  ),
              );
              expect(await code.nextTokenId()).to.eq(tokenId.add(numMinters));
            });

            it('should mint the rest successfully', async function () {
              const totalNumMintedTokens = await code.totalNumMintedTokens();

              let tokenId;
              tokenId = await code.nextTokenId();
              await new Array(numMinters)
                .fill(null)
                .reduce(async (prev, _, idx) => {
                  await prev;
                  await expect(
                    await code
                      .connect(minters[idx])
                      .preSaleMint(
                        FREE_MINT_ALLOWED_QUANTITIES[idx],
                        FREE_MINT_ALLOWED_QUANTITIES[idx],
                        WHITELIST_MINT_ALLOWED_QUANTITIES[idx] - 1,
                        WHITELIST_MINT_ALLOWED_QUANTITIES[idx],
                        0,
                        0,
                        0,
                        signatures[idx],
                        {
                          value: PRICE_PER_TOKEN.mul(
                            WHITELIST_MINT_ALLOWED_QUANTITIES[idx] - 1,
                          ),
                        },
                      ),
                  ).to.changeEtherBalance(
                    code,
                    PRICE_PER_TOKEN.mul(
                      WHITELIST_MINT_ALLOWED_QUANTITIES[idx] - 1,
                    ),
                  );
                }, Promise.resolve());
              await Promise.all(
                new Array(numMinters)
                  .fill(null)
                  .map(async (_, idx) =>
                    expect(
                      await code.balanceOf(minterAddrs[idx], tokenId.add(idx)),
                    ).to.eq(
                      FREE_MINT_ALLOWED_QUANTITIES[idx] +
                        WHITELIST_MINT_ALLOWED_QUANTITIES[idx] -
                        1,
                    ),
                  ),
              );
              expect(await code.nextTokenId()).to.eq(tokenId.add(numMinters));

              tokenId = await code.nextTokenId();
              await new Array(numMinters)
                .fill(null)
                .reduce(async (prev, _, idx) => {
                  await prev;
                  await expect(
                    await code
                      .connect(minters[idx])
                      .preSaleMint(
                        0,
                        FREE_MINT_ALLOWED_QUANTITIES[idx],
                        1,
                        WHITELIST_MINT_ALLOWED_QUANTITIES[idx],
                        0,
                        0,
                        0,
                        signatures[idx],
                        {
                          value: PRICE_PER_TOKEN.mul(1),
                        },
                      ),
                  ).to.changeEtherBalance(code, PRICE_PER_TOKEN.mul(1));
                }, Promise.resolve());
              await Promise.all(
                new Array(numMinters)
                  .fill(null)
                  .map(async (_, idx) =>
                    expect(
                      await code.balanceOf(minterAddrs[idx], tokenId.add(idx)),
                    ).to.eq(1),
                  ),
              );
              expect(await code.nextTokenId()).to.eq(tokenId.add(numMinters));

              expect(await code.totalNumMintedTokens()).to.eq(
                totalNumMintedTokens
                  .add(
                    FREE_MINT_ALLOWED_QUANTITIES.reduce(
                      (prev, curr) => prev + curr,
                      0,
                    ),
                  )
                  .add(
                    WHITELIST_MINT_ALLOWED_QUANTITIES.reduce(
                      (prev, curr) => prev + curr,
                      0,
                    ),
                  ),
              );
            });
          },
        );

        // TODO:
        context(
          'who is eligible for free mint and em whitelist mint',
          function () {},
        );

        // TODO:
        context(
          'who is eligible for whitelist mint and em whitelist mint',
          function () {},
        );

        // TODO:
        context(
          'who is eligible for free mint, whitelist mint and em whitelist mint',
          function () {},
        );
      });
    });
  });

  describe('#publicSaleMint', function () {
    it('should revert if not from EOA', async function () {
      await expect(
        hacker.connect(accounts[0]).hackPublicSaleMint(0, 0, []),
      ).to.be.revertedWith('NotEOA');
    });

    context('when public sale mint time is not set', function () {
      it('should revert', async function () {
        await expect(
          code.connect(accounts[0]).publicSaleMint(0, 0, []),
        ).to.be.revertedWith('NotStarted');
      });
    });

    context('when public sale mint time is set', function () {
      let snapshotId;

      beforeEach(async function () {
        snapshotId = await ethers.provider.send('evm_snapshot');

        await code
          .connect(owner)
          .setPublicSaleMintTime(
            PUBLIC_SALE_MINT_START_TIME,
            PUBLIC_SALE_MINT_END_TIME,
          );
      });

      afterEach(async function () {
        await ethers.provider.send('evm_revert', [snapshotId]);
      });

      context('when public sale mint has not started', function () {
        it('should revert', async function () {
          await expect(
            code.connect(accounts[0]).publicSaleMint(0, 0, []),
          ).to.be.revertedWith('NotStarted');
        });
      });

      context('when public sale mint has ended', function () {
        let snapshotId;

        beforeEach(async function () {
          snapshotId = await ethers.provider.send('evm_snapshot');

          const nextBlockTime = PUBLIC_SALE_MINT_END_TIME + 1;
          await ethers.provider.send('evm_setNextBlockTimestamp', [
            nextBlockTime,
          ]);
          await ethers.provider.send('evm_mine');
        });

        afterEach(async function () {
          await ethers.provider.send('evm_revert', [snapshotId]);
        });

        it('should revert', async function () {
          await expect(
            code.connect(accounts[0]).publicSaleMint(0, 0, []),
          ).to.be.revertedWith('Ended');
        });
      });

      context('when public sale mint has started and not ended', function () {
        let snapshotId;

        const PUBLIC_MINT_QUANTITIES = [1, 3, 2];

        let minters;
        let minterAddrs;
        const numMinters = PUBLIC_MINT_QUANTITIES.length;

        let publicMintTickets;
        let signatures;

        beforeEach(async function () {
          snapshotId = await ethers.provider.send('evm_snapshot');

          const nextBlockTime = PUBLIC_SALE_MINT_START_TIME + 1;
          await ethers.provider.send('evm_setNextBlockTimestamp', [
            nextBlockTime,
          ]);
          await ethers.provider.send('evm_mine');
        });

        afterEach(async function () {
          await ethers.provider.send('evm_revert', [snapshotId]);
        });

        beforeEach(async function () {
          minters = accounts.slice(1);
          minterAddrs = await Promise.all(
            minters.map((minter) => minter.getAddress()),
          );

          publicMintTickets = new Array(numMinters).fill(null).map(() => {
            const uuid = crypto.randomUUID();
            const uuidHex = `0x${uuid.split('-').join('')}`;
            const ticket = ethers.BigNumber.from(uuidHex);
            return ticket;
          });
          signatures = await Promise.all(
            new Array(numMinters)
              .fill(null)
              .map((_, idx) =>
                owner.signMessage(
                  ethers.utils.arrayify(
                    ethers.utils.solidityKeccak256(
                      ['address', 'uint256'],
                      [minterAddrs[idx], publicMintTickets[idx]],
                    ),
                  ),
                ),
              ),
          );
        });

        it('should revert if signature is invalid', async function () {
          await Promise.all(
            new Array(numMinters)
              .fill(null)
              .map((_, idx) =>
                expect(
                  code
                    .connect(minters[idx])
                    .publicSaleMint(
                      PUBLIC_MINT_QUANTITIES[idx],
                      publicMintTickets[idx].add(1),
                      signatures[idx],
                    ),
                ).to.be.revertedWith('InvalidSignature'),
              ),
          );
        });

        it('should revert if ticket has been used', async function () {
          await new Array(numMinters)
            .fill(null)
            .reduce(async (prev, _, idx) => {
              await prev;
              await code
                .connect(minters[idx])
                .publicSaleMint(
                  PUBLIC_MINT_QUANTITIES[idx],
                  publicMintTickets[idx],
                  signatures[idx],
                  {
                    value: PRICE_PER_TOKEN.mul(PUBLIC_MINT_QUANTITIES[idx]),
                  },
                );
            }, Promise.resolve());

          await Promise.all(
            new Array(numMinters).fill(null).map((_, idx) =>
              expect(
                code
                  .connect(minters[idx])
                  .publicSaleMint(
                    PUBLIC_MINT_QUANTITIES[idx],
                    publicMintTickets[idx],
                    signatures[idx],
                    {
                      value: PRICE_PER_TOKEN.mul(PUBLIC_MINT_QUANTITIES[idx]),
                    },
                  ),
              ).to.be.revertedWith('TicketUsed'),
            ),
          );
        });

        it('should revert if mint too many at once', async function () {
          await Promise.all(
            new Array(numMinters).fill(null).map((_, idx) =>
              expect(
                code
                  .connect(minters[idx])
                  .publicSaleMint(
                    MAX_NUM_MINTS_PER_TX + 1,
                    publicMintTickets[idx],
                    signatures[idx],
                    {
                      value: PRICE_PER_TOKEN.mul(MAX_NUM_MINTS_PER_TX + 1),
                    },
                  ),
              ).to.be.revertedWith('MintTooManyAtOnce'),
            ),
          );
        });

        it.skip('should revert if sold out', async function () {
          publicMintTickets = new Array(
            Number(MAX_TOTAL_SUPPLY.add(1).toString()),
          )
            .fill(null)
            .map(() => {
              const uuid = crypto.randomUUID();
              const uuidHex = `0x${uuid.split('-').join('')}`;
              const ticket = ethers.BigNumber.from(uuidHex);
              return ticket;
            });
          signatures = await Promise.all(
            new Array(Number(MAX_TOTAL_SUPPLY.add(1).toString()))
              .fill(null)
              .map((_, idx) =>
                owner.signMessage(
                  ethers.utils.arrayify(
                    ethers.utils.solidityKeccak256(
                      ['address', 'uint256'],
                      [minterAddrs[idx % numMinters], publicMintTickets[idx]],
                    ),
                  ),
                ),
              ),
          );

          await new Array(Number(MAX_TOTAL_SUPPLY.add(1).toString()))
            .fill(null)
            .reduce(async (prev, _, idx) => {
              await prev;
              const totalNumMintedTokens = await code.totalNumMintedTokens();
              if (totalNumMintedTokens.eq(MAX_TOTAL_SUPPLY)) {
                await expect(
                  code
                    .connect(minters[idx % numMinters])
                    .publicSaleMint(
                      1,
                      publicMintTickets[idx],
                      signatures[idx],
                      {
                        value: PRICE_PER_TOKEN.mul(1),
                      },
                    ),
                ).to.be.revertedWith('SoldOut');
                return;
              }
              await code
                .connect(minters[idx % numMinters])
                .publicSaleMint(1, publicMintTickets[idx], signatures[idx], {
                  value: PRICE_PER_TOKEN.mul(1),
                });
            }, Promise.resolve());
        });

        it('should revert if not enough ETH', async function () {
          await Promise.all(
            new Array(numMinters)
              .fill(null)
              .map((_, idx) =>
                expect(
                  code
                    .connect(minters[idx])
                    .publicSaleMint(
                      PUBLIC_MINT_QUANTITIES[idx],
                      publicMintTickets[idx],
                      signatures[idx],
                    ),
                ).to.be.revertedWith('NotEnoughETH'),
              ),
          );
          await Promise.all(
            new Array(numMinters).fill(null).map((_, idx) =>
              expect(
                code
                  .connect(minters[idx])
                  .publicSaleMint(
                    PUBLIC_MINT_QUANTITIES[idx],
                    publicMintTickets[idx],
                    signatures[idx],
                    {
                      value: PRICE_PER_TOKEN.mul(
                        PUBLIC_MINT_QUANTITIES[idx],
                      ).sub(1),
                    },
                  ),
              ).to.be.revertedWith('NotEnoughETH'),
            ),
          );
        });

        it('should mint successfully', async function () {
          const tokenId = await code.nextTokenId();

          await new Array(numMinters)
            .fill(null)
            .reduce(async (prev, _, idx) => {
              await prev;
              await code
                .connect(minters[idx])
                .publicSaleMint(
                  PUBLIC_MINT_QUANTITIES[idx],
                  publicMintTickets[idx],
                  signatures[idx],
                  {
                    value: PRICE_PER_TOKEN.mul(PUBLIC_MINT_QUANTITIES[idx]),
                  },
                );
            }, Promise.resolve());

          await Promise.all(
            new Array(numMinters)
              .fill(null)
              .map(async (_, idx) =>
                expect(
                  await code.balanceOf(minterAddrs[idx], tokenId.add(idx)),
                ).to.be.eq(PUBLIC_MINT_QUANTITIES[idx]),
              ),
          );
        });
      });
    });
  });

  describe('#migrate', function () {
    let snapshotId;

    let shell;

    const PUBLIC_MINT_QUANTITIES = [1, 3, 2, 3];
    const PUBLIC_MINT_TICKETS = new Array(PUBLIC_MINT_QUANTITIES.length)
      .fill(null)
      .map((_, idx) => idx);

    let minters;
    let minterAddrs;
    const numMinters = 3;

    let signatures;

    let codeTokenIds;

    beforeEach(async function () {
      snapshotId = await ethers.provider.send('evm_snapshot');

      const Shell = await ethers.getContractFactory('Shell');
      shell = await Shell.deploy();
      await shell.deployed();

      await shell.setAuthorized(code.address, true);

      await code.connect(owner).setShell(shell.address);
      await code
        .connect(owner)
        .setPublicSaleMintTime(
          PUBLIC_SALE_MINT_START_TIME,
          PUBLIC_SALE_MINT_END_TIME,
        );

      const nextBlockTime = PUBLIC_SALE_MINT_START_TIME + 1;
      await ethers.provider.send('evm_setNextBlockTimestamp', [nextBlockTime]);
      await ethers.provider.send('evm_mine');

      minters = accounts.slice(1);
      minterAddrs = await Promise.all(
        minters.map((minter) => minter.getAddress()),
      );

      signatures = await Promise.all(
        PUBLIC_MINT_QUANTITIES.map((_, idx) =>
          owner.signMessage(
            ethers.utils.arrayify(
              ethers.utils.solidityKeccak256(
                ['address', 'uint256'],
                [minterAddrs[idx % numMinters], PUBLIC_MINT_TICKETS[idx]],
              ),
            ),
          ),
        ),
      );

      const startTokenId = await code.nextTokenId();
      await Promise.all(
        PUBLIC_MINT_QUANTITIES.map((_, idx) =>
          code
            .connect(minters[idx % numMinters])
            .publicSaleMint(
              PUBLIC_MINT_QUANTITIES[idx],
              PUBLIC_MINT_TICKETS[idx],
              signatures[idx],
              {
                value: PRICE_PER_TOKEN.mul(PUBLIC_MINT_QUANTITIES[idx]),
              },
            ),
        ),
      );
      codeTokenIds = new Array(PUBLIC_MINT_QUANTITIES.length)
        .fill(null)
        .map((_, idx) => startTokenId.add(idx));
    });

    afterEach(async function () {
      await ethers.provider.send('evm_revert', [snapshotId]);
    });

    it('should revert if not from EOA', async function () {
      await expect(
        hacker.connect(accounts[0]).hackMigrate([], []),
      ).to.be.revertedWith('NotEOA');
    });

    context('when migration time is not set', function () {
      it('should revert', async function () {
        await expect(
          code.connect(accounts[0]).migrate([], []),
        ).to.be.revertedWith('NotStarted');
      });
    });

    context('when migration time is set', function () {
      let snapshotId;

      beforeEach(async function () {
        snapshotId = await ethers.provider.send('evm_snapshot');

        await code
          .connect(owner)
          .setMigrationTime(MIGRATION_START_TIME, MIGRATION_END_TIME);
      });

      afterEach(async function () {
        await ethers.provider.send('evm_revert', [snapshotId]);
      });

      context('when migration has not started', function () {
        it('should revert', async function () {
          await expect(
            code.connect(accounts[0]).migrate([], []),
          ).to.be.revertedWith('NotStarted');
        });
      });

      context('when migration has ended', function () {
        let snapshotId;

        beforeEach(async function () {
          snapshotId = await ethers.provider.send('evm_snapshot');

          const nextBlockTime = MIGRATION_END_TIME + 1;
          await ethers.provider.send('evm_setNextBlockTimestamp', [
            nextBlockTime,
          ]);
          await ethers.provider.send('evm_mine');
        });

        afterEach(async function () {
          await ethers.provider.send('evm_revert', [snapshotId]);
        });

        it('should revert', async function () {
          await expect(
            code.connect(accounts[0]).migrate([], []),
          ).to.be.revertedWith('Ended');
        });
      });

      context('when migration has started and not ended', function () {
        let snapshotId;

        beforeEach(async function () {
          snapshotId = await ethers.provider.send('evm_snapshot');

          const nextBlockTime = MIGRATION_START_TIME + 1;
          await ethers.provider.send('evm_setNextBlockTimestamp', [
            nextBlockTime,
          ]);
          await ethers.provider.send('evm_mine');
        });

        afterEach(async function () {
          await ethers.provider.send('evm_revert', [snapshotId]);
        });

        context('who has no codes', function () {
          it('should revert', async function () {
            await expect(
              code.connect(accounts[0]).migrate([1], [1]),
            ).to.be.revertedWith('ERC1155: burn amount exceeds balance');
          });
        });

        context('who has codes', function () {
          it('should migrate successfully', async function () {
            const balances = await Promise.all(
              PUBLIC_MINT_QUANTITIES.map((_, idx) =>
                code.balanceOf(
                  minterAddrs[idx % numMinters],
                  codeTokenIds[idx],
                ),
              ),
            );
            await Promise.all(
              new Array(numMinters).fill(null).map((_, idx) =>
                code.connect(minters[idx]).migrate(
                  new Array(
                    Math.ceil(PUBLIC_MINT_QUANTITIES.length / numMinters),
                  )
                    .fill(null)
                    .reduce(
                      (prev, _, i) =>
                        i * numMinters + idx < PUBLIC_MINT_QUANTITIES.length
                          ? [...prev, codeTokenIds[i * numMinters + idx]]
                          : prev,
                      [],
                    ),
                  new Array(
                    Math.ceil(PUBLIC_MINT_QUANTITIES.length / numMinters),
                  )
                    .fill(null)
                    .reduce(
                      (prev, _, i) =>
                        i * numMinters + idx < PUBLIC_MINT_QUANTITIES.length
                          ? [
                              ...prev,
                              PUBLIC_MINT_QUANTITIES[i * numMinters + idx],
                            ]
                          : prev,
                      [],
                    ),
                ),
              ),
            );
            await Promise.all(
              PUBLIC_MINT_QUANTITIES.map(async (_, idx) => {
                expect(
                  await code.balanceOf(
                    minterAddrs[idx % numMinters],
                    codeTokenIds[idx],
                  ),
                ).to.be.eq(balances[idx] - PUBLIC_MINT_QUANTITIES[idx]);
              }),
            );
            await Promise.all(
              new Array(numMinters).fill(null).map(async (_, idx) => {
                expect(await shell.balanceOf(minterAddrs[idx])).to.be.eq(
                  new Array(
                    Math.ceil(PUBLIC_MINT_QUANTITIES.length / numMinters),
                  )
                    .fill(null)
                    .reduce(
                      (prev, _, i) =>
                        prev +
                        (i * numMinters + idx < PUBLIC_MINT_QUANTITIES.length
                          ? PUBLIC_MINT_QUANTITIES[i * numMinters + idx]
                          : 0),
                      0,
                    ),
                );
              }),
            );
          });
        });
      });
    });
  });
});
