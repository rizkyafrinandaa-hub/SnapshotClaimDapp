const { ethers } = require("hardhat");
const fs = require('fs');
const csv = require('csv-writer').createObjectCsvWriter;

async function takeSnapshot() {
    console.log("📸 Taking snapshot of token holders...\n");
    
    const snapshotTokenAddress = process.env.SNAPSHOT_TOKEN_ADDRESS;
    const snapshotBlock = await ethers.provider.getBlockNumber();
    
    console.log(`Snapshot Block: ${snapshotBlock}`);
    console.log(`Token Address: ${snapshotTokenAddress}\n`);
    
    // Get token contract
    const token = await ethers.getContractAt("IERC20", snapshotTokenAddress);
    
    // Get Transfer events to find all holders
    const transferFilter = token.filters.Transfer();
    const events = await token.queryFilter(
        transferFilter,
        0,
        snapshotBlock
    );
    
    const holders = new Map();
    const addressMetrics = new Map();
    
    console.log(`Processing ${events.length} transfer events...`);
    
    for (const event of events) {
        const { from, to, value } = event.args;
        const blockNumber = event.blockNumber;
        const block = await ethers.provider.getBlock(blockNumber);
        
        // Track balances
        if (from !== ethers.ZeroAddress) {
            const currentBalance = holders.get(from) || 0n;
            holders.set(from, currentBalance - value);
        }
        
        if (to !== ethers.ZeroAddress) {
            const currentBalance = holders.get(to) || 0n;
            holders.set(to, currentBalance + value);
            
            // Track metrics for sybil detection
            if (!addressMetrics.has(to)) {
                addressMetrics.set(to, {
                    address: to,
                    firstTxTimestamp: block.timestamp,
                    txCount: 0,
                    uniqueInteractions: new Set(),
                    totalVolume: 0n
                });
            }
            
            const metrics = addressMetrics.get(to);
            metrics.txCount++;
            metrics.uniqueInteractions.add(from);
            metrics.totalVolume += value;
        }
    }
    
    // Filter holders with balance > 0
    const snapshotData = [];
    for (const [address, balance] of holders.entries()) {
        if (balance > 0n) {
            const metrics = addressMetrics.get(address);
            snapshotData.push({
                address,
                balance: ethers.formatEther(balance),
                txCount: metrics ? metrics.txCount : 0,
                firstTxTimestamp: metrics ? metrics.firstTxTimestamp : 0,
                uniqueInteractions: metrics ? metrics.uniqueInteractions.size : 0
            });
        }
    }
    
    console.log(`\n✅ Found ${snapshotData.length} holders with balance > 0`);
    
    // Save to CSV
    const csvWriter = csv({
        path: 'data/snapshot-data.csv',
        header: [
            { id: 'address', title: 'Address' },
            { id: 'balance', title: 'Balance' },
            { id: 'txCount', title: 'TxCount' },
            { id: 'firstTxTimestamp', title: 'FirstTxTimestamp' },
            { id: 'uniqueInteractions', title: 'UniqueInteractions' }
        ]
    });
    
    await csvWriter.writeRecords(snapshotData);
    
    // Save metadata
    const metadata = {
        snapshotBlock,
        snapshotTimestamp: (await ethers.provider.getBlock(snapshotBlock)).timestamp,
        tokenAddress: snapshotTokenAddress,
        totalHolders: snapshotData.length,
        totalSupply: snapshotData.reduce((sum, h) => sum + parseFloat(h.balance), 0)
    };
    
    fs.writeFileSync(
        'data/snapshot-metadata.json',
        JSON.stringify(metadata, null, 2)
    );
    
    console.log('\n📊 Snapshot saved to data/snapshot-data.csv');
    console.log('📋 Metadata saved to data/snapshot-metadata.json');
    
    return { snapshotData, metadata };
}

// Run if called directly
if (require.main === module) {
    takeSnapshot()
        .then(() => process.exit(0))
        .catch(error => {
            console.error(error);
            process.exit(1);
        });
}

module.exports = { takeSnapshot };
