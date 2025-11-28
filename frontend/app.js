let provider, signer, contract, userAddress;
let merkleData, sybilData;

// Initialize
window.addEventListener('load', async () => {
    document.getElementById('connectBtn').addEventListener('click', connectWallet);
    await loadData();
});

async function loadData() {
    try {
        // Load merkle data
        const merkleResponse = await fetch('../data/merkle-tree.json');
        merkleData = await merkleResponse.json();
        
        // Load sybil scores
        const sybilResponse = await fetch('../data/sybil-scores.json');
        sybilData = await sybilResponse.json();
        
        console.log('Data loaded successfully');
    } catch (error) {
        console.error('Error loading data:', error);
    }
}

async function connectWallet() {
    if (typeof window.ethereum === 'undefined') {
        alert('Please install MetaMask!');
        return;
    }

    try {
        provider = new ethers.providers.Web3Provider(window.ethereum);
        await provider.send("eth_requestAccounts", []);
        signer = provider.getSigner();
        userAddress = await signer.getAddress();

        // Get network
        const network = await provider.getNetwork();
        
        document.getElementById('userAddress').textContent = 
            userAddress.slice(0, 6) + '...' + userAddress.slice(-4);
        document.getElementById('networkName').textContent = network.name;
        
        document.getElementById('connectBtn').style.display = 'none';
        document.getElementById('walletInfo').style.display = 'block';
        document.getElementById('claimSection').style.display = 'block';

        // Initialize contract
        contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
        
        await loadClaimInfo();
        await checkEligibility();
    } catch (error) {
        console.error('Error connecting wallet:', error);
        alert('Failed to connect wallet');
    }
}

async function loadClaimInfo() {
    try {
        const snapshotBlock = await contract.snapshotBlock();
        const claimEndTime = await contract.claimEndTime();
        const totalClaimed = await contract.totalClaimed();
        
        document.getElementById('snapshotBlock').textContent = snapshotBlock.toString();
        document.getElementById('claimEndTime').textContent = 
            new Date(claimEndTime.toNumber() * 1000).toLocaleString();
        document.getElementById('totalClaimed').textContent = 
            ethers.utils.formatEther(totalClaimed) + ' tokens';
    } catch (error) {
        console.error('Error loading claim info:', error);
    }
}

async function checkEligibility() {
    try {
        // Find user's claim data
        const userClaim = merkleData.claims.find(
            c => c.address.toLowerCase() === userAddress.toLowerCase()
        );

        if (!userClaim) {
            document.getElementById('eligibilityStatus').innerHTML = 
                '<div class="error">❌ You are not eligible for this airdrop</div>';
            document.getElementById('claimStatus').textContent = 'Not Eligible';
            return;
        }

        // Check if already claimed
        const hasClaimed = await contract.hasClaimed(userAddress);
        if (hasClaimed) {
            document.getElementById('eligibilityStatus').innerHTML = 
                '<div class="success">✅ You have already claimed your tokens</div>';
            document.getElementById('claimStatus').textContent = 'Already Claimed';
            return;
        }

        // Find sybil score
        const sybilInfo = sybilData.scores.find(
            s => s.address.toLowerCase() === userAddress.toLowerCase()
        );

        // Display claim info
        document.getElementById('snapshotBalance').textContent = 
            ethers.utils.formatEther(userClaim.amount) + ' tokens';

        // Get estimated claim amount
        const estimated = await contract.getEstimatedClaim(
            userAddress,
            userClaim.amount,
            userClaim.txCount,
            userClaim.firstTxTimestamp
        );

        const estimatedAmount = ethers.utils.formatEther(estimated.estimatedAmount);
        const penaltyPercent = estimated.penaltyPercent.toNumber();

        document.getElementById('claimAmount').textContent = estimatedAmount + ' tokens';
        document.getElementById('penaltyAmount').textContent = penaltyPercent + '%';

        // Display sybil score
        if (sybilInfo) {
            const scoreElement = document.getElementById('sybilScore');
            scoreElement.textContent = sybilInfo.sybilScore + ' / 100';
            scoreElement.className = 'value score ' + sybilInfo.risk.toLowerCase();

            if (sybilInfo.risk === 'HIGH' || sybilInfo.risk === 'MEDIUM') {
                document.getElementById('riskWarning').style.display = 'block';
                document.getElementById('riskFlags').innerHTML = 
                    '<small>Flags: ' + sybilInfo.flags + '</small>';
            }
        }

        // Enable claim button
        document.getElementById('claimBtn').disabled = false;
        document.getElementById('claimBtnText').textContent = 'Claim Tokens';
        document.getElementById('claimBtn').onclick = claimTokens;
        document.getElementById('claimStatus').textContent = 'Eligible';
        document.getElementById('eligibilityStatus').innerHTML = 
            '<div class="success">✅ You are eligible to claim!</div>';

    } catch (error) {
        console.error('Error checking eligibility:', error);
        document.getElementById('eligibilityStatus').innerHTML = 
            '<div class="error">❌ Error checking eligibility</div>';
    }
}

async function claimTokens() {
    try {
        // Get user's claim data
        const userClaim = merkleData.claims.find(
            c => c.address.toLowerCase() === userAddress.toLowerCase()
        );

        if (!userClaim) {
            alert('You are not eligible for this airdrop');
            return;
        }

        // Show processing status
        document.getElementById('txStatus').style.display = 'block';
        document.getElementById('txStatus').innerHTML = 
            '<div class="info">⏳ Preparing transaction...</div>';
        document.getElementById('claimBtn').disabled = true;

        // Call claim function
        const tx = await contract.claim(
            userClaim.amount,
            userClaim.txCount,
            userClaim.firstTxTimestamp,
            userClaim.proof
        );

        document.getElementById('txStatus').innerHTML = 
            '<div class="info">⏳ Transaction submitted. Waiting for confirmation...<br>' +
            '<a href="https://etherscan.io/tx/' + tx.hash + '" target="_blank">View on Etherscan</a></div>';

        await tx.wait();

        document.getElementById('txStatus').innerHTML = 
            '<div class="success">✅ Tokens claimed successfully!<br>' +
            '<a href="https://etherscan.io/tx/' + tx.hash + '" target="_blank">View on Etherscan</a></div>';
        
        document.getElementById('claimStatus').textContent = 'Claimed';
        document.getElementById('claimBtn').style.display = 'none';

    } catch (error) {
        console.error('Error claiming tokens:', error);
        document.getElementById('txStatus').innerHTML = 
            '<div class="error">❌ Error: ' + (error.reason || error.message) + '</div>';
        document.getElementById('claimBtn').disabled = false;
    }
}
