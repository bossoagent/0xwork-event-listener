/**
 * 0xWork Event Listener + Dashboard Server
 * Serves API + Beautiful Dashboard
 */

const { ethers } = require('ethers');
const axios = require('axios');
const express = require('express');
const cors = require('cors');
const config = require('./config');

const app = express();
const PORT = process.env.PORT || 3000;

// Multiple RPC endpoints for fallback
const RPC_URLS = [
  'https://1rpc.io/base',
  'https://base-mainnet.public.blastapi.io',
  'https://base.llamarpc.com',
  'https://mainnet.base.org'
];

// In-memory event storage
let events = [];
let lastBlock = 0;
let currentRpcIndex = 0;

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

let provider;
let contract;

// Try to connect with fallback
async function connectWithFallback() {
  let lastError = null;
  
  for (let i = 0; i < RPC_URLS.length; i++) {
    const url = RPC_URLS[currentRpcIndex];
    console.log(`📡 Trying RPC: ${url}`);
    
    try {
      const testProvider = new ethers.JsonRpcProvider(url);
      const network = await testProvider.getNetwork();
      console.log(`✅ Connected to Base (Chain ID: ${network.chainId})`);
      return testProvider;
    } catch (error) {
      console.log(`❌ Failed: ${error.message.slice(0, 50)}`);
      lastError = error;
      currentRpcIndex = (currentRpcIndex + 1) % RPC_URLS.length;
    }
  }
  
  throw new Error(`All ${RPC_URLS.length} RPCs failed. Last error: ${lastError?.message}`);
}

// Initialize
async function init() {
  console.log('🚀 0xWork Event Listener Starting...');
  console.log(`📄 Contract: ${config.CONTRACT_ADDRESS}`);
  console.log(`🌐 Dashboard: http://localhost:${PORT}\n`);
  
  provider = await connectWithFallback();
  
  contract = new ethers.Contract(config.CONTRACT_ADDRESS, config.ABI, provider);
  
  // Get current block
  lastBlock = await provider.getBlockNumber();
  console.log(`📍 Current block: ${lastBlock}\n`);
  
  // Fetch initial events
  await fetchLastEvents(50);
  
  // Start polling
  setInterval(pollForEvents, 15000);
  
  console.log('✅ Listening for new events...\n');
}

async function fetchLastEvents(count) {
  const allLogs = [];
  const fromBlock = Math.max(0, lastBlock - 2000);
  console.log(`📜 Fetching blocks ${fromBlock} to ${lastBlock}...`);
  
  for (const eventName of ALL_EVENTS) {
    try {
      const logs = await contract.queryFilter(eventName, fromBlock, lastBlock);
      for (const log of logs) {
        allLogs.push({ event: eventName, ...log });
      }
      if (logs.length > 0) {
        console.log(`  ✅ ${eventName}: ${logs.length} events`);
      }
    } catch (e) {
      console.log(`  ⚠️ ${eventName}: ${e.message.slice(0,30)}`);
    }
  }
  
  // Sort by block number (newest first)
  allLogs.sort((a, b) => b.blockNumber - a.blockNumber);
  
  // Fetch block timestamps for accurate event times
  const blockTimestamps = await fetchBlockTimestamps(allLogs);
  
  // Store formatted events
  events = allLogs.slice(0, count).map(log => formatEvent(log, blockTimestamps));
  console.log(`📊 Total events loaded: ${events.length}\n`);
}

async function fetchBlockTimestamps(logs) {
  const timestamps = {};
  const uniqueBlocks = [...new Set(logs.map(l => l.blockNumber))].slice(0, 20);
  
  for (const blockNum of uniqueBlocks) {
    try {
      const block = await provider.getBlock(blockNum);
      timestamps[blockNum] = block.timestamp;
    } catch (e) {
      timestamps[blockNum] = Date.now() / 1000;
    }
  }
  return timestamps;
}

