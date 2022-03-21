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

error NotEOA();
error NotStarted();
error Ended();
error TicketUsed();
error InvalidProof();
error NotEnoughETH();
error NotEnoughQuota();
error PaperHand();
error MintTooManyAtOnce();
error SoldOut();
error InvalidSignature();

interface IShell {
    function burn(uint256 tokenId) external;

    function mint(address to, uint256 quantity) external;

    function setTokenInvalid(uint256 tokenId, address owner) external;

    function setTokenValid(uint256 tokenId, address owner) external;
}

interface IRecodedShell {
    function burn(uint256 tokenId) external;

    function mint(address to, uint256 quantity) external;

    function setTokenValid(uint256 tokenId, address owner) external;

    function nextTokenId() external view returns (uint256);
}

contract Code is Ownable, ERC1155, ERC1155Burnable, ERC2981 {
    using BitMaps for BitMaps.BitMap;

    uint256 public constant MAX_TOTAL_SUPPLY = 9999;
    uint256 public constant MAX_NUM_MINTS_PER_TX = 5;
    uint256 public constant PRICE_PER_TOKEN = 0.15 ether;
    uint256 public constant TOKEN_ID = 1;

    uint256 public freeMintStartTime = 2**256 - 1;
    uint256 public whitelistMintStartTime = 2**256 - 1;
    uint256 public emWhitelistMintStartTime = 2**256 - 1;
    uint256 public publicMintStartTime = 2**256 - 1;
    uint256 public migrationStartTime = 2**256 - 1;
    uint256 public recodingStartTime = 2**256 - 1;

    uint256 public freeMintEndTime = 2**256 - 1;
    uint256 public whitelistMintEndTime = 2**256 - 1;
    uint256 public emWhitelistMintEndTime = 2**256 - 1;
    uint256 public publicMintEndTime = 2**256 - 1;
    uint256 public migrationEndTime = 2**256 - 1;
    uint256 public recodingEndTime = 2**256 - 1;

    bytes32 public merkleRootForFreeMint;
    bytes32 public merkleRootForWhitelistMint;
    bytes32 public merkleRootForEmWhitelistMint;

    BitMaps.BitMap private _isFreeMintTicketUsed;
    mapping(address => uint256) public addressToNumMintedWhitelists;
    mapping(address => uint256) public addressToNumMintedEmWhitelists;
    BitMaps.BitMap private _isPublicMintTicketUsed;

    uint256 public totalNumMintedTokens = 0;

    mapping(uint256 => uint256) public shellTokenIdToRecodedTokenId;

    address private immutable _signer;
    IERC1155 private immutable _em;
    IShell private _shell;
    IRecodedShell private _recodedShell;

    modifier onlyEOA() {
        if (msg.sender != tx.origin) {
            revert NotEOA();
        }
        _;
    }

    // TODO: Update uri
    constructor(address em, address signer) ERC1155("") {
        _em = IERC1155(em);
        _signer = signer;

        // TODO: Update royalty info
        _setDefaultRoyalty(address(0x0), 1000);

        // TODO:
        uint256 tokensToReserve = 999;
        totalNumMintedTokens = tokensToReserve;
        _mint(msg.sender, TOKEN_ID, tokensToReserve, "");
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

    function setMerkleRootForFreeMint(bytes32 root) external onlyOwner {
        merkleRootForFreeMint = root;
    }

    function setMerkleRootForWhitelistMint(bytes32 root) external onlyOwner {
        merkleRootForWhitelistMint = root;
    }

    function setMerkleRootForEmWhitelistMint(bytes32 root) external onlyOwner {
        merkleRootForEmWhitelistMint = root;
    }

    function setFreeMintTime(uint256 start, uint256 end) external onlyOwner {
        if (end <= start) {
            revert();
        }
        freeMintStartTime = start;
        freeMintEndTime = end;
    }

    function setWhitelistMintTime(uint256 start, uint256 end)
        external
        onlyOwner
    {
        if (end <= start) {
            revert();
        }
        whitelistMintStartTime = start;
        whitelistMintEndTime = end;
    }

    function setEmWhitelistMintTime(uint256 start, uint256 end)
        external
        onlyOwner
    {
        if (end <= start) {
            revert();
        }
        emWhitelistMintStartTime = start;
        emWhitelistMintEndTime = end;
    }

    function setMigrationTime(uint256 start, uint256 end) external onlyOwner {
        if (end <= start) {
            revert();
        }
        migrationStartTime = start;
        migrationEndTime = end;
    }

    function setShell(address addr) external onlyOwner {
        _shell = IShell(addr);
    }

    function setRecodedShell(address addr) external onlyOwner {
        _recodedShell = IRecodedShell(addr);
    }

    function freeMint(
        uint256 quantity,
        uint256 ticket,
        bytes32[] calldata merkleProof
    ) external onlyEOA {
        uint256 blockTime = block.timestamp;
        if (blockTime < freeMintStartTime) {
            revert NotStarted();
        }
        if (blockTime >= freeMintEndTime) {
            revert Ended();
        }

        bytes32 leaf = keccak256(
            abi.encodePacked(msg.sender, quantity, ticket)
        );
        if (!MerkleProof.verify(merkleProof, merkleRootForFreeMint, leaf)) {
            revert InvalidProof();
        }

        if (_isFreeMintTicketUsed.get(ticket)) {
            revert TicketUsed();
        }
        _isFreeMintTicketUsed.set(ticket);

        totalNumMintedTokens += quantity;

        _mint(msg.sender, TOKEN_ID, quantity, "");
    }

    function whitelistMint(
        uint256 quantity,
        uint256 allowedQuantity,
        bytes32[] calldata merkleProof
    ) external payable onlyEOA {
        uint256 blockTime = block.timestamp;
        if (blockTime < whitelistMintStartTime) {
            revert NotStarted();
        }
        if (blockTime >= whitelistMintEndTime) {
            revert Ended();
        }

        if (msg.value < quantity * PRICE_PER_TOKEN) {
            revert NotEnoughETH();
        }

        bytes32 leaf = keccak256(abi.encodePacked(msg.sender, allowedQuantity));
        if (
            !MerkleProof.verify(merkleProof, merkleRootForWhitelistMint, leaf)
        ) {
            revert InvalidProof();
        }

        if (
            addressToNumMintedWhitelists[msg.sender] + quantity >
            allowedQuantity
        ) {
            revert NotEnoughQuota();
        }
        addressToNumMintedWhitelists[msg.sender] += quantity;

        totalNumMintedTokens += quantity;

        _mint(msg.sender, TOKEN_ID, quantity, "");
    }

    function emWhitelistMint(
        uint256 quantity,
        uint256 allowedQuantity,
        uint256 snapshotedEmQuantity,
        bytes32[] calldata merkleProof
    ) external payable onlyEOA {
        uint256 blockTime = block.timestamp;
        if (blockTime < emWhitelistMintStartTime) {
            revert NotStarted();
        }
        if (blockTime >= emWhitelistMintEndTime) {
            revert Ended();
        }

        if (msg.value < quantity * PRICE_PER_TOKEN) {
            revert NotEnoughETH();
        }

        bytes32 leaf = keccak256(
            abi.encodePacked(msg.sender, allowedQuantity, snapshotedEmQuantity)
        );
        if (
            !MerkleProof.verify(merkleProof, merkleRootForEmWhitelistMint, leaf)
        ) {
            revert InvalidProof();
        }

        if (
            addressToNumMintedEmWhitelists[msg.sender] + quantity >
            allowedQuantity
        ) {
            revert NotEnoughQuota();
        }
        addressToNumMintedEmWhitelists[msg.sender] += quantity;

        if (
            _em.balanceOf(msg.sender, 0) + _em.balanceOf(msg.sender, 1) <
            snapshotedEmQuantity
        ) {
            revert PaperHand();
        }

        totalNumMintedTokens += quantity;

        _mint(msg.sender, TOKEN_ID, quantity, "");
    }

    function publicMint(
        uint256 quantity,
        uint256 ticket,
        bytes calldata signature
    ) external payable onlyEOA {
        uint256 blockTime = block.timestamp;
        if (blockTime < publicMintStartTime) {
            revert NotStarted();
        }
        if (blockTime >= publicMintEndTime) {
            revert Ended();
        }

        if (msg.value < quantity * PRICE_PER_TOKEN) {
            revert NotEnoughETH();
        }

        if (quantity > MAX_NUM_MINTS_PER_TX) {
            revert MintTooManyAtOnce();
        }

        if (totalNumMintedTokens + quantity > MAX_TOTAL_SUPPLY) {
            revert SoldOut();
        }
        totalNumMintedTokens += quantity;

        bytes32 hash = ECDSA.toEthSignedMessageHash(
            keccak256(abi.encodePacked(msg.sender, ticket))
        );
        if (ECDSA.recover(hash, signature) != _signer) {
            revert InvalidSignature();
        }

        if (_isPublicMintTicketUsed.get(ticket)) {
            revert TicketUsed();
        }
        _isPublicMintTicketUsed.set(ticket);

        _mint(msg.sender, TOKEN_ID, quantity, "");
    }

    function migrate(uint256 quantity) external onlyEOA {
        uint256 blockTime = block.timestamp;
        if (blockTime < migrationStartTime) {
            revert NotStarted();
        }
        if (blockTime >= migrationEndTime) {
            revert Ended();
        }

        burn(msg.sender, TOKEN_ID, quantity);

        _shell.mint(msg.sender, quantity);
    }

    function initiateRecode(uint256 shellTokenId) external onlyEOA {
        uint256 blockTime = block.timestamp;
        if (blockTime < recodingStartTime) {
            revert NotStarted();
        }
        if (blockTime >= recodingEndTime) {
            revert Ended();
        }

        burn(msg.sender, TOKEN_ID, 1);

        _shell.setTokenInvalid(shellTokenId, msg.sender);

        shellTokenIdToRecodedTokenId[shellTokenId] = _recodedShell
            .nextTokenId();
        _recodedShell.mint(msg.sender, 1);
    }

    function recode(
        uint256 shellTokenId,
        bool isOneOfOne,
        bytes calldata signature
    ) external onlyEOA {
        uint256 blockTime = block.timestamp;
        if (blockTime < recodingStartTime) {
            revert NotStarted();
        }
        if (blockTime >= recodingEndTime) {
            revert Ended();
        }

        uint256 recodedShellTokenId = shellTokenIdToRecodedTokenId[
            shellTokenId
        ];
        bytes32 hash = ECDSA.toEthSignedMessageHash(
            keccak256(
                abi.encodePacked(shellTokenId, isOneOfOne, recodedShellTokenId)
            )
        );
        if (ECDSA.recover(hash, signature) != _signer) {
            revert InvalidSignature();
        }

        if (isOneOfOne) {
            _shell.setTokenValid(shellTokenId, msg.sender);
            _recodedShell.burn(recodedShellTokenId);
        } else {
            _shell.burn(shellTokenId);
            _recodedShell.setTokenValid(recodedShellTokenId, msg.sender);
        }
    }

    function withdraw(uint256 amount) external onlyOwner {
        payable(msg.sender).transfer(amount);
    }
}
