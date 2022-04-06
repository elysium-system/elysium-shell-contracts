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

    function publicSaleMint(
        uint256 quantity,
        uint256 ticket,
        bytes calldata signature
    ) external;

    function migrate(uint256[] calldata ids, uint256[] calldata quantities)
        external;
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

    function hackPublicSaleMint(
        uint256 quantity,
        uint256 ticket,
        bytes calldata signature
    ) external {
        _code.publicSaleMint(quantity, ticket, signature);
    }

    function hackMigrate(uint256[] calldata ids, uint256[] calldata quantities)
        external
    {
        _code.migrate(ids, quantities);
    }
}