async function pollForEvents() {
  try {
    const currentBlock = await provider.getBlockNumber();
    
    if (currentBlock > lastBlock) {
      console.log(`🔄 Checking blocks ${lastBlock + 1} to ${currentBlock}...`);
      
      for (const eventName of ALL_EVENTS) {
        try {
          const logs = await contract.queryFilter(eventName, lastBlock + 1, currentBlock);
          
          for (const log of logs) {
            // Get block timestamp for this event
            let blockTimestamps = {};
            try {
              const block = await provider.getBlock(log.blockNumber);
              blockTimestamps[log.blockNumber] = block.timestamp;
            } catch (e) {}
            
            // Attach eventName to log for formatEvent
            const logWithEvent = { ...log, event: eventName };
            const newEvent = formatEvent(logWithEvent, blockTimestamps);
            events.unshift(newEvent);
            console.log(`📥 ${eventName}: Task #${newEvent.data.taskId || 'N/A'}`);
          }
        } catch (e) {
          // Skip
        }
      }
      
      // Keep only last 100 events
      events = events.slice(0, 100);
      lastBlock = currentBlock;
    }
  } catch (error) {
    console.log(`⚠️ Poll error: ${error.message.slice(0, 50)}`);
    // Try reconnecting
    try {
      provider = await connectWithFallback();
      contract = new ethers.Contract(config.CONTRACT_ADDRESS, config.ABI, provider);
    } catch (e) {
      console.log(`⚠️ Reconnect failed`);
    }
  }
}

function formatEvent(log, blockTimestamps = {}) {
  const argMap = config.getArgMap(log.event);
  const args = log.args || [];
  const topics = log.topics || [];
  
  const data = {};
  const indexedParams = topics.slice(1);
  
  argMap.forEach((key, idx) => {
    let value;
    
    if (indexedParams[idx]) {
      value = indexedParams[idx];
      
      // Decode based on type
      if (key === 'taskId' || key === 'revisionCount') {
        // It's a uint256/uint8 - decode from hex
        value = parseInt(value, 16).toString();
      } else if (key.includes('Address') || key === 'worker' || key === 'poster' || 
          key === 'requestedBy' || key === 'retractedBy' || key === 'inFavorOf' ||
          key === 'bannedWorker' || key === 'token' || key === 'treasury' || 
          key === 'platinumPool' || key === 'oracle' || key === 'wallet') {
        // It's an address - decode from hex
        try {
          value = '0x' + value.slice(-40);
        } catch(e) {}
      }
    }
    else if (args[idx] !== undefined) {
      value = args[idx];
    }
    
    if (value !== undefined) {
      if (typeof value === 'bigint') {
        if (['payout', 'bountyAmount', 'amount'].includes(key)) {
          value = `$${(Number(value) / 1000000).toFixed(2)} USDC`;
        } else if (key === 'taskId') {
          value = value.toString();
        } else {
          value = value.toString();
        }
      }
      data[key] = value;
    }
  });
  
  // Get actual event time from block timestamp
  const blockTime = blockTimestamps[log.blockNumber] || (Date.now() / 1000);
  const eventTime = new Date(blockTime * 1000).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
  
  return {
    id: `${log.blockNumber}-${log.transactionHash.slice(0, 10)}`,
    event: log.event,
    emoji: config.getEmoji(log.event),
    timestamp: eventTime,
    blockNumber: log.blockNumber,
    transactionHash: log.transactionHash,
    data
  };
}

// API Routes
app.get('/api/events', (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  res.json(events.slice(0, limit));
});

app.get('/api/stats', (req, res) => {
  const stats = {
    totalEvents: events.length,
    lastBlock,
    eventTypes: {},
    recentTasks: []
  };
  
  events.forEach(e => {
    stats.eventTypes[e.event] = (stats.eventTypes[e.event] || 0) + 1;
    if (e.data.taskId && !stats.recentTasks.includes(e.data.taskId)) {
      stats.recentTasks.push(e.data.taskId);
    }
  });
  
  res.json(stats);
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', block: lastBlock, events: events.length });
});

