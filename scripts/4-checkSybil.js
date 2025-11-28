const fs = require('fs');
const csv = require('csv-parser');

/**
 * Analyze addresses for sybil patterns based on research findings
 * Reference: Star topology, temporal clustering, low activity patterns
 */
async function analyzeSybilPatterns() {
    console.log("🔍 Analyzing sybil patterns...\n");
    
    const addresses = [];
    const transactionGraph = new Map(); // address -> [related addresses]
    
    // Read snapshot data
    await new Promise((resolve, reject) => {
        fs.createReadStream('data/snapshot-data.csv')
            .pipe(csv())
            .on('data', (row) => {
                addresses.push({
                    address: row.Address,
                    balance: parseFloat(row.Balance),
                    txCount: parseInt(row.TxCount),
                    firstTxTimestamp: parseInt(row.FirstTxTimestamp),
                    uniqueInteractions: parseInt(row.UniqueInteractions)
                });
            })
            .on('end', resolve)
            .on('error', reject);
    });
    
    console.log(`Analyzing ${addresses.length} addresses...\n`);
    
    const sybilScores = [];
    const flaggedAddresses = [];
    
    for (const addr of addresses) {
        let score = 0;
        const flags = [];
        
        // 1. Low transaction count (0-30 points)
        if (addr.txCount < 5) {
            score += 30;
            flags.push('very_low_tx_count');
        } else if (addr.txCount < 20) {
            score += 15;
            flags.push('low_tx_count');
        }
        
        // 2. Recent account age (0-25 points)
        const currentTime = Math.floor(Date.now() / 1000);
        const accountAge = currentTime - addr.firstTxTimestamp;
        const daysSinceFirstTx = accountAge / (24 * 60 * 60);
        
        if (daysSinceFirstTx < 7) {
            score += 25;
            flags.push('very_new_account');
        } else if (daysSinceFirstTx < 30) {
            score += 15;
            flags.push('new_account');
        }
        
        // 3. Low unique interactions (0-20 points)
        if (addr.uniqueInteractions < 3) {
            score += 20;
            flags.push('very_low_interactions');
        } else if (addr.uniqueInteractions < 10) {
            score += 10;
            flags.push('low_interactions');
        }
        
        // 4. Suspicious balance patterns (0-15 points)
        if (addr.balance < 0.1) {
            score += 15;
            flags.push('dust_balance');
        } else if (addr.balance < 1.0) {
            score += 7;
            flags.push('low_balance');
        }
        
        // 5. High tx count but low interactions (potential automation)
        if (addr.txCount > 50 && addr.uniqueInteractions < 5) {
            score += 10;
            flags.push('automated_pattern');
        }
        
        // Cap score at 100
        score = Math.min(score, 100);
        
        const result = {
            address: addr.address,
            sybilScore: score,
            flags: flags.join(','),
            risk: score > 70 ? 'HIGH' : score > 40 ? 'MEDIUM' : 'LOW',
            txCount: addr.txCount,
            accountAgeDays: daysSinceFirstTx.toFixed(1),
            uniqueInteractions: addr.uniqueInteractions
        };
        
        sybilScores.push(result);
        
        if (score > 70) {
            flaggedAddresses.push(result);
        }
    }
    
    // Sort by score (highest first)
    sybilScores.sort((a, b) => b.sybilScore - a.sybilScore);
    
    // Save results
    fs.writeFileSync(
        'data/sybil-scores.json',
        JSON.stringify({
            timestamp: new Date().toISOString(),
            totalAnalyzed: addresses.length,
            highRisk: sybilScores.filter(s => s.risk === 'HIGH').length,
            mediumRisk: sybilScores.filter(s => s.risk === 'MEDIUM').length,
            lowRisk: sybilScores.filter(s => s.risk === 'LOW').length,
            scores: sybilScores
        }, null, 2)
    );
    
    // Save flagged addresses for blacklist
    fs.writeFileSync(
        'data/flagged-addresses.json',
        JSON.stringify({
            timestamp: new Date().toISOString(),
            totalFlagged: flaggedAddresses.length,
            addresses: flaggedAddresses
        }, null, 2)
    );
    
    // Print summary
    console.log("📊 Sybil Analysis Summary:");
    console.log(`  Total Analyzed: ${addresses.length}`);
    console.log(`  🔴 High Risk: ${sybilScores.filter(s => s.risk === 'HIGH').length}`);
    console.log(`  🟡 Medium Risk: ${sybilScores.filter(s => s.risk === 'MEDIUM').length}`);
    console.log(`  🟢 Low Risk: ${sybilScores.filter(s => s.risk === 'LOW').length}`);
    console.log(`\n✅ Results saved to data/sybil-scores.json`);
    console.log(`⚠️  Flagged addresses saved to data/flagged-addresses.json`);
    
    return sybilScores;
}

// Run if called directly
if (require.main === module) {
    analyzeSybilPatterns()
        .then(() => process.exit(0))
        .catch(error => {
            console.error(error);
            process.exit(1);
        });
}

module.exports = { analyzeSybilPatterns };
