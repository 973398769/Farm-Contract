//"SPDX-License-Identifier: UNLICENSED"
pragma solidity 0.6.12;

import "../interfaces/IAdmin.sol";
import "../interfaces/ISalesFactory.sol";
import "../interfaces/IAllocationStaking.sol";
import "../interfaces/IERC20Metadata.sol";
import "@openzeppelin/contracts/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract C2NSale is ReentrancyGuard {
    using ECDSA for bytes32;
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

}