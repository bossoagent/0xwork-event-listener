/**
 * 0xWork Event Listener
 * Polls Base network for 0xWork contract events
 */

const { ethers } = require('ethers');
const axios = require('axios');
const config = require('./config');

let provider;
let contract;
let lastBlock = 0;

// List of all events to listen
const ALL_EVENTS = [
  'TaskPosted', 'TaskClaimed', 'WorkSubmitted', 'WorkApproved', 'WorkRejected',
  'TaskCancelled', 'TaskReclaimed', 'TaskAbandoned', 'DisputeResolved',
  'RevisionRequested', 'ApprovalClaimed', 'MutualCancelRequested', 'MutualCancelCompleted',
  'MutualCancelRetracted', 'DeadlineExtended', 'AdminCancelEvent', 'AdminDisputeResolved',
  'AdminRevertedTask', 'TaskPaused', 'TaskUnpaused', 'EmergencyWithdrawEvent',
  'FeeDiscountUpdated', 'RevenueShared', 'FeesUpdated', 'TreasuryUpdated',
  'PlatinumPoolUpdated', 'PricingModeUpdated', 'AxobotlPerUsdcUpdated',
  'StakeBoundsUpdated', 'OracleUpdated', 'StakeRateUpdated', 'PosterStakeRateUpdated',
  'TimersUpdated', 'ClaimLimitsUpdated', 'RevenueShareUpdated', 'PriorityWindowUpdated'
];

async function init() {
  console.log('🚀 0xWork Event Listener Starting...');
  console.log(`📡 Connecting to: ${config.BASE_RPC_URL}`);
  console.log(`📄 Contract: ${config.CONTRACT_ADDRESS}`);
  
  provider = new ethers.JsonRpcProvider(config.BASE_RPC_URL);
  
  try {
    const network = await provider.getNetwork();
    console.log(`✅ Connected to Base (Chain ID: ${network.chainId})`);
  } catch (error) {
    console.error('❌ Failed to connect:', error.message);
    process.exit(1);
  }
  
  contract = new ethers.Contract(config.CONTRACT_ADDRESS, config.ABI, provider);
  
  // Get current block
  lastBlock = await provider.getBlockNumber();
  console.log(`📍 Current block: ${lastBlock}\n`);
}

async function fetchLastEvents(count) {
  const allLogs = [];
  
  // Get last ~2000 blocks (about 6 hours on Base)
  const fromBlock = Math.max(0, lastBlock - 2000);
  console.log(`📜 Fetching blocks ${fromBlock} to ${lastBlock}...\n`);
  
  for (const eventName of ALL_EVENTS) {
    try {
      const logs = await contract.queryFilter(eventName, fromBlock, lastBlock);
      for (const log of logs) {
        allLogs.push({ event: eventName, ...log });
      }
    } catch (e) {
      console.log(`⚠️ ${eventName}: ${e.message.slice(0,30)}`);
    }
  }
  
  console.log(`\n📊 Total events found: ${allLogs.length}\n`);
  
  // Sort by block number (newest first)
  allLogs.sort((a, b) => b.blockNumber - a.blockNumber);
  
  // Show last N events
  const lastN = allLogs.slice(0, count);
  
  console.log(`📋 Last ${lastN.length} events:\n`);
  for (const log of lastN) {
    // Extract args - ethers v6 stores them in different ways
    const eventArgs = log.args || log;
    const message = config.formatEventLog(log.event, eventArgs);
    console.log(message);
    console.log('');
  }
}

async function pollForEvents() {
  try {
    const currentBlock = await provider.getBlockNumber();
    
    if (currentBlock > lastBlock) {
      console.log(`\n🔄 Checking blocks ${lastBlock + 1} to ${currentBlock}...`);
      
      for (const eventName of ALL_EVENTS) {
        try {
          const logs = await contract.queryFilter(eventName, lastBlock + 1, currentBlock);
          
          for (const log of logs) {
            const eventArgs = log.args || log;
            const message = config.formatEventLog(eventName, eventArgs);
            console.log(message);
            await sendWebhook(eventName, eventArgs);
            console.log('');
          }
        } catch (e) {
          // Skip failed events
        }
      }
      
      lastBlock = currentBlock;
    }
  } catch (error) {
    console.log(`⚠️ Poll error: ${error.message.slice(0, 50)}`);
  }
}

async function sendWebhook(eventName, data) {
  if (!config.WEBHOOK_URL) return;
  
  try {
    const payload = {
      event: eventName,
      timestamp: new Date().toISOString(),
      chainId: 8453,
      contract: config.CONTRACT_ADDRESS,
      data: {}
    };
    
    for (const [key, value] of Object.entries(data)) {
      payload.data[key] = typeof value === 'bigint' ? value.toString() : value;
    }
    
    await axios.post(config.WEBHOOK_URL, payload);
  } catch (e) {
    console.log(`   ❌ Webhook failed`);
  }
}

async function main() {
  await init();
  
  // Fetch last 20 events on startup
  console.log('\n📜 Fetching last 20 events...\n');
  await fetchLastEvents(20);
  
  console.log('\n👂 Starting event polling (every 15 seconds)...\n');
  
  // Poll every 15 seconds
  setInterval(pollForEvents, 15000);
  
  console.log('✅ Listening for new events... (Press Ctrl+C to stop)');
}

process.on('SIGINT', () => {
  console.log('\n👋 Shutting down...');
  process.exit(0);
});

main().catch(console.error);
