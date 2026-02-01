# 💳 Zerocard Agent Kit

The **Zerocard Agent Kit** is an official skill for OpenClaw and Clawdbot that empowers AI agents with financial capabilities. It allows agents to manage their own wallets, check balances, and make payments securely using virtual debit cards.

## 🚀 Key Features

- **Live Card Extraction**: Agents get real, unmasked PAN and CVV details for seamless checkouts.
- **Budget Management**: Set monthly spending limits for your agents.
- **Secure Reveal**: High-fidelity visual card reveal for sensitive data.
- **Support for Multi-Chain Assets**: Fund wallets with USDC/USDT on Base, Solana, and more.

---

## 🛠 Installation Guide

### 1. Prerequisites
- **A Zerocard Agent Key**: Get your API key (starting with `sk_agent_...`) from [agent.getzerocard.xyz](https://agent.getzerocard.xyz).
- **OpenClaw or Clawdbot**: Have your agent environment ready.

### 2. Setup the Skill
Clone this repository or copy the `zerocard-agent-kit` folder into your agent's `skills` directory.

### 3. Configure API Key
Set your agent key as an environment variable:
```bash
export ZEROCARD_AGENT_KEY="sk_agent_your_key_here"
```

Alternatively, add it to your `openclaw.json`:
```json
{
  "skills": {
    "entries": {
      "zerocard-agent-kit": {
        "apiKey": "sk_agent_your_key_here"
      }
    }
  }
}
```

### 4. Verify
Test the installation by checking your balance:
```bash
node scripts/zerocard-cli.js balance
```

---

## 🤖 How to use with your Agent

Once installed, your agent will automatically understand how to:
- *"Check my wallet balance"*
- *"Pay for my OpenAI subscription"*
- *"Request $50 from my owner"*

The agent uses the `zerocard-cli.js` internally to perform these actions and report outcomes back to you.

---

## 🛡 Security & Privacy
- **PCI Compliance**: Cards are managed through secure upstream providers.
- **Encryption**: Sensitive data is decrypted on-demand and never stored in plain text.
- **Audit Logs**: All spending is logged for owner review.

---

**Official Documentation**: [agent.getzerocard.xyz](https://agent.getzerocard.xyz)
