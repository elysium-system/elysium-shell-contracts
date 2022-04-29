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

    bytes32 private constant _KEY_HASH =
        0xf86195cf7690c55907b2b611ebb7343a6f649bff128701cc542f0569e2c549da;
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
        VRFConsumerBase(
            0x3d2341ADb2D31f1c5530cDC622016af293177AE0,
            0xb0897686c545045aFc77CF20eC7A532E3120E0F1
        )
    {}

    function requestRevealTokens(uint256 startTokenId, uint256 quantity)
        external
        onlyOwner
    {
        if (quantity > MAX_NUM_REVEALS_PER_TX) {
            revert RequestRevealTooManyAtOnce();
        }

        for (uint256 i = 0; i < quantity; ++i) {
            if (tokenIdToMetadataId[startTokenId + i] != 0) {
                revert AlreadyRevealed();
            }
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
