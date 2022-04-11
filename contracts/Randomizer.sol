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
import "@chainlink/contracts/src/v0.8/VRFConsumerBase.sol";
import "@openzeppelin/contracts/utils/structs/BitMaps.sol";

error NotEnoughLINK();
error AlreadyRevealed();
error RequestRevealTooManyAtOnce();

contract Randomizer is Ownable, VRFConsumerBase {
    using BitMaps for BitMaps.BitMap;

    // TODO:
    bytes32 private constant _KEY_HASH =
        0x6e75b569a01ef56d18cab6a8e71e6600d6ce853834d4a5748b720d06f878b3a4;
    uint256 private constant _FEE = 0.0001 * 10**18;

    uint256 public constant MAX_NUM_REVEALS_PER_TX = 10;

    struct ShellData {
        uint256 startTokenId;
        uint256 quantity;
    }
    mapping(bytes32 => ShellData) public requestIdToShellData;

    mapping(uint256 => uint256) public shellMagicalArray;
    uint256 public numUnrevealedShells = 9999;

    mapping(uint256 => uint256) public shellTokenIdToMetadataId;

    event RequestRevealShell(
        bytes32 indexed requestId,
        uint256 indexed startTokenId,
        uint256 quantity,
        address indexed from,
        uint256 timestamp
    );
    event RevealShell(
        bytes32 indexed requestId,
        uint256 indexed tokenId,
        uint256 indexed metadataId,
        uint256 randomness
    );

    constructor()
        // TODO:
        VRFConsumerBase(
            0x8C7382F9D8f56b33781fE506E897a4F1e2d17255,
            0x326C977E6efc84E512bB9C30f76E30c160eD06FB
        )
    {}

    function requestRevealShell(
        uint256 startTokenId,
        uint256 quantity,
        address from,
        uint256 timestamp
    ) external onlyOwner {
        if (quantity > MAX_NUM_REVEALS_PER_TX) {
            revert RequestRevealTooManyAtOnce();
        }

        bytes32 requestId = _requestRandomNumber();

        requestIdToShellData[requestId] = ShellData({
            startTokenId: startTokenId,
            quantity: quantity
        });

        emit RequestRevealShell(
            requestId,
            startTokenId,
            quantity,
            from,
            timestamp
        );
    }

    function _requestRandomNumber() internal returns (bytes32 requestId) {
        if (LINK.balanceOf(address(this)) < _FEE) {
            revert NotEnoughLINK();
        }
        return requestRandomness(_KEY_HASH, _FEE);
    }

    function fulfillRandomness(bytes32 requestId, uint256 randomness)
        internal
        override
    {
        ShellData memory shellData = requestIdToShellData[requestId];
        uint256 shellStartTokenId = shellData.startTokenId;
        if (shellStartTokenId != 0) {
            uint256 quantity = shellData.quantity;

            for (uint256 i = 0; i < quantity; ++i) {
                if (shellTokenIdToMetadataId[shellStartTokenId + i] != 0) {
                    revert AlreadyRevealed();
                }
            }

            for (uint256 i = 0; i < quantity; ++i) {
                uint256 idx = randomness % numUnrevealedShells;

                uint256 metadataId = shellMagicalArray[idx];
                if (metadataId == 0) {
                    metadataId = idx;
                }
                ++metadataId;

                uint256 backIdx = numUnrevealedShells - 1;
                uint256 backMetadataId = shellMagicalArray[backIdx];
                if (backMetadataId == 0) {
                    backMetadataId = backIdx;
                }
                shellMagicalArray[idx] = backMetadataId;

                --numUnrevealedShells;

                uint256 tokenId = shellStartTokenId + i;
                shellTokenIdToMetadataId[tokenId] = metadataId;

                emit RevealShell(requestId, tokenId, metadataId, randomness);

                randomness >>= 16;
            }
        }
    }

    function withdrawLINK(address to, uint256 amount) external onlyOwner {
        LINK.transfer(to, amount);
    }
}
