// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

import "./interfaces/ERC721.sol";
import "./interfaces/Seaport.sol";

import "./lib/Constants.sol";
import "./lib/MobStruct.sol";

contract XmobExchangeCore is
    Initializable,
    OwnableUpgradeable,
    UUPSUpgradeable
{
    using SafeMath for uint256;

    string public constant VERSION = "1.0.0";

    /** @dev bytes4(keccak256("isValidSignature(bytes32,bytes)") */
    bytes4 internal constant MAGIC_VALUE = 0x1626ba7e;

    bytes public constant MAGIC_SIGNATURE = "0x42";

    /** @dev seaport Opensea proxy  */
    //todo: change to const for production
    address public SEAPORT_CORE = 0x00000000006c3852cbEf3e08E8dF289169EdE581;

    MobMetadata public metadata;
    address[] public members;

    mapping(address => uint256) public memberDetails;

    mapping(address => uint256) public settlements;

    mapping(bytes32 => bool) public registerOrderHashDigest; // orderHash eip1271 digest

    event MemberJoin(address member, uint256 value);
    event Buy(address indexed seller, uint256 price);
    event Settlement(uint256 total, uint256 time);
    event SettlementAfterDeadline(uint256 total, uint256 time);
    event SettlementAfterBuyFailed(uint256 total);
    event DepositEth(address sender, uint256 amt);
    event Claim(address member, uint256 amt);
    event RefundAfterRaiseFailed(address member, uint256 amt);

    modifier requireStatus(MobStatus _status) {
        require(metadata.status == _status, "wrong status");
        _;
    }

    // Whether the mob deadline has reached
    modifier deadlineReached() {
        require(block.timestamp > metadata.deadline, "still in deadline");
        _;
    }

    // Whether the raising has close the time window
    modifier fundRaiseTimeClosed() {
        require(block.timestamp > metadata.raiseDeadline, "fund raising");
        _;
    }

    // Whether the raising is open
    modifier fundRaiseOpen() {
        require(block.timestamp < metadata.raiseDeadline, "time closed");
        require(
            metadata.raisedAmount < metadata.raiseTarget,
            "target already meet"
        );
        _;
    }

    // Whether the raising is open
    modifier fundRaiseFailed() {
        require(block.timestamp > metadata.raiseDeadline, "time not closed");
        require(
            metadata.raisedAmount < metadata.raiseTarget,
            "target already meet"
        );
        _;
    }

    // Whether the raising has been successfully completed
    modifier fundRaiseMeetsTarget() {
        require(
            metadata.raisedAmount == metadata.raiseTarget,
            "target not meet"
        );
        _;
    }

    // Whether the NFT has been successfully owned
    modifier ownedNFT() {
        if (metadata.targetMode == TargetMode.FULL_OPEN) {
            uint256 bal = ERC721(metadata.token).balanceOf(address(this));
            require(bal > 0, "no nft bal");
        }

        if (metadata.targetMode == TargetMode.RESTRICT) {
            address owner = ERC721(metadata.token).ownerOf(metadata.tokenId);
            require(owner == address(this), "not nft owner");
        }
        _;
    }

    // Whether the NFT has been unowned
    modifier unownedNFT() {
        if (metadata.targetMode == TargetMode.FULL_OPEN) {
            uint256 bal = ERC721(metadata.token).balanceOf(address(this));
            require(bal == 0, "nft bal not 0");
        }

        if (metadata.targetMode == TargetMode.RESTRICT) {
            address owner = ERC721(metadata.token).ownerOf(metadata.tokenId);
            require(owner != address(this), "nft still owned");
        }
        _;
    }

    // @custom:oz-upgrades-unsafe-allow constructor
    constructor() initializer {}

    function initialize(
        address _creator,
        address _token,
        uint256 _tokenId,
        uint256 _fee,
        uint256 _raiseTarget,
        uint256 _takeProfitPrice,
        uint256 _stopLossPrice,
        uint64 _raiseDeadline,
        uint64 _deadline,
        uint8 _targetMode,
        string memory _name
    ) public payable initializer {
        __Ownable_init();
        __UUPSUpgradeable_init();

        require(_raiseTarget >= MINIMAL_RAISE_TARGET, "raiseTarget too small");
        require(_fee < _raiseTarget, "Fee error");
        require(_deadline > _raiseDeadline, "Deadline error");
        require(_raiseDeadline > block.timestamp, "EndTime gt now");
        require(_takeProfitPrice > _stopLossPrice, "price error");

        metadata.creator = _creator;
        metadata.token = _token;
        metadata.tokenId = _tokenId;
        metadata.fee = _fee;
        metadata.raiseTarget = _raiseTarget;
        metadata.takeProfitPrice = _takeProfitPrice;
        metadata.stopLossPrice = _stopLossPrice;
        metadata.deadline = _deadline;
        metadata.raiseDeadline = _raiseDeadline;
        metadata.name = _name;
        metadata.status = MobStatus.RAISING;

        TargetMode targetMode = _getTargetMode(_targetMode);
        metadata.targetMode = targetMode;

        if (msg.value > 0) {
            memberDeposit(_creator, msg.value);
        }

        // Approve All Token Nft-Id For SeaportCore contract
        ERC721(_token).setApprovalForAll(SEAPORT_CORE, true);
    }

    /**
     * @notice UUPS upgrade authorize
     */
    function _authorizeUpgrade(address newImplementation)
        internal
        view
        override
    {
        require(
            newImplementation != address(0) && msg.sender == owner(),
            "auth upgrade failed"
        );
    }

    receive() external payable {
        if (msg.value > 0) {
            emit DepositEth(msg.sender, msg.value);
        }
    }

    /**
     * @notice members join pay ETH
     */
    function joinPay(address member)
        public
        payable
        fundRaiseOpen
        requireStatus(MobStatus.RAISING)
    {
        memberDeposit(member, msg.value);
    }

    function memberDeposit(address addr, uint256 amt)
        internal
        fundRaiseOpen
        requireStatus(MobStatus.RAISING)
    {
        require(amt > 0, "Value must gt 0");
        require(
            metadata.raiseTarget >= metadata.raisedAmount + amt,
            "Exceeding the limit"
        );

        if (memberDetails[addr] == 0) {
            members.push(addr);
        }
        memberDetails[addr] = memberDetails[addr] + amt;

        if (metadata.raiseTarget == metadata.raisedAmount + amt) {
            _applyNextStatus();
        }

        metadata.raisedAmount += amt;

        emit MemberJoin(addr, amt);
    }

    /** @notice refund stake after raise failed */
    function refundAfterRaiseFailed()
        public
        fundRaiseTimeClosed
        requireStatus(MobStatus.RAISING)
    {
        require(memberDetails[msg.sender] > 0, "no share");

        uint256 amt = memberDetails[msg.sender];
        memberDetails[msg.sender] = 0;
        metadata.raisedAmount -= amt;

        payable(msg.sender).transfer(amt);

        emit RefundAfterRaiseFailed(msg.sender, amt);
    }

    // simple eth_to_erc721 buying
    function buyBasicOrder(BasicOrderParameters calldata parameters)
        external
        payable
        fundRaiseMeetsTarget
        requireStatus(MobStatus.RAISE_SUCCESS)
        returns (bool isFulFilled)
    {
        _verifyBuyBasicOrder(parameters);

        _takeFeeBeforeBuy();

        bool isSuccess = SeaportInterface(SEAPORT_CORE).fulfillBasicOrder{
            value: address(this).balance
        }(parameters);

        if (isSuccess) {
            emit Buy(parameters.offerer, address(this).balance);
            _applyNextStatus();
        }

        return isSuccess;
    }

    function _verifyBuyBasicOrder(BasicOrderParameters calldata parameters)
        internal
        view
    {
        require(
            parameters.basicOrderType == BasicOrderType.ETH_TO_ERC721_FULL_OPEN,
            "wrong order type"
        );
        require(parameters.offerToken == metadata.token, "buying wrong token");
        require(
            parameters.fulfillerConduitKey == bytes32(0),
            "fulfillerConduitKey must be zero"
        );

        if (metadata.targetMode == TargetMode.RESTRICT) {
            require(
                parameters.offerIdentifier == metadata.tokenId,
                "wrong offer.tokenId"
            );
        }
    }

    // buy with seaport fulFillOrder
    function buyOrder(Order calldata order, bytes32 fulfillerConduitKey)
        external
        payable
        fundRaiseMeetsTarget
        requireStatus(MobStatus.RAISE_SUCCESS)
        returns (bool isFulFilled)
    {
        _verifyBuyOrder(order);
        _verifyFulfillerConduitKey(fulfillerConduitKey);

        _takeFeeBeforeBuy();

        bool isSuccess = SeaportInterface(SEAPORT_CORE).fulfillOrder{
            value: address(this).balance
        }(order, fulfillerConduitKey);

        if (isSuccess) {
            emit Buy(order.parameters.offerer, address(this).balance);
        }

        return isSuccess;
    }

    function _verifyFulfillerConduitKey(bytes32 fulfillerConduitKey)
        internal
        pure
    {
        require(fulfillerConduitKey == bytes32(0), "fulfillerConduitKey not 0");
    }

    function _verifyBuyOrder(Order calldata order) internal view {
        OrderParameters calldata orderParameters = order.parameters;
        // check order parameters
        require(orderParameters.offer.length == 1, "offer length !=1");
        require(
            orderParameters.consideration.length == 1,
            "consideration length !=1"
        );
        require(
            orderParameters.totalOriginalConsiderationItems == uint256(1),
            "OriginalConsider != 1"
        );

        _verifyBuyOrderOfferItem(orderParameters.offer[0]);
        _verifyBuyOrderConsiderationItem(orderParameters.consideration[0]);
    }

    function _verifyBuyOrderOfferItem(OfferItem calldata offer) internal view {
        require(offer.itemType == ItemType.ERC721, "wrong offer.ItemType");
        require(offer.token == metadata.token, "wrong offer.token");
        require(offer.startAmount == 1, "wrong offer.startAmount");
        require(offer.endAmount == 1, "wrong offer.endAmount");

        if (metadata.targetMode == TargetMode.RESTRICT) {
            require(
                offer.identifierOrCriteria == metadata.tokenId,
                "wrong offer.tokenId"
            );
        }
    }

    // only accept ether
    function _verifyBuyOrderConsiderationItem(
        ConsiderationItem calldata consider
    ) internal pure {
        require(
            consider.itemType == ItemType.NATIVE,
            "wrong consider.ItemType"
        );
        require(consider.token == address(0), "wrong consider.token");
    }

    function _takeFeeBeforeBuy()
        internal
        fundRaiseMeetsTarget
        requireStatus(MobStatus.RAISE_SUCCESS)
    {
        // let admin take manage fee
        if (metadata.fee > 0) {
            payable(owner()).transfer(metadata.fee);
        }
    }

    // submit sell orders on chain
    // only the offerer require no signature
    function validateSellOrders(Order[] calldata orders)
        external
        ownedNFT
        requireStatus(MobStatus.NFT_BOUGHT)
        returns (bool isValidated)
    {
        _verifySellOrders(orders);

        // submit order ot seaport
        return SeaportInterface(SEAPORT_CORE).validate(orders);
    }

    function _verifySellOrders(Order[] calldata orders) internal view {
        // Skip overflow check as for loop is indexed starting at zero.
        unchecked {
            // Read length of the orders array from memory and place on stack.
            uint256 totalOrders = orders.length;

            // Iterate over each order.
            for (uint256 i = 0; i < totalOrders; ) {
                // Retrieve the order.
                Order calldata order = orders[i];
                // Retrieve the order parameters.
                OrderParameters calldata orderParameters = order.parameters;

                // check order parameters
                require(
                    orderParameters.offerer == address(this),
                    "wrong offerer"
                );
                require(orderParameters.zone == address(0), "zone != 0");
                require(
                    orderParameters.zoneHash == bytes32(0),
                    "zoneHash != 0"
                );

                // allow to accept extra offer/consideration
                require(orderParameters.offer.length >= 1, "offer length 0");
                require(
                    orderParameters.consideration.length >= 1,
                    "consideration length 0"
                );
                require(
                    orderParameters.orderType == OrderType.FULL_OPEN,
                    "wrong orderType"
                );
                require(
                    orderParameters.conduitKey == bytes32(0),
                    "conduitKey != 0"
                );

                // only check if first offer/consideration meet requirement
                _verifyOfferItem(orderParameters.offer[0]);
                _verifyConsiderationItem(orderParameters.consideration[0]);

                // Increment counter inside body of the loop for gas efficiency.
                ++i;
            }
        }
    }

    function _verifyOfferItem(OfferItem calldata offer) internal view {
        require(offer.itemType == ItemType.ERC721, "wrong offer.ItemType");
        require(offer.token == metadata.token, "wrong offer.token");
        require(offer.startAmount == 1, "wrong offer.startAmount");
        require(offer.endAmount == 1, "wrong offer.endAmount");

        if (metadata.targetMode == TargetMode.RESTRICT) {
            require(
                offer.identifierOrCriteria == metadata.tokenId,
                "wrong offer.tokenId"
            );
        }
    }

    // only accept ether
    function _verifyConsiderationItem(ConsiderationItem calldata consider)
        internal
        view
    {
        require(
            consider.itemType == ItemType.NATIVE,
            "wrong consider.ItemType"
        );
        require(consider.token == address(0), "wrong consider.token");

        // TODO: introduce price Oracle to enable stopLossPrice selling
        require(
            consider.startAmount >= metadata.takeProfitPrice,
            "wrong consider.startAmount"
        );
        require(
            consider.endAmount >= metadata.takeProfitPrice,
            "wrong consider.endAmount"
        );

        require(
            consider.recipient == address(this),
            "wrong consider.recipient"
        );
    }

    // register sell orders for later isValidSignature checking
    function registerSellOrder(Order[] calldata orders)
        external
        ownedNFT
        requireStatus(MobStatus.NFT_BOUGHT)
    {
        _verifySellOrders(orders);

        // Skip overflow check as for loop is indexed starting at zero.
        unchecked {
            // Read length of the orders array from memory and place on stack.
            uint256 totalOrders = orders.length;
            uint256 counter = SeaportInterface(SEAPORT_CORE).getCounter(
                address(this)
            );

            // Iterate over each order.
            for (uint256 i = 0; i < totalOrders; ) {
                Order calldata order = orders[i];
                OrderParameters calldata orderParameters = order.parameters;

                OrderComponents memory orderComponents = OrderComponents(
                    orderParameters.offerer,
                    orderParameters.zone,
                    orderParameters.offer,
                    orderParameters.consideration,
                    orderParameters.orderType,
                    orderParameters.startTime,
                    orderParameters.endTime,
                    orderParameters.zoneHash,
                    orderParameters.salt,
                    orderParameters.conduitKey,
                    counter
                );

                // register orderHash
                bytes32 orderHash = SeaportInterface(SEAPORT_CORE).getOrderHash(
                    orderComponents
                );
                // Derive EIP-712 digest using the domain separator and the order hash.
                bytes32 digest = _deriveEIP712Digest(
                    _deriveDomainSeparator(),
                    orderHash
                );
                registerOrderHashDigest[digest] = true;

                // Increment counter inside body of the loop for gas efficiency.
                ++i;
            }
        }
    }

    // taken from seaport contract
    /**
     * @dev Internal pure function to efficiently derive an digest to sign for
     *      an order in accordance with EIP-712.
     *
     * @param domainSeparator The domain separator.
     * @param orderHash       The order hash.
     *
     * @return value The hash.
     */
    function _deriveEIP712Digest(bytes32 domainSeparator, bytes32 orderHash)
        internal
        pure
        returns (bytes32 value)
    {
        // Leverage scratch space to perform an efficient hash.
        assembly {
            // Place the EIP-712 prefix at the start of scratch space.
            mstore(0, EIP_712_PREFIX)

            // Place the domain separator in the next region of scratch space.
            mstore(EIP712_DomainSeparator_offset, domainSeparator)

            // Place the order hash in scratch space, spilling into the first
            // two bytes of the free memory pointer — this should never be set
            // as memory cannot be expanded to that size, and will be zeroed out
            // after the hash is performed.
            mstore(EIP712_OrderHash_offset, orderHash)

            // Hash the relevant region (65 bytes).
            value := keccak256(0, EIP712_DigestPayload_size)

            // Clear out the dirtied bits in the memory pointer.
            mstore(EIP712_OrderHash_offset, 0)
        }
    }

    /**
     * @dev Internal view function to derive the EIP-712 domain separator.
     *
     * @return The derived domain separator.
     */
    function _deriveDomainSeparator() internal view returns (bytes32) {
        bytes32 _EIP_712_DOMAIN_TYPEHASH = keccak256(
            abi.encodePacked(
                "EIP712Domain(",
                "string name,",
                "string version,",
                "uint256 chainId,",
                "address verifyingContract",
                ")"
            )
        );
        // Derive hash of the name of the contract.
        bytes32 nameHash = keccak256(bytes("Seaport"));

        // Derive hash of the version string of the contract.
        bytes32 versionHash = keccak256(bytes("1.1"));

        // prettier-ignore
        return keccak256(
            abi.encode(
                _EIP_712_DOMAIN_TYPEHASH,
                nameHash,
                versionHash,
                block.chainid,
                address(SEAPORT_CORE)
            )
        );
    }

    /** TODO
     * @notice Verifies that the signer is the owner of the signing contract.
     */
    function isValidSignature(
        bytes32 _orderHashDigest,
        bytes calldata _signature
    )
        external
        view
        ownedNFT
        requireStatus(MobStatus.NFT_BOUGHT) // only selling needs signature
        returns (bytes4)
    {
        //TODO ECDSA ECDSA.recover(hash, v, r, s);f
        // only allow seaport contract to call
        require(msg.sender == SEAPORT_CORE, "only seaport");

        // must use special magic signature placeholder
        require(
            keccak256(_signature) == keccak256(MAGIC_SIGNATURE),
            "unallow signature"
        );
        require(
            registerOrderHashDigest[_orderHashDigest] == true,
            "orderHash not register"
        );

        return MAGIC_VALUE;
    }

    /** @dev Distribute profits */
    function settlementAllocation()
        external
        unownedNFT
        requireStatus(MobStatus.NFT_BOUGHT)
    {
        uint256 amt = address(this).balance;
        require(amt > 0, "Amt must gt 0");

        _applyNextStatus();

        for (uint256 i = 0; i < members.length; i++) {
            uint256 share = memberDetails[members[i]];
            settlements[members[i]] = (amt / metadata.raisedAmount) * share;
        }

        emit Settlement(amt, block.timestamp);
    }

    /** @dev Distribute profits after deadline,
     *  use for two situation
     *      1. nft balance attacking(contract already sold nft)
     *      2. nft can not be sold after deadline
     *
     * Note: another way to deal with nft balance attacking
     * is to continually sell the new receieved attacking nft
     * to empty the balance so that settlement can be called.
     * In that case, members might gain some extra profit,
     * and there remains little motivation for attacker to do that.
     */
    function settlementAfterDeadline()
        external
        deadlineReached
        requireStatus(MobStatus.NFT_BOUGHT)
    {
        uint256 amt = address(this).balance;
        require(amt > 0, "Amt must gt 0");

        _applyNextStatus();

        for (uint256 i = 0; i < members.length; i++) {
            uint256 share = memberDetails[members[i]];
            settlements[members[i]] = (amt / metadata.raisedAmount) * share;
        }

        emit SettlementAfterDeadline(amt, block.timestamp);
    }

    /** @dev refund after deadline, use for buy failed */
    function settlementAfterBuyFailed()
        external
        deadlineReached
        requireStatus(MobStatus.RAISE_SUCCESS)
    {
        uint256 amt = address(this).balance;
        require(amt > 0, "Amt must gt 0");

        _applyNextStatus();

        for (uint256 i = 0; i < members.length; i++) {
            uint256 share = memberDetails[members[i]];
            settlements[members[i]] = (amt / metadata.raisedAmount) * share;
        }

        emit SettlementAfterBuyFailed(amt);
    }

    /** @dev receive income  */
    function claim() public requireStatus(MobStatus.CAN_CLAIM) {
        uint256 amt = settlements[msg.sender];
        if (amt > 0) {
            settlements[msg.sender] = 0;
            emit Claim(msg.sender, amt);
        }

        bool isAllClaimed = true;
        for (uint256 i = 0; i < members.length; i++) {
            if (settlements[members[i]] > 0) {
                isAllClaimed = false;
            }
        }
        if (isAllClaimed) {
            _applyNextStatus();
        }

        if (amt > 0) {
            payable(msg.sender).transfer(amt);
        }
    }

    function _applyNextStatus() internal {
        metadata.status = MobStatus(uint256(metadata.status) + 1);
    }

    function _getTargetMode(uint8 mode)
        internal
        pure
        returns (TargetMode targetMode)
    {
        if (mode == uint256(TargetMode.RESTRICT)) {
            return TargetMode.RESTRICT;
        } else if (mode == uint256(TargetMode.FULL_OPEN)) {
            return TargetMode.RESTRICT;
        } else {
            revert("invalid target mode");
        }
    }

    // todo: remove this
    // only for local test
    function setSeaportAddress(address seaport) external {
        SEAPORT_CORE = seaport;
        // Approve All Token Nft-Id For SeaportCore contract
        ERC721(metadata.token).setApprovalForAll(SEAPORT_CORE, true);
    }
}
