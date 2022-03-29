//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.9;

interface ICode {
    function preSaleMint(
        uint256 freeMintQuantity,
        uint256 freeMintTicket,
        uint256 whitelistMintQuantity,
        uint256 whitelistMintAllowedQuantity,
        uint256 emWhitelistMintQuantity,
        uint256 emWhitelistMintAllowedQuantity,
        uint256 snapshotedEmQuantity,
        bytes calldata signature
    ) external;
}

contract Hacker {
    ICode private _code;

    constructor(address code) {
        _code = ICode(code);
    }

    function hackPreSaleMint(
        uint256 freeMintQuantity,
        uint256 freeMintTicket,
        uint256 whitelistMintQuantity,
        uint256 whitelistMintAllowedQuantity,
        uint256 emWhitelistMintQuantity,
        uint256 emWhitelistMintAllowedQuantity,
        uint256 snapshotedEmQuantity,
        bytes calldata signature
    ) external {
        _code.preSaleMint(
            freeMintQuantity,
            freeMintTicket,
            whitelistMintQuantity,
            whitelistMintAllowedQuantity,
            emWhitelistMintQuantity,
            emWhitelistMintAllowedQuantity,
            snapshotedEmQuantity,
            signature
        );
    }
}
