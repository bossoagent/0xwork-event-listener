// Configuration
require('dotenv').config();
const { ethers } = require('ethers');

module.exports = {
  // 0xWork TaskPool Contract on Base (verified checksum)
  CONTRACT_ADDRESS: '0xf404afdba46e05af7b395fb45c43e66db549c6d2',
  
  // Base Network
  BASE_RPC_URL: process.env.BASE_RPC_URL || 'https://base-mainnet.public.blastapi.io',
  
  // Webhook (optional)
  WEBHOOK_URL: process.env.WEBHOOK_URL || null,
  
  // Full ABI - All events
  ABI: [
    "event TaskPosted(uint256 indexed taskId, address indexed poster, uint256 bountyAmount, uint256 deadline)",
    "event TaskClaimed(uint256 indexed taskId, address indexed worker, uint256 stakeAmount)",
    "event WorkSubmitted(uint256 indexed taskId, string proofHash)",
    "event WorkApproved(uint256 indexed taskId, address indexed worker, uint256 payout)",
    "event WorkRejected(uint256 indexed taskId, uint256 disputeDeadline)",
    "event TaskCancelled(uint256 indexed taskId)",
    "event TaskReclaimed(uint256 indexed taskId, address indexed poster)",
    "event TaskAbandoned(uint256 indexed taskId, address indexed worker)",
    "event DisputeResolved(uint256 indexed taskId, bool workerWins)",
    "event RevisionRequested(uint256 indexed taskId, uint8 revisionCount, uint256 newDeadline)",
    "event ApprovalClaimed(uint256 indexed taskId, address indexed worker)",
    "event MutualCancelRequested(uint256 indexed taskId, address indexed requestedBy)",
    "event MutualCancelCompleted(uint256 indexed taskId)",
    "event MutualCancelRetracted(uint256 indexed taskId, address indexed retractedBy)",
    "event DeadlineExtended(uint256 indexed taskId, uint256 newDeadline)",
    "event AdminCancelEvent(uint256 indexed taskId, string reason)",
    "event AdminDisputeResolved(uint256 indexed taskId, address indexed inFavorOf)",
    "event AdminRevertedTask(uint256 indexed taskId, address indexed bannedWorker, string reason)",
    "event TaskPaused(uint256 indexed taskId)",
    "event TaskUnpaused(uint256 indexed taskId)",
    "event EmergencyWithdrawEvent(address indexed token, uint256 amount)",
    "event FeeDiscountUpdated(address indexed wallet, bool eligible)",
    "event RevenueShared(uint256 indexed taskId, uint256 amount)",
    "event FeesUpdated(uint256 usdcFeeBps, uint256 discountFeeBps)",
    "event TreasuryUpdated(address treasury)",
    "event PlatinumPoolUpdated(address platinumPool)",
    "event PricingModeUpdated(uint8 mode)",
    "event AxobotlPerUsdcUpdated(uint256 rate)",
    "event StakeBoundsUpdated(uint256 minStake, uint256 maxStake)",
    "event OracleUpdated(address oracle)",
    "event StakeRateUpdated(uint256 stakeRateBps)",
    "event PosterStakeRateUpdated(uint256 posterStakeRateBps)",
    "event TimersUpdated(uint256 approvalWindow, uint256 disputeWindow, uint256 disputeDelay, uint256 minDeadline)",
    "event ClaimLimitsUpdated(uint256 maxActive, uint256 maxPerDay)",
    "event RevenueShareUpdated(uint256 bps)",
    "event PriorityWindowUpdated(uint256 window)"
  ],
  
  // Event emoji mapping
  getEmoji: function(eventName) {
    const emojis = {
      'TaskPosted': '🆕',
      'TaskClaimed': '✋',
      'WorkSubmitted': '📤',
      'WorkApproved': '✅',
      'WorkRejected': '❌',
      'TaskCancelled': '🚫',
      'TaskReclaimed': '🔙',
      'TaskAbandoned': '⚠️',
      'DisputeResolved': '⚖️',
      'RevisionRequested': '📝',
      'ApprovalClaimed': '🎯',
      'MutualCancelRequested': '🤝',
      'MutualCancelCompleted': '✅',
      'MutualCancelRetracted': '❎',
      'DeadlineExtended': '⏰',
      'AdminCancelEvent': '🔴',
      'AdminDisputeResolved': '👑',
      'AdminRevertedTask': '⛔',
      'TaskPaused': '⏸️',
      'TaskUnpaused': '▶️',
      'EmergencyWithdrawEvent': '💸',
      'FeeDiscountUpdated': '💳',
      'RevenueShared': '💰',
      'FeesUpdated': '📊',
      'TreasuryUpdated': '🏦',
      'PlatinumPoolUpdated': '🥇',
      'PricingModeUpdated': '💵',
      'AxobotlPerUsdcUpdated': '🤖',
      'StakeBoundsUpdated': '📏',
      'OracleUpdated': '🔮',
      'StakeRateUpdated': '📈',
      'PosterStakeRateUpdated': '📉',
      'TimersUpdated': '⏱️',
      'ClaimLimitsUpdated': '🎚️',
      'RevenueShareUpdated': '🔄',
      'PriorityWindowUpdated': '🪟'
    };
    return emojis[eventName] || '📌';
  },
  
  formatEventLog: function(eventName, args) {
    const timestamp = new Date().toISOString();
    const emoji = this.getEmoji(eventName);
    
    let message = `\n${'='.repeat(60)}\n`;
    message += `⏰ ${timestamp}\n`;
    message += `${emoji} ${eventName}\n`;
    message += `${'='.repeat(60)}\n`;
    
    // Map args based on event type
    const argMap = this.getArgMap(eventName);
    
    // Handle args - could be array or object
    if (!args) {
      message += `  (No event data available)\n`;
      return message;
    }
    
    // Convert array to object if needed
    const data = Array.isArray(args) ? args.reduce((acc, val, idx) => {
      const key = argMap[idx] || `arg${idx}`;
      acc[key] = val;
      return acc;
    }, {}) : args;
    
    // Format each argument with friendly labels
    for (const [key, value] of Object.entries(data)) {
      if (isNaN(key)) {
        let friendlyKey = this.toFriendlyName(key);
        let formattedValue = this.formatValue(key, value);
        message += `  ${friendlyKey}: ${formattedValue}\n`;
      }
    }
    
    return message;
  },
  
  getArgMap: function(eventName) {
    const maps = {
      'TaskPosted': ['taskId', 'poster', 'bountyAmount', 'deadline'],
      'TaskClaimed': ['taskId', 'worker', 'stakeAmount'],
      'WorkSubmitted': ['taskId', 'proofHash'],
      'WorkApproved': ['taskId', 'worker', 'payout'],
      'WorkRejected': ['taskId', 'disputeDeadline'],
      'TaskCancelled': ['taskId'],
      'TaskReclaimed': ['taskId', 'poster'],
      'TaskAbandoned': ['taskId', 'worker'],
      'DisputeResolved': ['taskId', 'workerWins'],
      'RevisionRequested': ['taskId', 'revisionCount', 'newDeadline'],
      'ApprovalClaimed': ['taskId', 'worker'],
      'MutualCancelRequested': ['taskId', 'requestedBy'],
      'MutualCancelCompleted': ['taskId'],
      'MutualCancelRetracted': ['taskId', 'retractedBy'],
      'DeadlineExtended': ['taskId', 'newDeadline'],
      'RevenueShared': ['taskId', 'amount'],
      'FeesUpdated': ['usdcFeeBps', 'discountFeeBps'],
      'FeeDiscountUpdated': ['wallet', 'eligible'],
      'EmergencyWithdrawEvent': ['token', 'amount'],
      'TreasuryUpdated': ['treasury'],
      'PlatinumPoolUpdated': ['platinumPool'],
      'OracleUpdated': ['oracle'],
      'StakeBoundsUpdated': ['minStake', 'maxStake'],
      'StakeRateUpdated': ['stakeRateBps'],
      'PosterStakeRateUpdated': ['posterStakeRateBps'],
      'TimersUpdated': ['approvalWindow', 'disputeWindow', 'disputeDelay', 'minDeadline'],
      'ClaimLimitsUpdated': ['maxActive', 'maxPerDay'],
      'RevenueShareUpdated': ['bps'],
      'PriorityWindowUpdated': ['window'],
      'PricingModeUpdated': ['mode'],
      'AxobotlPerUsdcUpdated': ['rate']
    };
    return maps[eventName] || [];
  },
  
  toFriendlyName: function(key) {
    const names = {
      'taskId': '🎫 Task ID',
      'poster': '👤 Poster',
      'worker': '👷 Worker',
      'bountyAmount': '💰 Bounty (USDC)',
      'deadline': '⏰ Deadline',
      'stakeAmount': '🎯 Stake Amount',
      'proofHash': '🔗 Proof Hash',
      'payout': '💵 Payout',
      'disputeDeadline': '⚖️ Dispute Deadline',
      'revisionCount': '📝 Revision #',
      'newDeadline': '📅 New Deadline',
      'requestedBy': '👤 Requested By',
      'retractedBy': '👤 Retracted By',
      'inFavorOf': '👑 Ruling In Favor Of',
      'bannedWorker': '⛔ Banned Worker',
      'reason': '📋 Reason',
      'token': '🪙 Token',
      'amount': '💸 Amount',
      'wallet': '👤 Wallet',
      'eligible': '✅ Eligible',
      'usdcFeeBps': '📊 USDC Fee (bps)',
      'discountFeeBps': '📉 Discount Fee (bps)',
      'treasury': '🏦 Treasury',
      'platinumPool': '🥇 Platinum Pool',
      'mode': '💳 Pricing Mode',
      'rate': '🤖 AXOBOTL per USDC',
      'minStake': '📏 Min Stake',
      'maxStake': '📏 Max Stake',
      'oracle': '🔮 Oracle',
      'stakeRateBps': '📈 Stake Rate (bps)',
      'posterStakeRateBps': '📉 Poster Stake Rate (bps)',
      'approvalWindow': '⏱️ Approval Window',
      'disputeWindow': '⚖️ Dispute Window',
      'disputeDelay': '⏳ Dispute Delay',
      'minDeadline': '📅 Min Deadline',
      'maxActive': '🎚️ Max Active',
      'maxPerDay': '📊 Max Per Day',
      'bps': '💰 Basis Points',
      'window': '🪟 Priority Window',
      'workerWins': '⚖️ Worker Wins'
    };
    return names[key] || key;
  },
  
  formatValue: function(key, value) {
    // Format BigInt values
    if (typeof value === 'bigint') {
      // Check if it's an address
      if (key === 'poster' || key === 'worker' || key === 'wallet' || 
          key === 'treasury' || key === 'oracle' || key === 'platinumPool' ||
          key === 'requestedBy' || key === 'retractedBy' || key === 'inFavorOf' ||
          key === 'bannedWorker' || key === 'token') {
        return `\`${value}\``;
      }
      // Check if it's taskId - just show as number
      if (key === 'taskId' || key === 'arg0') {
        return `#${value.toString()}`;
      }
      // Check if it's payout, bountyAmount, amount - likely in USDC (6 decimals)
      if (key === 'payout' || key === 'bountyAmount' || key === 'amount' || 
          key === 'arg2' || key === 'arg1') {
        // USDC has 6 decimals
        return `$${(Number(value) / 1000000).toFixed(2)} USDC`;
      }
      // Check if it's stake - likely in AXOBOTL (18 decimals)
      if (key === 'stakeAmount') {
        return `${ethers.formatEther(value)} AXOBOTL`;
      }
      // Check if it's timestamp
      if (key === 'deadline' || key === 'newDeadline' || key === 'arg2') {
        try {
          const date = new Date(Number(value) * 1000);
          if (date.getFullYear() > 2030) {
            return `${Number(value)} (raw)`;
          }
          return date.toLocaleString();
        } catch {
          return value.toString();
        }
      }
      // Large numbers - show as wei
      if (value > ethers.parseEther('1')) {
        return `${ethers.formatEther(value)} ETH`;
      }
      return value.toString();
    }
    // Format boolean
    if (typeof value === 'boolean') {
      return value ? '✅ Yes' : '❌ No';
    }
    // Format bytes/hex
    if (typeof value === 'string' && value.startsWith('0x')) {
      if (value.length > 20) {
        return `${value.slice(0, 10)}...${value.slice(-8)}`;
      }
      return value;
    }
    return value?.toString() || 'N/A';
  }
};
