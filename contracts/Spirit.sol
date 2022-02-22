//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.9;

/*@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@%#(//,,           .,,/(#%&@@@@@@@@@@
@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@#.                          ,%@@@@@@@@@@@@@@@@@
@@@@@@@@@@@@@@@@@@@@@@@@@@@#            .              %@@@@@@@@@@@@@@@@@@@@@@@@
@@@@@@@@@@@@@@@@@@@@@@@,                ,         ,@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
@@@@@@@@@@@@@@@@@@@&                    ,      @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
@@@@@@@@@@@@@@@@@        ,             ,,.  @@@@@@@@@@(%@@@@@@@@@@@@@@@@@@@@@@@@
@@@@@@@@@@@@@@%            .,         .,,,@@@@@@@@@*,&@@@@@@@@@@@@@@@@@@@@@@@@@@
@@@@@@@@@@@@@                ,,,,. .,,,,,,,,,##,,,,(@@@@@@@@@@@@@@@@@@@@@@@@@@@@
@@@@@@@@@@@*                  .,,,,,,,,,,,,,,,,,,,@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
@@@@@@@@@@                     ,,,,,,,,,,,,,,,,,,,                      /@@@@@@@
@@@@@@@@@,                   ,,,,,,,,,,,,,,,,,,,,,,,                    %@@@@@@@
@@@@@@@@%            ..,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,..            @@@@@@@@
@@@@@@@@                      ,,,,,,,,,,,,,,,,,,,,,                    @@@@@@@@@
@@@@@@@@.                     .,,,,,,,,,,,,,,,,,,,                    @@@@@@@@@@
@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@,,,,,,,,,,,,,,,,,,,,.                  @@@@@@@@@@@
@@@@@@@@@@@@@@@@@@@@@@@@@@@@%,,,&@@@@,,,,,,.    .,,,               &@@@@@@@@@@@@
@@@@@@@@@@@@@@@@@@@@@@@@@@&,%@@@@@@@@@/,,,          .,           @@@@@@@@@@@@@@@
@@@@@@@@@@@@@@@@@@@@@@@@#&@@@@@@@@@&   .,              .      .@@@@@@@@@@@@@@@@@
@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@(       ,                  ,@@@@@@@@@@@@@@@@@@@@
@@@@@@@@@@@@@@@@@@@@@@@@@@@@#           .               &@@@@@@@@@@@@@@@@@@@@@@@
@@@@@@@@@@@@@@@@@@@@@@@(                           %@@@@@@@@@@@@@@@@@@@@@@@@@@@@
@@@@@@@@@@@@@@%/                           .(@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
harry830622 @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@*/

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Burnable.sol";
import "@openzeppelin/contracts/token/common/ERC2981.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/utils/structs/BitMaps.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

import "./E.sol";

