# DEX Aggregator with Referral Monetization

A decentralized exchange aggregator on Solana with a built-in referral system for monetization.

## Features

- 🔄 **DEX Aggregation**: Aggregate liquidity from multiple DEXes for best prices
- 👥 **Referral System**: Track referrals and earn rewards
- 💰 **Fee Sharing**: Configurable fee structure with referrer rewards
- 🎯 **Slippage Control**: Adjustable slippage tolerance
- 🔒 **Secure**: Built on Solana with Anchor framework
- 📊 **Real-time Stats**: Track referral performance and earnings

## Quick Start

### Prerequisites

- Node.js 16+
- Rust & Cargo
- Solana CLI
- Anchor CLI
- Phantom Wallet

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/dex-aggregator-referral.git
cd dex-aggregator-referral

# Install dependencies
yarn install

# Build the program
anchor build

# Run tests
anchor test

# Start the frontend
cd app
yarn install
yarn dev