// Dashboard HTML (same as before)
app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>0xWork Event Monitor | Base</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&family=Outfit:wght@300;400;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --base-blue: #0052FF;
      --base-dark: #0A0A0F;
      --base-card: #121218;
      --base-border: #1E1E2E;
      --0xwork-purple: #9333EA;
      --0xwork-pink: #EC4899;
      --success: #10B981;
      --warning: #F59E0B;
      --error: #EF4444;
    }
    
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      font-family: 'Outfit', sans-serif;
      background: var(--base-dark);
      color: #fff;
      min-height: 100vh;
      background-image: 
        radial-gradient(ellipse at 20% 0%, rgba(147, 51, 234, 0.15) 0%, transparent 50%),
        radial-gradient(ellipse at 80% 100%, rgba(0, 82, 255, 0.15) 0%, transparent 50%);
    }
    
    .container { max-width: 1400px; margin: 0 auto; padding: 24px; }
    
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 32px;
      padding-bottom: 24px;
      border-bottom: 1px solid var(--base-border);
    }
    
    .logo {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    
    .logo-icon {
      width: 48px;
      height: 48px;
      background: linear-gradient(135deg, var(--base-blue), var(--0xwork-purple));
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
    }
    
    .logo h1 {
      font-size: 24px;
      font-weight: 700;
      background: linear-gradient(135deg, #fff, #94A3B8);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    
    .logo span {
      font-size: 12px;
      color: var(--base-blue);
      font-weight: 600;
      letter-spacing: 1px;
    }
    
    .stats-row {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin-bottom: 32px;
    }
    
    .stat-card {
      background: var(--base-card);
      border: 1px solid var(--base-border);
      border-radius: 16px;
      padding: 20px;
      transition: transform 0.2s, border-color 0.2s;
    }
    
    .stat-card:hover {
      transform: translateY(-2px);
      border-color: var(--base-blue);
    }
    
    .stat-label {
      font-size: 12px;
      color: #64748B;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 8px;
    }
    
    .stat-value {
      font-size: 32px;
      font-weight: 700;
      font-family: 'JetBrains Mono', monospace;
    }
    
    .stat-value.blue { color: var(--base-blue); }
    .stat-value.purple { color: var(--0xwork-purple); }
    .stat-value.green { color: var(--success); }
    .stat-value.pink { color: var(--0xwork-pink); }
    
    .section-title {
      font-size: 14px;
      color: #64748B;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 16px;
    }
    
    .events-grid {
      display: grid;
      gap: 12px;
    }
    
    .event-card {
      background: var(--base-card);
      border: 1px solid var(--base-border);
      border-radius: 12px;
      padding: 16px 20px;
      display: flex;
      align-items: center;
      gap: 16px;
      transition: all 0.2s;
      animation: slideIn 0.3s ease-out;
    }
    
    @keyframes slideIn {
      from { opacity: 0; transform: translateY(-10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    
    .event-card:hover {
      border-color: var(--base-blue);
      background: #181820;
    }
    
    .event-emoji {
      width: 44px;
      height: 44px;
      background: var(--base-border);
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      flex-shrink: 0;
    }
    
    .event-info { flex: 1; min-width: 0; }
    
    .event-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 6px;
    }
    
    .event-type {
      font-weight: 600;
      font-size: 15px;
    }
    
    .event-task {
      font-family: 'JetBrains Mono', monospace;
      font-size: 13px;
      color: var(--base-blue);
      background: rgba(0, 82, 255, 0.1);
      padding: 2px 8px;
      border-radius: 4px;
    }
    
    .event-details {
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
    }
    
    .event-detail {
      font-size: 13px;
      color: #94A3B8;
    }
    
    .event-detail strong {
      color: #CBD5E1;
    }
    
    .event-meta {
      text-align: right;
      flex-shrink: 0;
    }
    
    .event-time {
      font-size: 12px;
      color: #64748B;
      font-family: 'JetBrains Mono', monospace;
    }
    
    .event-block {
      font-size: 11px;
      color: #475569;
      font-family: 'JetBrains Mono', monospace;
    }
    
    .live-indicator {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      color: var(--success);
    }
    
    .live-dot {
      width: 8px;
      height: 8px;
      background: var(--success);
      border-radius: 50%;
      animation: pulse 2s infinite;
    }
    
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    
    .refresh-btn {
      background: var(--base-card);
      border: 1px solid var(--base-border);
      color: #fff;
      padding: 8px 16px;
      border-radius: 8px;
      cursor: pointer;
      font-family: 'Outfit', sans-serif;
      font-size: 13px;
      transition: all 0.2s;
    }
    
    .refresh-btn:hover {
      background: var(--base-border);
      border-color: var(--base-blue);
    }
    
    .empty-state {
      text-align: center;
      padding: 60px 20px;
      color: #64748B;
    }
    
    .empty-state-icon { font-size: 48px; margin-bottom: 16px; }
    
    @media (max-width: 768px) {
      .stats-row { grid-template-columns: repeat(2, 1fr); }
      .event-details { display: none; }
      .event-meta { display: none; }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="logo">
        <div class="logo-icon">📡</div>
        <div>
          <h1>0xWork Event Monitor</h1>
          <span>BASE MAINNET</span>
        </div>
      </div>
      <div class="live-indicator">
        <div class="live-dot"></div>
        <span>Live</span>
        <button class="refresh-btn" onclick="loadEvents()">↻ Refresh</button>
      </div>
    </header>
    
    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-label">Total Events</div>
        <div class="stat-value blue" id="totalEvents">-</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Current Block</div>
        <div class="stat-value purple" id="currentBlock">-</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Tasks Active</div>
        <div class="stat-value green" id="tasksCount">-</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Event Types</div>
        <div class="stat-value pink" id="eventTypes">-</div>
      </div>
    </div>
    
    <div class="section-title">Recent Events</div>
    <div class="events-grid" id="eventsGrid">
      <div class="empty-state">
        <div class="empty-state-icon">📭</div>
        <div>Loading events...</div>
      </div>
    </div>
  </div>
  
  <script>
    async function loadStats() {
      try {
        const res = await fetch('/api/stats');
        const stats = await res.json();
        
        document.getElementById('totalEvents').textContent = stats.totalEvents;
        document.getElementById('currentBlock').textContent = '#' + stats.lastBlock.toLocaleString();
        document.getElementById('tasksCount').textContent = stats.recentTasks.length;
        document.getElementById('eventTypes').textContent = Object.keys(stats.eventTypes).length;
      } catch (e) {
        console.error('Stats error:', e);
      }
    }
    
    async function loadEvents() {
      try {
        const res = await fetch('/api/events?limit=20');
        const events = await res.json();
        
        const grid = document.getElementById('eventsGrid');
        
        if (events.length === 0) {
          grid.innerHTML = \`
            <div class="empty-state">
              <div class="empty-state-icon">📭</div>
              <div>No events yet</div>
            </div>
          \`;
          return;
        }
        
        grid.innerHTML = events.map(ev => {
          const taskId = ev.data.taskId ? \`#\${ev.data.taskId}\` : '';
          const details = Object.entries(ev.data)
            .filter(([k]) => k !== 'taskId')
            .map(([k,v]) => \`<span class="event-detail"><strong>\${k}:</strong> \${v}</span>\`)
            .join('');
          
          return \`
          <div class="event-card">
            <div class="event-emoji">\${ev.emoji}</div>
            <div class="event-info">
              <div class="event-header">
                <span class="event-type">\${ev.event}</span>
                \${taskId ? \`<span class="event-task">Task \${taskId}</span>\` : ''}
              </div>
              <div class="event-details">\${details}</div>
            </div>
            <div class="event-meta">
              <div class="event-time">\${ev.timestamp}</div>
              <div class="event-block">Block \${ev.blockNumber.toLocaleString()}</div>
            </div>
          </div>
        \`;
        }).join('');
      } catch (e) {
        console.error('Events error:', e);
      }
    }
    
    function formatTime(ts) {
      const d = new Date(ts);
      const now = new Date();
      const diff = (now - d) / 1000;
      
      if (diff < 60) return 'Just now';
      if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
      if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
      return d.toLocaleDateString();
    }
    
    loadStats();
    loadEvents();
    
    setInterval(() => {
      loadStats();
      loadEvents();
    }, 15000);
  </script>
</body>
</html>`);
});

async function main() {
  await init();
  app.listen(PORT, () => {
    console.log(`\n🌐 Dashboard running at: http://localhost:${PORT}\n`);
  });
}

process.on('SIGINT', () => {
  console.log('\n👋 Shutting down...');
  process.exit(0);
});

main().catch(console.error);
