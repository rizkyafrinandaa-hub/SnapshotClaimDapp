// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title SybilResistance
 * @notice Library for sybil detection patterns on-chain
 */
library SybilResistance {
    struct AddressMetrics {
        uint256 txCount;
        uint256 firstTxTimestamp;
        uint256 uniqueInteractions;
        uint256 totalVolume;
        bool hasENS;
    }
    
    /**
     * @notice Calculate sybil risk score (0-100)
     */
    function calculateRiskScore(
        AddressMetrics memory metrics,
        uint256 snapshotTime
    ) internal pure returns (uint256) {
        uint256 score = 0;
        
        // Low transaction count (0-30 points)
        if (metrics.txCount < 5) {
            score += 30;
        } else if (metrics.txCount < 20) {
            score += 15;
        }
        
        // Recent account (0-25 points)
        uint256 accountAge = snapshotTime - metrics.firstTxTimestamp;
        if (accountAge < 7 days) {
            score += 25;
        } else if (accountAge < 30 days) {
            score += 15;
        }
        
        // Low unique interactions (0-20 points)
        if (metrics.uniqueInteractions < 3) {
            score += 20;
        } else if (metrics.uniqueInteractions < 10) {
            score += 10;
        }
        
        // Low volume (0-15 points)
        if (metrics.totalVolume < 0.1 ether) {
            score += 15;
        } else if (metrics.totalVolume < 1 ether) {
            score += 7;
        }
        
        // No ENS (0-10 points)
        if (!metrics.hasENS) {
            score += 10;
        }
        
        return score > 100 ? 100 : score;
    }
    
    /**
     * @notice Detect star topology pattern (common in sybil attacks)
     */
    function isStarTopology(
        address[] memory relatedAddresses,
        uint256 threshold
    ) internal pure returns (bool) {
        return relatedAddresses.length >= threshold;
    }
}
