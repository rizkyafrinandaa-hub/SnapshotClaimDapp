// Contract configuration
const CONTRACT_ADDRESS = 'YOUR_DEPLOYED_CONTRACT_ADDRESS';

const CONTRACT_ABI = [
    "function claim(uint256 baseAmount, uint256 txCount, uint256 firstTxTimestamp, bytes32[] calldata merkleProof) external",
    "function hasClaimed(address) external view returns (bool)",
    "function getEstimatedClaim(address account, uint256 baseAmount, uint256 txCount, uint256 firstTxTimestamp) external view returns (uint256 estimatedAmount, uint256 penaltyPercent)",
    "function snapshotBlock() external view returns (uint256)",
    "function claimEndTime() external view returns (uint256)",
    "function totalClaimed() external view returns (uint256)",
    "function sybilScore(address) external view returns (uint256)",
    "function merkleRoot() external view returns (bytes32)"
];
