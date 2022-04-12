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

interface ICode {
    function burn(
        address from,
        uint256 tokenId,
        uint256 quantity
    ) external;
}

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

contract Recoder is Ownable {
    uint256 public recodingStartTime = 2**256 - 1;
    uint256 public recodingEndTime = 2**256 - 1;

    address private immutable _signer;
    ICode public immutable code;
    IShell public immutable shell;
    IRecodedShell public immutable recodedShell;

    event InitiateRecode(
        uint256 indexed shellTokenId,
        uint256 newShellTokenId,
        uint256 newRecodedShellTokenId,
        address indexed from
    );

    modifier onlyEOA() {
        if (msg.sender != tx.origin) {
            revert NotEOA();
        }
        _;
    }

    constructor(
        address code_,
        address shell_,
        address recodedShell_
    ) {
        _signer = owner();
        code = ICode(code_);
        shell = IShell(shell_);
        recodedShell = IRecodedShell(recodedShell_);
    }

    function setRecodingTime(uint256 start, uint256 end) external onlyOwner {
        if (end <= start) {
            revert();
        }
        recodingStartTime = start;
        recodingEndTime = end;
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

        code.burn(msg.sender, codeTokenId, 1);
        shell.burn(shellTokenId);

        uint256 newShellTokenId = shell.nextTokenId();
        shell.mint(msg.sender, 1);
        shell.setTokenInvalid(newShellTokenId);

        uint256 newRecodedShellTokenId = recodedShell.nextTokenId();
        recodedShell.mint(msg.sender, 1);

        emit InitiateRecode(
            shellTokenId,
            newShellTokenId,
            newRecodedShellTokenId,
            msg.sender
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

        recodedShell.setTokenValid(newRecodedShellTokenId);

        if (isNewShellOneOfOne) {
            shell.setTokenValid(newShellTokenId);
        } else {
            shell.burn(newShellTokenId);
        }
    }

    function withdraw(address to, uint256 amount) external onlyOwner {
        payable(to).transfer(amount);
    }
}
