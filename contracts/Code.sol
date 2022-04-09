//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.9;

/*                  @@@@@@@@@@@@@             @@@@@@@@@@@@@@
                  @@@@@@@@@@@@@@                 @@@@@@@@@@@@@@
                @@@@@@@@@@@@@@                     @@@@@@@@@@@@@@
              @@@@@@@@@@@@@@@                       @@@@@@@@@@@@@@@
            @@@@@@@@@@@@@@@                           @@@@@@@@@@@@@@
           @@@@@@@@@@@@@@                               @@@@@@@@@@@@@@
         @@@@@@@@@@@@@@                                  @@@@@@@@@@@@@@@
       @@@@@@@@@@@@@@@                                     @@@@@@@@@@@@@@
      @@@@@@@@@@@@@@                                         @@@@@@@@@@@@@@
    @@@@@@@@@@@@@@                      @                     @@@@@@@@@@@@@@@
  @@@@@@@@@@@@@@@             @@       @@@       @@             @@@@@@@@@@@@@@@
 @@@@@@@@@@@@@@                 @@@    @@@    @@@                 @@@@@@@@@@@@@@
                                 @@@@@@@@@@@@@@@
                                  @@@@@@@@@@@@@
                          @@@@@@@@@@@@@@@@@@@@@@@@@@@@@
                                  @@@@@@@@@@@@@
                                 @@@@@@@@@@@@@@@
 @@@@@@@@@@@@@@                 @@@    @@@    @@@                 @@@@@@@@@@@@@@
  @@@@@@@@@@@@@@@             @@       @@@       @@             @@@@@@@@@@@@@@@
    @@@@@@@@@@@@@@                      @                     @@@@@@@@@@@@@@@
      @@@@@@@@@@@@@@                                         @@@@@@@@@@@@@@
       @@@@@@@@@@@@@@@                                     @@@@@@@@@@@@@@
         @@@@@@@@@@@@@@@                                 @@@@@@@@@@@@@@@
           @@@@@@@@@@@@@@                               @@@@@@@@@@@@@@
             @@@@@@@@@@@@@@                           @@@@@@@@@@@@@@
              @@@@@@@@@@@@@@@                       @@@@@@@@@@@@@@@
                @@@@@@@@@@@@@@                     @@@@@@@@@@@@@@
                  @harry830622                   @@@@@@@@@@@@@@               */

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Burnable.sol";
import "@openzeppelin/contracts/token/common/ERC2981.sol";
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
error ShellNotSet();
error MigrateTooManyAtOnce();

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
    uint256 public constant MAX_NUM_MINTS_PER_TX = 3;
    uint256 public constant PRICE_PER_TOKEN = 0.12 ether;

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

    uint256 public nextTokenId = 1;
    uint256 public totalNumMintedTokens;

    IERC1155 private immutable _em;
    address private immutable _signer;
    IShell private _shell;
    IRecodedShell private _recodedShell;

    event Migrate(
        address indexed from,
        uint256 indexed startTokenId,
        uint256 quantity
    );

    event InitiateRecode(
        address indexed from,
        uint256 indexed shellTokenId,
        uint256 newShellTokenId,
        uint256 newRecodedShellTokenId
    );

    modifier onlyEOA() {
        if (msg.sender != tx.origin) {
            revert NotEOA();
        }
        _;
    }

    // TODO: Check URI
    constructor(address em)
        ERC1155("ipfs://QmeRSRWAwBt5xouUU1GCsvhU8pNYdEyn1xxtwmWWzYyxrD")
    {
        _em = IERC1155(em);
        _signer = owner();

        // TODO: Update royalty info
        _setDefaultRoyalty(owner(), 750);

        // TODO:
        uint256 reserveQuantity = 400;
        totalNumMintedTokens = reserveQuantity;
        _mint(owner(), nextTokenId, reserveQuantity, "");
        ++nextTokenId;
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC1155, ERC2981)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function isFreeMintTicketUsed(uint256 ticket) external view returns (bool) {
        return _isFreeMintTicketUsed.get(ticket);
    }

    function isPublicMintTicketUsed(uint256 ticket)
        external
        view
        returns (bool)
    {
        return _isPublicMintTicketUsed.get(ticket);
    }

    function setDefaultRoyalty(address receiver, uint96 feeNumerator)
        external
        onlyOwner
    {
        _setDefaultRoyalty(receiver, feeNumerator);
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
                if (whitelistMintQuantity + emWhitelistMintQuantity == 0) {
                    revert TicketUsed();
                }
                freeMintQuantity = 0;
            } else {
                _isFreeMintTicketUsed.set(freeMintTicket);
            }
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

        _mint(msg.sender, nextTokenId, quantity, "");
        ++nextTokenId;
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

        _mint(msg.sender, nextTokenId, quantity, "");
        ++nextTokenId;
    }

    function migrate(uint256[] calldata ids, uint256[] calldata quantities)
        external
        onlyEOA
    {
        uint256 blockTime = block.timestamp;
        if (blockTime < migrationStartTime) {
            revert NotStarted();
        }
        if (blockTime >= migrationEndTime) {
            revert Ended();
        }

        if (address(_shell) == address(0)) {
            revert ShellNotSet();
        }

        uint256 totalQuantity;
        uint256 numQuantities = quantities.length;
        for (uint256 i = 0; i < numQuantities; ++i) {
            totalQuantity += quantities[i];
        }
        if (totalQuantity > 256) {
            revert MigrateTooManyAtOnce();
        }

        burnBatch(msg.sender, ids, quantities);

        uint256 startTokenId = _shell.nextTokenId();
        _shell.mint(msg.sender, totalQuantity);

        emit Migrate(msg.sender, startTokenId, totalQuantity);
    }

    function initiateRecode(uint256 shellTokenId, uint256 codeTokenId)
        external
        onlyEOA
    {
        uint256 blockTime = block.timestamp;
        if (blockTime < recodingStartTime) {
            revert NotStarted();
        }
        if (blockTime >= recodingEndTime) {
            revert Ended();
        }

        if (address(_shell) == address(0)) {
            revert ShellNotSet();
        }

        burn(msg.sender, codeTokenId, 1);
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

        if (address(_shell) == address(0)) {
            revert ShellNotSet();
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
