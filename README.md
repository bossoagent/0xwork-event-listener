# 0xWork Event Listener & Dashboard

Real-time event listener and monitoring dashboard for the 0xWork smart contract on Base network.

![Base](https://img.shields.io/badge/Network-Base-blue)
![Node.js](https://img.shields.io/badge/Node.js-18%2B-green)
![License](https://img.shields.io/badge/License-MIT-yellow)

## 📋 Overview

This project monitors the 0xWork smart contract on Base Mainnet and provides:
- **Real-time Event Detection**: Listens for all contract events (TaskPosted, TaskClaimed, WorkApproved, etc.)
- **Beautiful Dashboard**: Visual interface showing live events with Base + 0xWork branding
- **REST API**: Programmatic access to event data
- **RPC Fallback**: Automatic failover between multiple public RPC endpoints

## ✨ Features

- 🎯 Monitors **36+ event types** from the 0xWork TaskPool contract
- 📊 Beautiful dark-mode dashboard with Base/0xWork brand colors
- 🔄 Auto-refresh every 15 seconds
- 📜 Fetches historical events on startup (last ~6 hours)
- 🌐 Multiple RPC endpoint fallbacks for reliability
- 🎨 Rich formatting: task IDs, addresses, USDC amounts, timestamps

## 🚀 Quick Start

### Prerequisites

- **Node.js 18+** - [Install via nvm](https://github.com/nvm-sh/nvm)
- **pnpm** - `npm install -g pnpm`

### Installation

```bash
# Clone the repository
git clone https://github.com/your-repo/0xwork-event-listener.git
cd 0xwork-event-listener/implementation

# Install dependencies
pnpm install
```

### Running

```bash
pnpm start
```

Then open **http://localhost:3000** in your browser.

## ⚙️ Configuration

### Environment Variables

Copy `.env.example` to `.env` and customize:

```bash
cp .env.example .env
```

| Variable | Description | Default |
|----------|-------------|---------|
| `BASE_RPC_URL` | Base Mainnet RPC endpoint | Free public RPC |
| `PORT` | Dashboard server port | `3000` |
| `WEBHOOK_URL` | Optional Discord/Telegram webhook for alerts | (none) |

### Using Alchemy (Recommended for Production)

1. Get a free API key at [alchemy.com](https://alchemy.com)
2. Create a Base Mainnet app
3. Update `.env`:

```bash
BASE_RPC_URL=https://base-mainnet.g.alchemy.com/v2/YOUR_API_KEY
```

## 📊 Dashboard

The dashboard displays:

- **Total Events**: Count of all captured events
- **Current Block**: Latest Base block number
- **Tasks Active**: Number of unique tasks in events
- **Event Types**: Count of different event categories
- **Live Feed**: Real-time scrolling list of events

### Event Display

Each event card shows:
- 🎭 Event type with emoji
- 🎫 Task ID (decoded from hex)
- 👷 Worker/Poster addresses (truncated)
- 💵 Payout amounts in USDC
- ⏰ Actual event timestamp from blockchain
- 📦 Block number

## 🔌 API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /` | Dashboard HTML |
| `GET /api/events` | List events (add `?limit=20`) |
| `GET /api/stats` | Statistics & metrics |
| `GET /api/health` | Health check |

### Example Responses

**GET /api/events?limit=5**
```json
[
  {
    "id": "43275381-0x8a4cb...",
    "event": "WorkApproved",
    "emoji": "✅",
    "timestamp": "Mar 12, 6:28:50 PM",
    "blockNumber": 43275381,
    "data": {
      "taskId": "113",
      "worker": "0x62b8E465...119a8ea9",
      "payout": "$7.60 USDC"
    }
  }
]
```

**GET /api/stats**
```json
{
  "totalEvents": 24,
  "lastBlock": 43277102,
  "eventTypes": {
    "WorkApproved": 8,
    "RevenueShared": 8,
    "TaskClaimed": 4
  },
  "recentTasks": ["113", "116", "117"]
}
```

## 🏗️ Architecture

```
┌─────────────────┐     ┌──────────────────┐
│  Base Network   │────▶│  Event Listener  │
│  (Blockchain)   │     │  (Polling every  │
└─────────────────┘     │     15s)         │
                        └────────┬─────────┘
                                 │
                        ┌────────▼─────────┐
                        │   Express API    │
                        │   + Dashboard     │
                        └──────────────────┘
```

### How It Works

1. **Polling**: Every 15 seconds, queries the Base network for new blocks
2. **Event Filtering**: For each block, checks all 36 event types
3. **Decoding**: Parses indexed parameters (taskId, addresses) from transaction topics
4. **Formatting**: Converts hex values to human-readable format (USDC amounts, timestamps)
5. **Storage**: Keeps last 100 events in memory
6. **Dashboard**: Serves real-time data via WebSocket-free polling

### Monitored Events

| Event | Description |
|-------|-------------|
| `TaskPosted` | New task created |
| `TaskClaimed` | Worker claimed a task |
| `WorkSubmitted` | Worker submitted work |
| `WorkApproved` | Work accepted & paid |
| `WorkRejected` | Work rejected |
| `TaskCancelled` | Task cancelled by poster |
| `TaskReclaimed` | Poster reclaimed stake |
| `TaskAbandoned` | Worker abandoned task |
| `DisputeResolved` | Dispute outcome |
| `RevenueShared` | Platform revenue share |
| ... | And 26 more admin/config events |

## 🌐 Deployment

### Local Production

```bash
# Build optimized start script
PORT=3000 BASE_RPC_URL=https://base-mainnet.g.alchemy.com/v2/YOUR_KEY pnpm start
```

### VPS/Render/Railway

1. Set environment variables in your dashboard
2. Use the start command: `pnpm start`
3. The app listens on `PORT` (default 3000)

### Docker (Optional)

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install -g pnpm && pnpm install
COPY . .
EXPOSE 3000
CMD ["pnpm", "start"]
```

## 🤝 Contributing

1. Fork the repo
2. Create a feature branch
3. Make changes
4. Submit a PR

## 📝 License

MIT License - feel free to use for your own projects!

## 🙏 Acknowledgments

- [0xWork](https://0xwork.com) - The task marketplace
- [Base](https://base.org) - Ethereum L2 network
- [Ethers.js](https://docs.ethers.org) - Blockchain interaction
