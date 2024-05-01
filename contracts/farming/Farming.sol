// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Farming is Ownable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    struct UserInfo {
        uint256 amount;
        uint rewardDebt;
    }
    struct PoolInfo {
        IERC20 lpToken; // Address of LP token contract.
        uint256 allocPoint; // How many allocation points assigned to this pool. ERC20s to distribute per block.
        uint256 lastRewardTimestamp; // Last timestamp that ERC20s distribution occurs.
        uint256 accERC20PerShare; // Accumulated ERC20s per share, times 1e36.
        uint256 totalDeposit; // Total amount of tokens deposited at the moment (staked)
    }
}