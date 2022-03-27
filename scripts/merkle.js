const { MerkleTree } = require('merkletreejs');
const { ethers } = require('ethers');

(async () => {
  const addressToFreeMintData = {
    '0x8EB82Be5fc2e64e0b57cEb639dF68610b29864E6': {
      quantity: 3,
    },
  };
  const addressToWhitelistMintData = {};
  const addressToEmWhitelistMintData = {};

  const freeMintAddressToMerkleLeaf = Object.entries(
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
    Object.values(freeMintAddressToMerkleLeaf).map(ethers.utils.keccak256),
    ethers.utils.keccak256,
    {
      sort: true,
    },
  );
  const freeMintAddressToMerkleProofs = Object.entries(
    freeMintAddressToMerkleLeaf,
  ).reduce(
    (prev, [addr, leaf]) => ({
      ...prev,
      [addr]: freeMintMerkleTree.getProof(ethers.utils.keccak256(leaf)),
    }),
    {},
  );
  console.log(
    freeMintMerkleTree.verify(
      freeMintAddressToMerkleProofs[
        '0x8EB82Be5fc2e64e0b57cEb639dF68610b29864E6'
      ],
      ethers.utils.keccak256(
        freeMintAddressToMerkleLeaf[
          '0x8EB82Be5fc2e64e0b57cEb639dF68610b29864E6'
        ],
      ),
      freeMintMerkleTree.getRoot(),
    ),
  );
})();
