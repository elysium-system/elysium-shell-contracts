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
error NotEnoughETH();
error NotEnoughQuota();
error PaperHand();
error MintTooManyAtOnce();
error ZeroQuantity();
error SoldOut();
error InvalidSignature();

interface IShell {
    function nextTokenId() external view returns (uint256);

    function burn(uint256 tokenId) external;

    function mint(address to, uint256 quantity) external;

    function setTokenInvalid(uint256 tokenId) external;

    function setTokenValid(uint256 tokenId) external;
}

interface IRecodedShell {
    function nextTokenId() external view returns (uint256);

    function burn(uint256 tokenId) external;

    function mint(address to, uint256 quantity) external;

    function setTokenValid(uint256 tokenId) external;
}

contract Code is Ownable, ERC1155, ERC1155Burnable, ERC2981 {
    using BitMaps for BitMaps.BitMap;

    uint256 public constant MAX_TOTAL_SUPPLY = 9999;
    uint256 public constant MAX_NUM_MINTS_PER_TX = 5;
    uint256 public constant PRICE_PER_TOKEN = 0.15 ether;
    uint256 public constant TOKEN_ID = 1;

    uint256 public preSaleMintStartTime = 2**256 - 1;
    uint256 public publicMintStartTime = 2**256 - 1;
    uint256 public migrationStartTime = 2**256 - 1;
    uint256 public recodingStartTime = 2**256 - 1;

    uint256 public preSaleMintEndTime = 2**256 - 1;
    uint256 public publicMintEndTime = 2**256 - 1;
    uint256 public migrationEndTime = 2**256 - 1;
    uint256 public recodingEndTime = 2**256 - 1;

    BitMaps.BitMap private _isFreeMintTicketUsed;
    mapping(address => uint256) public addressToNumMintedWhitelists;
    mapping(address => uint256) public addressToNumMintedEmWhitelists;
    BitMaps.BitMap private _isPublicMintTicketUsed;

    uint256 public totalNumMintedTokens;

    IERC1155 private immutable _em;
    address private _signer;
    IShell private _shell;
    IRecodedShell private _recodedShell;

    event InitiateRecode(
        address indexed from,
        uint256 shellTokenId,
        uint256 newShellTokenId,
        uint256 newRecodedShellTokenId
    );

    modifier onlyEOA() {
        if (msg.sender != tx.origin) {
            revert NotEOA();
        }
        _;
    }

    // TODO: Update uri
    constructor(address em) ERC1155("") {
        _em = IERC1155(em);

        // TODO: Update royalty info
        // _setDefaultRoyalty(address(0x0), 1000);
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

    function setSigner(address addr) external onlyOwner {
        _signer = addr;
    }

    function setPreSaleMintTime(uint256 start, uint256 end) external onlyOwner {
        if (end <= start) {
            revert();
        }
        preSaleMintStartTime = start;
        preSaleMintEndTime = end;
    }

    function setPublicSaleMintTime(uint256 start, uint256 end)
        external
        onlyOwner
    {
        if (end <= start) {
            revert();
        }
        publicMintStartTime = start;
        publicMintEndTime = end;
    }

    function setMigrationTime(uint256 start, uint256 end) external onlyOwner {
        if (end <= start) {
            revert();
        }
        migrationStartTime = start;
        migrationEndTime = end;
    }

    function setRecodingTime(uint256 start, uint256 end) external onlyOwner {
        if (end <= start) {
            revert();
        }
        recodingStartTime = start;
        recodingEndTime = end;
    }

    function setShell(address addr) external onlyOwner {
        _shell = IShell(addr);
    }

    function setRecodedShell(address addr) external onlyOwner {
        _recodedShell = IRecodedShell(addr);
    }

    function preSaleMint(
        uint256 freeMintQuantity,
        uint256 freeMintTicket,
        uint256 whitelistMintQuantity,
        uint256 whitelistMintAllowedQuantity,
        uint256 emWhitelistMintQuantity,
        uint256 emWhitelistMintAllowedQuantity,
        uint256 snapshotedEmQuantity,
        bytes calldata signature
    ) external payable onlyEOA {
        uint256 blockTime = block.timestamp;
        if (blockTime < preSaleMintStartTime) {
            revert NotStarted();
        }
        if (blockTime >= preSaleMintEndTime) {
            revert Ended();
        }

        uint256 quantity = freeMintQuantity +
            whitelistMintQuantity +
            emWhitelistMintQuantity;
        if (quantity == 0) {
            revert ZeroQuantity();
        }
        if (totalNumMintedTokens + quantity > MAX_TOTAL_SUPPLY) {
            revert SoldOut();
        }
        totalNumMintedTokens += quantity;

        bytes32 hash = ECDSA.toEthSignedMessageHash(
            keccak256(
                abi.encodePacked(
                    msg.sender,
                    freeMintQuantity,
                    freeMintTicket,
                    whitelistMintAllowedQuantity,
                    emWhitelistMintAllowedQuantity,
                    snapshotedEmQuantity
                )
            )
        );
        if (ECDSA.recover(hash, signature) != _signer) {
            revert InvalidSignature();
        }

        if (freeMintQuantity > 0) {
            if (_isFreeMintTicketUsed.get(freeMintTicket)) {
                revert TicketUsed();
            }
            _isFreeMintTicketUsed.set(freeMintTicket);
        }

        if (whitelistMintQuantity + emWhitelistMintQuantity > 0) {
            if (
                msg.value <
                (whitelistMintQuantity + emWhitelistMintQuantity) *
                    PRICE_PER_TOKEN
            ) {
                revert NotEnoughETH();
            }
        }

        if (whitelistMintQuantity > 0) {
            if (
                addressToNumMintedWhitelists[msg.sender] +
                    whitelistMintQuantity >
                whitelistMintAllowedQuantity
            ) {
                revert NotEnoughQuota();
            }
            addressToNumMintedWhitelists[msg.sender] += whitelistMintQuantity;
        }

        if (emWhitelistMintQuantity > 0) {
            if (
                addressToNumMintedEmWhitelists[msg.sender] +
                    emWhitelistMintQuantity >
                emWhitelistMintAllowedQuantity
            ) {
                revert NotEnoughQuota();
            }
            addressToNumMintedEmWhitelists[
                msg.sender
            ] += emWhitelistMintQuantity;

            if (
                _em.balanceOf(msg.sender, 0) + _em.balanceOf(msg.sender, 1) <
                snapshotedEmQuantity
            ) {
                revert PaperHand();
            }
        }

        _mint(msg.sender, TOKEN_ID, quantity, "");
    }

    function publicSaleMint(
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

        if (quantity == 0) {
            revert ZeroQuantity();
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
        _shell.burn(shellTokenId);

        uint256 newShellTokenId = _shell.nextTokenId();
        _shell.mint(msg.sender, 1);
        _shell.setTokenInvalid(newShellTokenId);

        uint256 newRecodedShellTokenId = _recodedShell.nextTokenId();
        _recodedShell.mint(msg.sender, 1);

        emit InitiateRecode(
            msg.sender,
            shellTokenId,
            newShellTokenId,
            newRecodedShellTokenId
        );
    }

    function recode(
        uint256 shellTokenId,
        uint256 newShellTokenId,
        uint256 newRecodedShellTokenId,
        bool isNewShellOneOfOne,
        bytes calldata signature
    ) external onlyEOA {
        uint256 blockTime = block.timestamp;
        if (blockTime < recodingStartTime) {
            revert NotStarted();
        }
        if (blockTime >= recodingEndTime) {
            revert Ended();
        }

        bytes32 hash = ECDSA.toEthSignedMessageHash(
            keccak256(
                abi.encodePacked(
                    msg.sender,
                    shellTokenId,
                    newShellTokenId,
                    newRecodedShellTokenId,
                    isNewShellOneOfOne
                )
            )
        );
        if (ECDSA.recover(hash, signature) != _signer) {
            revert InvalidSignature();
        }

        _recodedShell.setTokenValid(newRecodedShellTokenId);

        if (isNewShellOneOfOne) {
            _shell.setTokenValid(newShellTokenId);
        } else {
            _shell.burn(newShellTokenId);
        }
    }

    function withdraw(address to, uint256 amount) external onlyOwner {
        payable(to).transfer(amount);
    }
}
