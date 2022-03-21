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

contract Randomizer is Ownable, VRFConsumerBase {
    bytes32 private constant _KEY_HASH =
        0xAA77729D3466CA35AE8D28B3BBAC7CC36A5031EFDC430821C02BC31A238AF445;
    uint256 private constant _FEE = 2 * 10**18;

    uint16[10000] public shellTokenIdToMetadataId;
    bytes32 private _seedForShellTokenIdToMetadataIdRequestId;

    uint16[10000] public recodedShellTokenIdToMetadataId;
    bytes32 private _seedForRecodedShellTokenIdToMetadataIdRequestId;

    event SeedForShellTokenIdToMetadataId(uint256 seed);
    event SeedForRecodedShellTokenIdToMetadataId(uint256 seed);

    constructor()
        VRFConsumerBase(
            0xf0d54349aDdcf704F77AE15b96510dEA15cb7952,
            0x514910771AF9Ca656af840dff83E8264EcF986CA
        )
    {}

    function requestSeedForShellTokenIdToMetadataId() external onlyOwner {
        _seedForShellTokenIdToMetadataIdRequestId = _requestRandomNumber();
    }

    function requestSeedForRecodedShellTokenIdToMetadataId()
        external
        onlyOwner
    {
        _seedForRecodedShellTokenIdToMetadataIdRequestId = _requestRandomNumber();
    }

    function _requestRandomNumber() internal returns (bytes32 requestId) {
        return requestRandomness(_KEY_HASH, _FEE);
    }

    function fulfillRandomness(bytes32 requestId, uint256 randomness)
        internal
        override
    {
        if (requestId == _seedForShellTokenIdToMetadataIdRequestId) {
            emit SeedForShellTokenIdToMetadataId(randomness);
        }

        if (requestId == _seedForRecodedShellTokenIdToMetadataIdRequestId) {
            emit SeedForRecodedShellTokenIdToMetadataId(randomness);
        }

        revert();
    }

    function setShellTokenIdToMetadataId(
        uint16[10000] calldata shellTokenIdToMetadataId_
    ) external onlyOwner {
        uint256 len = shellTokenIdToMetadataId_.length;
        for (uint256 i = 0; i < len; ++i) {
            shellTokenIdToMetadataId[i] = shellTokenIdToMetadataId_[i];
        }
    }

    function setRecodedShellTokenIdToMetadataId(
        uint16[10000] calldata recodedShellTokenIdToMetadataId_
    ) external onlyOwner {
        uint256 len = recodedShellTokenIdToMetadataId_.length;
        for (uint256 i = 0; i < len; ++i) {
            recodedShellTokenIdToMetadataId[
                i
            ] = recodedShellTokenIdToMetadataId_[i];
        }
    }

    function withdrawLINK(uint256 amount) external onlyOwner {
        LINK.transfer(msg.sender, amount);
    }
}
