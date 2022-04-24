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

contract ShellRandomizer is Ownable, VRFConsumerBase {
    using BitMaps for BitMaps.BitMap;

    // TODO:
    bytes32 private constant _KEY_HASH =
        0x6e75b569a01ef56d18cab6a8e71e6600d6ce853834d4a5748b720d06f878b3a4;
    uint256 private constant _FEE = 0.0001 * 10**18;

    uint256 public constant MAX_NUM_REVEALS_PER_TX = 10;

    struct Request {
        uint256 startTokenId;
        uint256 quantity;
    }
    mapping(bytes32 => Request) public idToRequest;

    mapping(uint256 => uint256) public metadataIdMagicalArray;
    uint256 public numUnrevealedTokens = 9999;

    mapping(uint256 => uint256) public tokenIdToMetadataId;

    event RequestRevealTokens(
        bytes32 indexed requestId,
        uint256 indexed startTokenId,
        uint256 quantity
    );
    event RevealTokens(
        bytes32 indexed requestId,
        uint256 indexed startTokenId,
        uint256 quantity,
        uint256[] metadataIds,
        uint256 randomness
    );

    constructor()
        // TODO:
        VRFConsumerBase(
            0x8C7382F9D8f56b33781fE506E897a4F1e2d17255,
            0x326C977E6efc84E512bB9C30f76E30c160eD06FB
        )
    {}

    function requestRevealTokens(uint256 startTokenId, uint256 quantity)
        external
        onlyOwner
    {
        if (quantity > MAX_NUM_REVEALS_PER_TX) {
            revert RequestRevealTooManyAtOnce();
        }

        bytes32 requestId = _requestRandomNumber();

        idToRequest[requestId] = Request({
            startTokenId: startTokenId,
            quantity: quantity
        });

        emit RequestRevealTokens(requestId, startTokenId, quantity);
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
        Request memory request = idToRequest[requestId];
        uint256 startTokenId = request.startTokenId;
        if (startTokenId != 0) {
            uint256 quantity = request.quantity;

            for (uint256 i = 0; i < quantity; ++i) {
                if (tokenIdToMetadataId[startTokenId + i] != 0) {
                    revert AlreadyRevealed();
                }
            }

            uint256[] memory metadataIds = new uint256[](quantity);
            for (uint256 i = 0; i < quantity; ++i) {
                uint256 idx = randomness % numUnrevealedTokens;

                uint256 metadataId = metadataIdMagicalArray[idx];
                if (metadataId == 0) {
                    metadataId = idx;
                }
                // Increment by 1 since token ID started from 1
                ++metadataId;

                uint256 backIdx = numUnrevealedTokens - 1;
                uint256 backMetadataId = metadataIdMagicalArray[backIdx];
                if (backMetadataId == 0) {
                    backMetadataId = backIdx;
                }
                metadataIdMagicalArray[idx] = backMetadataId;

                --numUnrevealedTokens;

                metadataIds[i] = metadataId;

                uint256 tokenId = startTokenId + i;
                tokenIdToMetadataId[tokenId] = metadataId;

                randomness >>= 16;
            }

            emit RevealTokens(
                requestId,
                startTokenId,
                quantity,
                metadataIds,
                randomness
            );
        }
    }

    function withdrawLINK(address to, uint256 amount) external onlyOwner {
        LINK.transfer(to, amount);
    }
}
