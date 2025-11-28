const { MerkleTree } = require('merkletreejs');
const keccak256 = require('keccak256');
const { ethers } = require('hardhat');
const fs = require('fs');
const csv = require('csv-parser');

async function generateMerkleTree() {
    console.log("🌳 Generating Merkle tree...\n");
    
    const claims = [];
    
    // Read snapshot data
    await new Promise((resolve, reject) => {
        fs.createReadStream('data/snapshot-data.csv')
            .pipe(csv())
            .on('data', (row) => {
                // Calculate claim amount (1:1 ratio for example)
                const claimAmount = ethers.parseEther(row.Balance);
                
                claims.push({
                    address: row.Address,
                    amount: claimAmount.toString(),
                    txCount: parseInt(row.TxCount),
                    firstTxTimestamp: parseInt(row.FirstTxTimestamp)
                });
            })
            .on('end', resolve)
            .on('error', reject);
    });
    
    console.log(`Processing ${claims.length} claims...\n`);
    
    // Generate leaf nodes
    const leafNodes = claims.map(claim => {
        return keccak256(
            Buffer.concat([
                Buffer.from(
                    ethers.solidityPackedKeccak256(
                        ['address', 'uint256', 'uint256', 'uint256'],
                        [
                            claim.address,
                            claim.amount,
                            claim.txCount,
                            claim.firstTxTimestamp
                        ]
                    ).slice(2),
                    'hex'
                )
            ])
        );
    });
    
    // Create Merkle Tree
    const merkleTree = new MerkleTree(leafNodes, keccak256, { sortPairs: true });
    const merkleRoot = '0x' + merkleTree.getRoot().toString('hex');
    
    console.log('✅ Merkle Root:', merkleRoot);
    console.log('🌳 Tree Height:', merkleTree.getDepth());
    console.log(`📄 Total Leaves: ${leafNodes.length}\n`);
    
    // Generate proofs for each claim
    const claimsWithProofs = claims.map((claim, index) => {
        const proof = merkleTree.getHexProof(leafNodes[index]);
        return {
            ...claim,
            proof: proof,
            leafIndex: index
        };
    });
    
    // Save to JSON
    const merkleData = {
        merkleRoot: merkleRoot,
        totalClaims: claims.length,
        treeDepth: merkleTree.getDepth(),
        timestamp: new Date().toISOString(),
        claims: claimsWithProofs
    };
    
    fs.writeFileSync(
        'data/merkle-tree.json',
        JSON.stringify(merkleData, null, 2)
    );
    
    // Create summary for frontend (lighter file)
    const summaryData = {
        merkleRoot: merkleRoot,
        totalClaims: claims.length,
        timestamp: new Date().toISOString(),
        // Only include claim info without full proofs for overview
        totalAmount: claims.reduce(
            (sum, claim) => sum + BigInt(claim.amount),
            0n
        ).toString()
    };
    
    fs.writeFileSync(
        'frontend/merkle-summary.json',
        JSON.stringify(summaryData, null, 2)
    );
    
    console.log('✅ Merkle tree data saved to data/merkle-tree.json');
    console.log('✅ Summary saved to frontend/merkle-summary.json');
    
    return merkleData;
}

// Run if called directly
if (require.main === module) {
    generateMerkleTree()
        .then(() => process.exit(0))
        .catch(error => {
            console.error(error);
            process.exit(1);
        });
}

module.exports = { generateMerkleTree };
