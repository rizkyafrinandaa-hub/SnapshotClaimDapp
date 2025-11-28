// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title SnapshotClaim
 * @notice Claim tokens based on snapshot balance at specific block with sybil-resistance
 */
contract SnapshotClaim is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable claimToken;
    IERC20 public immutable snapshotToken;
    
    bytes32 public merkleRoot;
    uint256 public immutable snapshotBlock;
    uint256 public claimEndTime;
    
    // Sybil resistance parameters
    uint256 public constant MIN_HOLDING_DURATION = 7 days;
    uint256 public constant MIN_TX_COUNT = 5;
    uint256 public constant SYBIL_PENALTY_PERCENT = 50; // 50% reduction for suspicious accounts
    
    mapping(address => bool) public hasClaimed;
    mapping(address => uint256) public sybilScore; // 0-100, higher = more suspicious
    mapping(address => bool) public isBlacklisted;
    
    uint256 public totalClaimed;
    uint256 public totalEligible;
    
    event SnapshotTaken(uint256 indexed blockNumber, uint256 timestamp);
    event MerkleRootUpdated(bytes32 indexed newRoot);
    event Claimed(address indexed account, uint256 amount, uint256 penaltyApplied);
    event SybilScoreUpdated(address indexed account, uint256 score);
    event AddressBlacklisted(address indexed account);
    
    error AlreadyClaimed();
    error InvalidProof();
    error ClaimPeriodEnded();
    error Blacklisted();
    error ClaimAmountZero();
    
    constructor(
        address _claimToken,
        address _snapshotToken,
        uint256 _snapshotBlock,
        uint256 _claimDuration
    ) Ownable(msg.sender) {
        claimToken = IERC20(_claimToken);
        snapshotToken = IERC20(_snapshotToken);
        snapshotBlock = _snapshotBlock;
        claimEndTime = block.timestamp + _claimDuration;
        
        emit SnapshotTaken(_snapshotBlock, block.timestamp);
    }
    
    /**
     * @notice Update Merkle root (only owner)
     */
    function setMerkleRoot(bytes32 _merkleRoot) external onlyOwner {
        merkleRoot = _merkleRoot;
        emit MerkleRootUpdated(_merkleRoot);
    }
    
    /**
     * @notice Set sybil score for addresses (called by off-chain analysis)
     */
    function setSybilScores(
        address[] calldata accounts,
        uint256[] calldata scores
    ) external onlyOwner {
        require(accounts.length == scores.length, "Length mismatch");
        
        for (uint256 i = 0; i < accounts.length; i++) {
            require(scores[i] <= 100, "Score must be 0-100");
            sybilScore[accounts[i]] = scores[i];
            emit SybilScoreUpdated(accounts[i], scores[i]);
        }
    }
    
    /**
     * @notice Blacklist suspicious addresses
     */
    function blacklistAddresses(address[] calldata accounts) external onlyOwner {
        for (uint256 i = 0; i < accounts.length; i++) {
            isBlacklisted[accounts[i]] = true;
            emit AddressBlacklisted(accounts[i]);
        }
    }
    
    /**
     * @notice Claim tokens with sybil-resistance check
     */
    function claim(
        uint256 baseAmount,
        uint256 txCount,
        uint256 firstTxTimestamp,
        bytes32[] calldata merkleProof
    ) external nonReentrant {
        if (block.timestamp > claimEndTime) revert ClaimPeriodEnded();
        if (hasClaimed[msg.sender]) revert AlreadyClaimed();
        if (isBlacklisted[msg.sender]) revert Blacklisted();
        if (baseAmount == 0) revert ClaimAmountZero();
        
        // Verify Merkle proof
        bytes32 leaf = keccak256(
            bytes.concat(
                keccak256(
                    abi.encode(
                        msg.sender,
                        baseAmount,
                        txCount,
                        firstTxTimestamp
                    )
                )
            )
        );
        
        if (!MerkleProof.verify(merkleProof, merkleRoot, leaf)) {
            revert InvalidProof();
        }
        
        // Calculate final amount with sybil resistance
        uint256 finalAmount = _calculateClaimAmount(
            baseAmount,
            txCount,
            firstTxTimestamp
        );
        
        hasClaimed[msg.sender] = true;
        totalClaimed += finalAmount;
        
        uint256 penalty = baseAmount > finalAmount ? baseAmount - finalAmount : 0;
        
        claimToken.safeTransfer(msg.sender, finalAmount);
        
        emit Claimed(msg.sender, finalAmount, penalty);
    }
    
    /**
     * @notice Calculate claim amount with sybil-resistance penalties
     */
    function _calculateClaimAmount(
        uint256 baseAmount,
        uint256 txCount,
        uint256 firstTxTimestamp
    ) internal view returns (uint256) {
        uint256 finalAmount = baseAmount;
        uint256 penaltyPercent = 0;
        
        // Check holding duration
        uint256 holdingDuration = snapshotBlock - firstTxTimestamp;
        if (holdingDuration < MIN_HOLDING_DURATION) {
            penaltyPercent += 20; // 20% penalty for short holding
        }
        
        // Check transaction count
        if (txCount < MIN_TX_COUNT) {
            penaltyPercent += 15; // 15% penalty for low activity
        }
        
        // Apply sybil score penalty
        uint256 score = sybilScore[msg.sender];
        if (score > 70) {
            penaltyPercent += SYBIL_PENALTY_PERCENT; // High sybil score
        } else if (score > 40) {
            penaltyPercent += 25; // Medium sybil score
        }
        
        // Cap penalty at 80%
        if (penaltyPercent > 80) {
            penaltyPercent = 80;
        }
        
        // Apply penalty
        if (penaltyPercent > 0) {
            finalAmount = (baseAmount * (100 - penaltyPercent)) / 100;
        }
        
        return finalAmount;
    }
    
    /**
     * @notice Get estimated claim amount for an address
     */
    function getEstimatedClaim(
        address account,
        uint256 baseAmount,
        uint256 txCount,
        uint256 firstTxTimestamp
    ) external view returns (uint256 estimatedAmount, uint256 penaltyPercent) {
        if (isBlacklisted[account]) {
            return (0, 100);
        }
        
        uint256 finalAmount = _calculateClaimAmount(baseAmount, txCount, firstTxTimestamp);
        uint256 penalty = baseAmount > finalAmount 
            ? ((baseAmount - finalAmount) * 100) / baseAmount 
            : 0;
            
        return (finalAmount, penalty);
    }
    
    /**
     * @notice Extend claim period
     */
    function extendClaimPeriod(uint256 additionalTime) external onlyOwner {
        claimEndTime += additionalTime;
    }
    
    /**
     * @notice Withdraw unclaimed tokens after claim period
     */
    function withdrawUnclaimed() external onlyOwner {
        require(block.timestamp > claimEndTime, "Claim period active");
        uint256 balance = claimToken.balanceOf(address(this));
        claimToken.safeTransfer(owner(), balance);
    }
    
    /**
     * @notice Emergency withdraw
     */
    function emergencyWithdraw(address token) external onlyOwner {
        uint256 balance = IERC20(token).balanceOf(address(this));
        IERC20(token).safeTransfer(owner(), balance);
    }
}