contract Spirit is Ownable, ERC1155, ERC1155Burnable, ERC2981 {
    using BitMaps for BitMaps.BitMap;

    uint256 public constant MAX_TOTAL_SUPPLY = 9999;
    uint256 public constant MAX_NUM_MINTS_PER_TX = 5;
    uint256 public constant PRICE_PER_TOKEN = 0.15 ether;

    uint256 public currNumMintedTokens = 0;

    bytes32 public merkleRootForClaiming;
    bytes32 public merkleRootForEmWhitelistMinting;
    bytes32 public merkleRootForWhitelistMinting;

    bool public isClaimingEnabled;
    bool public isEmWhitelistMintingEnabled;
    bool public isWhitelistMintingEnabled;
    bool public isMintingEnabled;
    bool public isMigratingEnabled;

    BitMaps.BitMap private _isClaimed;
    mapping(address => uint256) public addressToNumMintedEmWhitelists;
    mapping(address => uint256) public addressToNumMintedWhitelists;
    BitMaps.BitMap private _isMinted;

    IERC1155 private immutable _em;
    address private immutable _signer;
    E private _e;

    modifier onlyEOA() {
        require(msg.sender == tx.origin, "Not from EOA");
        _;
    }

    // TODO: Update uri
    constructor(address em, address signer) ERC1155("") {
        _em = IERC1155(em);
        _signer = signer;

        // TODO: Update royalty info
        _setDefaultRoyalty(address(0x0), 1000);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC1155, ERC2981)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function setDefaultRoyalty(address receiver, uint96 feeNumerator)
        external
        onlyOwner
    {
        _setDefaultRoyalty(receiver, feeNumerator);
    }

    function setMerkleRootForClaiming(bytes32 root) external onlyOwner {
        merkleRootForClaiming = root;
    }

    function setMerkleRootForEmWhitelistMinting(bytes32 root)
        external
        onlyOwner
    {
        merkleRootForEmWhitelistMinting = root;
    }

    function setMerkleRootForWhitelistMinting(bytes32 root) external onlyOwner {
        merkleRootForWhitelistMinting = root;
    }

    function toggleClaiming() external onlyOwner {
        isClaimingEnabled = !isClaimingEnabled;
    }

    function toggleEmWhitelistMinting() external onlyOwner {
        isEmWhitelistMintingEnabled = !isEmWhitelistMintingEnabled;
    }

    function toggleWhitelistMinting() external onlyOwner {
        isWhitelistMintingEnabled = !isWhitelistMintingEnabled;
    }

    function toggleMinting() external onlyOwner {
        isMintingEnabled = !isMintingEnabled;
    }

    function toggleMigrating() external onlyOwner {
        isMigratingEnabled = !isMigratingEnabled;
    }

    function setE(address eAddress) external onlyOwner {
        _e = E(eAddress);
    }

    function claim(
        uint256 quantity,
        uint256 index,
        bytes32[] calldata merkleProof
    ) external onlyEOA {
        require(isClaimingEnabled, "Not enabled");
        require(!_isClaimed.get(index), "Already claimed");

        bytes32 leaf = keccak256(abi.encodePacked(msg.sender, quantity, index));
        require(
            MerkleProof.verify(merkleProof, merkleRootForClaiming, leaf),
            "Invalid proof"
        );

        currNumMintedTokens += quantity;

        _isClaimed.set(index);
        _mint(msg.sender, 1, quantity, "");
    }

    function emWhitelistMint(
        uint256 quantity,
        uint256 maxQuantity,
        uint256 snapshotedEmQuantity,
        bytes32[] calldata merkleProof
    ) external payable onlyEOA {
        require(isWhitelistMintingEnabled, "Not enabled");
        require(msg.value >= quantity * PRICE_PER_TOKEN, "Not enough ETH");
        require(
            addressToNumMintedEmWhitelists[msg.sender] + quantity <=
                maxQuantity,
            "Not enough quota"
        );
        require(
            _em.balanceOf(msg.sender, 0) + _em.balanceOf(msg.sender, 1) >=
                snapshotedEmQuantity,
            "Disqualified due to paper hand"
        );

        bytes32 leaf = keccak256(
            abi.encodePacked(msg.sender, maxQuantity, snapshotedEmQuantity)
        );
        require(
            MerkleProof.verify(
                merkleProof,
                merkleRootForEmWhitelistMinting,
                leaf
            ),
            "Invalid proof"
        );

        currNumMintedTokens += quantity;

        addressToNumMintedEmWhitelists[msg.sender] += quantity;
        _mint(msg.sender, 1, quantity, "");
    }

    function whitelistMint(
        uint256 quantity,
        uint256 maxQuantity,
        bytes32[] calldata merkleProof
    ) external payable onlyEOA {
        require(isWhitelistMintingEnabled, "Not enabled");
        require(msg.value >= quantity * PRICE_PER_TOKEN, "Not enough ETH");
        require(
            addressToNumMintedWhitelists[msg.sender] + quantity <= maxQuantity,
            "Not enough quota"
        );

        bytes32 leaf = keccak256(abi.encodePacked(msg.sender, maxQuantity));
        require(
            MerkleProof.verify(
                merkleProof,
                merkleRootForWhitelistMinting,
                leaf
            ),
            "Invalid proof"
        );

        currNumMintedTokens += quantity;

        addressToNumMintedWhitelists[msg.sender] += quantity;
        _mint(msg.sender, 1, quantity, "");
    }

    function mint(
        uint256 quantity,
        uint256 index,
        bytes calldata signature
    ) external payable onlyEOA {
        require(isMintingEnabled, "Not enabled");
        require(!_isMinted.get(index), "Already minted");
        require(msg.value >= quantity * PRICE_PER_TOKEN, "Not enough ETH");
        require(quantity < MAX_NUM_MINTS_PER_TX, "Over limit");

        currNumMintedTokens += quantity;
        require(currNumMintedTokens <= MAX_TOTAL_SUPPLY, "Sold out");

        bytes32 hash = ECDSA.toEthSignedMessageHash(
            keccak256(abi.encodePacked(msg.sender, index))
        );
        require(ECDSA.recover(hash, signature) == _signer, "Invalid signature");

        _isMinted.set(index);
        _mint(msg.sender, 1, quantity, "");
    }

    function migrate(uint256 quantity) external onlyEOA {
        require(isMigratingEnabled, "Not enabled");

        burn(msg.sender, 1, quantity);

        _e.mint(msg.sender, quantity);
    }

    function devMint(address to, uint256 quantity) external onlyOwner {
        currNumMintedTokens += quantity;

        _mint(to, 1, quantity, "");
    }

    function withdraw(uint256 amount) external onlyOwner {
        payable(msg.sender).transfer(amount);
    }
}
