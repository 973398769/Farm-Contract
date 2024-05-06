// "SPDX-License-Identifier: UNLICENSED"
pragma solidity 0.6.12;

import "../interfaces/IAdmin.sol";
import "./C2NSale.sol";

contract SalesFactory {
    IAdmin public admin;
    address public allocationStaking;

    mapping (address => bool) public isSalesCreatedThroughFactory;

    mapping (address => address) public saleOwnerToSale;
    mapping (address => address) public tokenToSale;

    // Expose so query can be possible only by position as well
    address [] public allSales;

    event SaleDeployed(address saleContract);
    event SaleOwnerAndTokenSetInFactory(address sale, address saleOwner, address saleToken);

    modifier onlyAdmin {
        require(admin.isAdmin(msg.sender), "Only Admin can deploy sales");
        _;
    }

    constructor (address _adminContract, address _allocationStaking) public {
        admin = IAdmin(_adminContract);
        allocationStaking = _allocationStaking;
    }

    // Set allocation staking contract address.
    function setAllocationStaking(address _allocationStaking) public onlyAdmin {
        require(_allocationStaking != address(0));
        allocationStaking = _allocationStaking;
    }
    
}