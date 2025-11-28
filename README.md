# 🎁 Snapshot Claim DApp with Sybil-Resistance

Gas-efficient token claim system based on snapshot balance with advanced sybil-resistance mechanisms.

## Features

✅ Snapshot-based eligibility at specific block  
✅ Merkle tree verification (gas-efficient)  
✅ Sybil-resistance scoring system  
✅ Automated penalty calculation  
✅ Blacklist mechanism  
✅ User-friendly frontend  

## Installation
npm install

Setup
Copy .env.example to .env and fill in your values.
Deploy mock tokens (if needed) or use an existing token address.
Run the complete setup process.

npm run snapshot
npm run sybil
npm run merkle
npm run deploy
npm run full-setup

Sybil-Resistance Criteria
The system evaluates addresses based on several factors:
Holding Duration: Less than 7 days = 20% penalty
Transaction Count: Fewer than 5 transactions = 15% penalty
Sybil Score: High risk (>70) = 50% penalty
Unique Interactions: Low interaction count = 10–20% penalty
Automated Patterns: High transaction count but low interaction diversity = penalty applied

npm test
git init
git add .
git commit -m "Initial commit: Snapshot Claim DApp"
git branch -M main
git remote add origin https://github.com/yourusername/snapshot-claim-dapp.git
git push -u origin main

Security

Uses audited OpenZeppelin contracts
ReentrancyGuard protection
Merkle proof verification
Multi-factor sybil detection
License
MIT

node_modules/
.env
cache/
artifacts/
coverage/
typechain-types/
data/*.csv
data/*.json
!data/.gitkeep
frontend/merkle-summary.json


Step 1: Setup Local Project
mkdir snapshot-claim-dapp
cd snapshot-claim-dapp
npm init -y
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox
npm install @openzeppelin/contracts ethers merkletreejs keccak256 csv-parser csv-writer dotenv


Step 2: Create Directory Structure
mkdir contracts scripts frontend test data
touch contracts/SnapshotClaim.sol contracts/SybilResistance.sol
touch scripts/{1-deploy.js,2-takeSnapshot.js,3-generateMerkleTree.js,4-checkSybil.js}
touch frontend/{index.html,app.js,styles.css,config.js}
touch .env.example .gitignore README.md hardhat.config.js

Step 3: Copy All Files
Copy all provided code into the corresponding files.

Step 4: Initialize Git & Push to GitHub
git init
git add .
git commit -m "feat: Initial commit - Snapshot Claim DApp with Sybil-Resistance"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/snapshot-claim-dapp.git
git push -u origin main

Step 5: Testing & Deployment
# 1. Setup environment
cp .env.example .env   # then edit .env
# 2. Compile contracts
npx hardhat compile
# 3. Run full setup
npm run full-setup
# 4. Deploy contract
npm run deploy


📊 Explanation of the Sybil-Resistance Mechanism

This application uses multiple layers of analysis to detect sybil attacks:
Temporal Analysis: Detects newly created wallets around the snapshot time.
Transaction Patterns: Analyzes transaction frequency and count.
Network Topology: Detects star-shaped patterns where one wallet controls many.
Volume Analysis: Checks historical transaction volume.
Interaction Diversity: Measures how many unique addresses a wallet interacts with.
A 0–100 risk score is generated, and penalties are automatically applied on-chain during the claim process.

