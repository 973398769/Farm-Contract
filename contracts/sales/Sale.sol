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

    // Pointer to Allocation staking contract
    IAllocationStaking public allocationStakingContract;
    // Pointer to sales factory contract
    ISalesFactory public factory;
    // Admin contract
    IAdmin public admin;

    struct Sale {
        // Token being sold
        IERC20 token;
        // Is sale created
        bool isCreated;
        // Are earnings withdrawn
        bool earningsWithdrawn;
        // Is leftover withdrawn
        bool leftoverWithdrawn;
        // Have tokens been deposited
        bool tokensDeposited;
        // Address of sale owner
        address saleOwner;
        // Price of the token quoted in ETH
        uint256 tokenPriceInETH;
        // Amount of tokens to sell
        uint256 amountOfTokensToSell;
        // Total tokens being sold
        uint256 totalTokensSold;
        // Total ETH Raised
        uint256 totalETHRaised;
        // Sale start time
        uint256 saleStart;
        // Sale end time
        uint256 saleEnd;
        // When tokens can be withdrawn
        uint256 tokensUnlockTime;
        // maxParticipation
        uint256 maxParticipation;
    }

    // Participation structure
    struct Participation {
        uint256 amountBought;
        uint256 amountETHPaid;
        uint256 timeParticipated;
        bool[] isPortionWithdrawn;
    }

    struct Registration {
        uint256 registrationTimeStarts;
        uint256 registrationTimeEnds;
        uint256 numberOfRegistrants;
    }

    // Sale
    Sale public sale;
    // Registration
    Registration public registration;
    // Number of users participated in the sale.
    uint256 public numberOfParticipants;
    // Mapping user to his participation
    mapping(address => Participation) public userToParticipation;
    // Mapping if user is registered or not
    mapping(address => bool) public isRegistered;
    // mapping if user is participated or not
    mapping(address => bool) public isParticipated;
    // Times when portions are getting unlocked
    uint256[] public vestingPortionsUnlockTime;
    // Percent of the participation user can withdraw
    uint256[] public vestingPercentPerPortion;
    //Precision for percent for portion vesting
    uint256 public portionVestingPrecision;
    // Max vesting time shift
    uint256 public maxVestingTimeShift;

    // Restricting calls only to sale owner
    modifier onlySaleOwner() {
        require(msg.sender == sale.saleOwner, "OnlySaleOwner:: Restricted");
        _;
    }

    modifier onlyAdmin() {
        require(
            admin.isAdmin(msg.sender),
            "Only admin can call this function."
        );
        _;
    }

    // Events
    event TokensSold(address user, uint256 amount);
    event UserRegistered(address user);
    event TokenPriceSet(uint256 newPrice);
    event MaxParticipationSet(uint256 maxParticipation);
    event TokensWithdrawn(address user, uint256 amount);
    event SaleCreated(
        address saleOwner,
        uint256 tokenPriceInETH,
        uint256 amountOfTokensToSell,
        uint256 saleEnd
    );
    event StartTimeSet(uint256 startTime);
    event RegistrationTimeSet(
        uint256 registrationTimeStarts,
        uint256 registrationTimeEnds
    );

    // Constructor, always initialized through SalesFactory
    constructor(address _admin, address _allocationStaking) public {
        require(_admin != address(0));
        require(_allocationStaking != address(0));
        admin = IAdmin(_admin);
        factory = ISalesFactory(msg.sender);
        allocationStakingContract = IAllocationStaking(_allocationStaking);
    }

    /// @notice         Function to set vesting params
    function setVestingParams(
        uint256[] memory _unlockingTimes,
        uint256[] memory _percents,
        uint256 _maxVestingTimeShift
    ) external onlyAdmin {
        require(
            vestingPercentPerPortion.length == 0 &&
            vestingPortionsUnlockTime.length == 0
        );
        require(_unlockingTimes.length == _percents.length);
        require(portionVestingPrecision > 0, "Safeguard for making sure setSaleParams get first called.");
        require(_maxVestingTimeShift <= 30 days, "Maximal shift is 30 days.");

        // Set max vesting time shift
        maxVestingTimeShift = _maxVestingTimeShift;

        uint256 sum;

        for (uint256 i = 0; i < _unlockingTimes.length; i++) {
            vestingPortionsUnlockTime.push(_unlockingTimes[i]);
            vestingPercentPerPortion.push(_percents[i]);
            sum += _percents[i];
        }

        require(sum == portionVestingPrecision, "Percent distribution issue.");
    }

    function shiftVestingUnlockingTimes(uint256 timeToShift) external onlyAdmin
    {
        require(
            timeToShift > 0 && timeToShift < maxVestingTimeShift,
            "Shift must be nonzero and smaller than maxVestingTimeShift."
        );

        // Time can be shifted only once.
        maxVestingTimeShift = 0;

        for (uint256 i = 0; i < vestingPortionsUnlockTime.length; i++) {
            vestingPortionsUnlockTime[i] = vestingPortionsUnlockTime[i].add(
                timeToShift
            );
        }
    }

    /// @notice     Admin function to set sale parameters
    function setSaleParams(
        address _token,
        address _saleOwner,
        uint256 _tokenPriceInETH,
        uint256 _amountOfTokensToSell,
        uint256 _saleEnd,
        uint256 _tokensUnlockTime,
        uint256 _portionVestingPrecision,
        uint256 _maxParticipation
    ) external onlyAdmin {
        require(!sale.isCreated, "setSaleParams: Sale is already created.");
        require(
            _saleOwner != address(0),
            "setSaleParams: Sale owner address can not be 0."
        );
        require(
            _tokenPriceInETH != 0 &&
            _amountOfTokensToSell != 0 &&
            _saleEnd > block.timestamp &&
            _tokensUnlockTime > block.timestamp &&
            _maxParticipation > 0,
            "setSaleParams: Bad input"
        );
        require(_portionVestingPrecision >= 100, "Should be at least 100");

        // Set params
        sale.token = IERC20(_token);
        sale.isCreated = true;
        sale.saleOwner = _saleOwner;
        sale.tokenPriceInETH = _tokenPriceInETH;
        sale.amountOfTokensToSell = _amountOfTokensToSell;
        sale.saleEnd = _saleEnd;
        sale.tokensUnlockTime = _tokensUnlockTime;
        sale.maxParticipation = _maxParticipation;

        // Set portion vesting precision
        portionVestingPrecision = _portionVestingPrecision;
        // Emit event
        emit SaleCreated(
            sale.saleOwner,
            sale.tokenPriceInETH,
            sale.amountOfTokensToSell,
            sale.saleEnd
        );
    }

    // @notice     Function to retroactively set sale token address, can be called only once,
    //             after initial contract creation has passed. Added as an options for teams which
    //             are not having token at the moment of sale launch.
    function setSaleToken(
        address saleToken
    )
    external
    onlyAdmin
    {
        require(address(sale.token) == address(0));
        sale.token = IERC20(saleToken);
    }


    /// @notice     Function to set registration period parameters
    function setRegistrationTime(
        uint256 _registrationTimeStarts,
        uint256 _registrationTimeEnds
    ) external onlyAdmin {
        require(sale.isCreated);
        require(registration.registrationTimeStarts == 0);
        require(
            _registrationTimeStarts >= block.timestamp &&
            _registrationTimeEnds > _registrationTimeStarts
        );
        require(_registrationTimeEnds < sale.saleEnd);

        if (sale.saleStart > 0) {
            require(_registrationTimeEnds < sale.saleStart, "registrationTimeEnds >= sale.saleStart is not allowed");
        }

        registration.registrationTimeStarts = _registrationTimeStarts;
        registration.registrationTimeEnds = _registrationTimeEnds;

        emit RegistrationTimeSet(
            registration.registrationTimeStarts,
            registration.registrationTimeEnds
        );
    }

    function setSaleStart(
        uint256 starTime
    ) external onlyAdmin {
        require(sale.isCreated, "sale is not created.");
        require(sale.saleStart == 0, "setSaleStart: starTime is set already.");
        require(starTime > registration.registrationTimeEnds, "start time should greater than registrationTimeEnds.");
        require(starTime < sale.saleEnd, "start time should less than saleEnd time");
        require(starTime >= block.timestamp, "start time should be in the future.");
        sale.saleStart = starTime;

        // Fire event
        emit StartTimeSet(sale.saleStart);
    }

    /// @notice     Registration for sale.
    /// @param      signature is the message signed by the backend
    function registerForSale(bytes memory signature, uint256 pid)
    external
    {
        require(
            block.timestamp >= registration.registrationTimeStarts &&
            block.timestamp <= registration.registrationTimeEnds,
            "Registration gate is closed."
        );
        require(
            checkRegistrationSignature(signature, msg.sender),
            "Invalid signature"
        );
        require(
            !isRegistered[msg.sender],
            "User can not register twice."
        );
        isRegistered[msg.sender] = true;

        // Lock users stake
        allocationStakingContract.setTokensUnlockTime(
            pid,
            msg.sender,
            sale.saleEnd
        );

        // Increment number of registered users
        registration.numberOfRegistrants++;
        // Emit Registration event
        emit UserRegistered(msg.sender);
    }

    /// @notice     Admin function, to update token price before sale to match the closest $ desired rate.
    /// @dev        This will be updated with an oracle during the sale every N minutes, so the users will always
    ///             pay initialy set $ value of the token. This is to reduce reliance on the ETH volatility.
    function updateTokenPriceInETH(uint256 price) external onlyAdmin {
        require(price > 0, "Price can not be 0.");
        // Allowing oracle to run and change the sale value
        sale.tokenPriceInETH = price;
        emit TokenPriceSet(price);
    }

    /// @notice     Admin function to postpone the sale
    function postponeSale(uint256 timeToShift) external onlyAdmin {
        require(
            block.timestamp < sale.saleStart,
            "sale already started."
        );
        //  postpone registration start time
        sale.saleStart = sale.saleStart.add(timeToShift);
        require(
            sale.saleStart + timeToShift < sale.saleEnd,
            "Start time can not be greater than end time."
        );
    }

    /// @notice     Function to extend registration period
    function extendRegistrationPeriod(uint256 timeToAdd) external onlyAdmin {
        require(
            registration.registrationTimeEnds.add(timeToAdd) <
            sale.saleStart,
            "Registration period overflows sale start."
        );

        registration.registrationTimeEnds = registration
            .registrationTimeEnds
            .add(timeToAdd);
    }

    /// @notice     Admin function to set max participation before sale start
    function setCap(uint256 cap)
    external
    onlyAdmin
    {
        require(
            block.timestamp < sale.saleStart,
            "sale already started."
        );

        require(cap > 0, "Can't set max participation to 0");

        sale.maxParticipation = cap;

        emit MaxParticipationSet(sale.maxParticipation);
    }

    // Function for owner to deposit tokens, can be called only once.
    function depositTokens() external onlySaleOwner {
        require(
            !sale.tokensDeposited, "Deposit can be done only once"
        );

        sale.tokensDeposited = true;

        sale.token.safeTransferFrom(
            msg.sender,
            address(this),
            sale.amountOfTokensToSell
        );
    }

    // Function to withdraw leftover
    function withdrawLeftoverInternal() internal {
        // Make sure sale ended
        require(block.timestamp >= sale.saleEnd, "sale is not ended yet.");

        // Make sure owner can't withdraw twice
        require(!sale.leftoverWithdrawn, "owner can't withdraw leftover twice");
        sale.leftoverWithdrawn = true;

        // Amount of tokens which are not sold
        uint256 leftover = sale.amountOfTokensToSell.sub(sale.totalTokensSold);

        if (leftover > 0) {
            sale.token.safeTransfer(msg.sender, leftover);
        }
    }
    
    /// @notice     Check signature user submits for registration.
    /// @param      signature is the message signed by the trusted entity (backend)
    /// @param      user is the address of user which is registering for sale
    function checkRegistrationSignature(
        bytes memory signature,
        address user
    ) public view returns (bool) {
        bytes32 hash = keccak256(
            abi.encodePacked(user, address(this))
        );
        bytes32 messageHash = hash.toEthSignedMessageHash();
        return admin.isAdmin(messageHash.recover(signature));
    }

    function checkParticipationSignature(
        bytes memory signature,
        address user,
        uint256 amount
    ) public view returns (bool) {
        return
            admin.isAdmin(
            getParticipationSigner(
                signature,
                user,
                amount
            )
        );
    }

    /// @notice     Check who signed the message
    /// @param      signature is the message allowing user to participate in sale
    /// @param      user is the address of user for which we're signing the message
    /// @param      amount is the maximal amount of tokens user can buy
    function getParticipationSigner(
        bytes memory signature,
        address user,
        uint256 amount
    ) public view returns (address) {
        bytes32 hash = keccak256(
            abi.encodePacked(
                user,
                amount,
                address(this)
            )
        );
        bytes32 messageHash = hash.toEthSignedMessageHash();
        return messageHash.recover(signature);
    }

    /// @notice     Function to get participation for passed user address
    function getParticipation(address _user)
    external
    view
    returns (
        uint256,
        uint256,
        uint256,
        bool[] memory
    )
    {
        Participation memory p = userToParticipation[_user];
        return (
            p.amountBought,
            p.amountETHPaid,
            p.timeParticipated,
            p.isPortionWithdrawn
        );
    }

    /// @notice     Function to get number of registered users for sale
    function getNumberOfRegisteredUsers() external view returns (uint256) {
        return registration.numberOfRegistrants;
    }

    /// @notice     Function to get all info about vesting.
    function getVestingInfo()
    external
    view
    returns (uint256[] memory, uint256[] memory)
    {
        return (vestingPortionsUnlockTime, vestingPercentPerPortion);
    }

    // Function to act as a fallback and handle receiving ETH.
    receive() external payable {

    }
}