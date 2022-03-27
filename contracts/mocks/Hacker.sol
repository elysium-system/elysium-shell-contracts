//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.9;

interface ICode {
    function freeMint(
        uint256 quantity,
        uint256 ticket,
        bytes32[] calldata merkleProof
    ) external;
}

contract Hacker {
    ICode private _code;

    constructor(address code) {
        _code = ICode(code);
    }

    function hackFreeMint(
        uint256 quantity,
        uint256 ticket,
        bytes32[] calldata merkleProof
    ) external {
        _code.freeMint(quantity, ticket, merkleProof);
    }
}
