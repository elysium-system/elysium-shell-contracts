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
import "@chainlink/contracts/src/v0.8/VRFConsumerBase.sol";
import "@openzeppelin/contracts/utils/structs/BitMaps.sol";

error NotEnoughLINK();
error AlreadyRevealed();

contract Randomizer is Ownable, VRFConsumerBase {
    using BitMaps for BitMaps.BitMap;

    // TODO:
    bytes32 private constant _KEY_HASH =
        0x6e75b569a01ef56d18cab6a8e71e6600d6ce853834d4a5748b720d06f878b3a4;
    uint256 private constant _FEE = 0.0001 * 10**18;

    mapping(bytes32 => uint256) public requestIdToShellTokenId;
    mapping(uint256 => uint256) public shellMagicalArray;
    uint256 public numUnrevealedShells = 9999;
    BitMaps.BitMap private _isShellRevealed;

    mapping(bytes32 => uint256) public requestIdToRecodedShellTokenId;
    mapping(uint256 => uint256) public recodedShellMagicalArray;
    uint256 public numUnrevealedRecodedShells = 4999;
    BitMaps.BitMap private _isRecodedShellRevealed;

    event RequestRevealForShell(
        bytes32 indexed requestId,
        uint256 indexed tokenId,
        address indexed from,
        uint256 timestamp
    );
    event RevealForShell(
        bytes32 indexed requestId,
        uint256 indexed tokenId,
        uint256 indexed metadataId,
        uint256 randomness
    );

    event RequestRevealForRecodedShell(
        bytes32 indexed requestId,
        uint256 indexed tokenId,
        address indexed from,
        uint256 timestamp
    );
    event RevealForRecodedShell(
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

    function requestRevealForShell(
        uint256 tokenId,
        address from,
        uint256 timestamp
    ) external onlyOwner {
        bytes32 requestId = _requestRandomNumber();

        if (_isShellRevealed.get(tokenId)) {
            revert AlreadyRevealed();
        }
        _isShellRevealed.set(tokenId);

        requestIdToShellTokenId[requestId] = tokenId;

        emit RequestRevealForShell(requestId, tokenId, from, timestamp);
    }

    function requestRevealForRecodedShell(
        uint256 tokenId,
        address from,
        uint256 timestamp
    ) external onlyOwner {
        bytes32 requestId = _requestRandomNumber();

        if (_isRecodedShellRevealed.get(tokenId)) {
            revert AlreadyRevealed();
        }
        _isRecodedShellRevealed.set(tokenId);

        requestIdToRecodedShellTokenId[requestId] = tokenId;

        emit RequestRevealForRecodedShell(requestId, tokenId, from, timestamp);
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
        uint256 shellTokenId = requestIdToShellTokenId[requestId];
        if (shellTokenId != 0) {
            uint256 idx = randomness % numUnrevealedShells;

            uint256 metadataId = shellMagicalArray[idx];
            if (metadataId == 0) {
                metadataId = idx;
            }

            uint256 backIdx = numUnrevealedShells - 1;
            uint256 lastMetadataId = shellMagicalArray[backIdx];
            if (lastMetadataId == 0) {
                lastMetadataId = backIdx;
            }
            shellMagicalArray[idx] = lastMetadataId;

            numUnrevealedShells = backIdx;

            emit RevealForShell(
                requestId,
                shellTokenId,
                metadataId + 1,
                randomness
            );
        }

        uint256 recodedShellTokenId = requestIdToRecodedShellTokenId[requestId];
        if (recodedShellTokenId != 0) {
            uint256 idx = randomness % numUnrevealedRecodedShells;

            uint256 metadataId = recodedShellMagicalArray[idx];
            if (metadataId == 0) {
                metadataId = idx;
            }

            uint256 backIdx = numUnrevealedRecodedShells - 1;
            uint256 lastMetadataId = recodedShellMagicalArray[backIdx];
            if (lastMetadataId == 0) {
                lastMetadataId = backIdx;
            }
            recodedShellMagicalArray[idx] = lastMetadataId;

            numUnrevealedRecodedShells = backIdx;

            emit RevealForRecodedShell(
                requestId,
                recodedShellTokenId,
                metadataId + 1,
                randomness
            );
        }
    }

    function withdrawLINK(address to, uint256 amount) external onlyOwner {
        LINK.transfer(to, amount);
    }
}
