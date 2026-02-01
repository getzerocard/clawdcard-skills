---
name: zerocard-agent-kit
description: Financial management system for AI Agents - pay for services, manage wallet, request funds
homepage: https://agent.getzerocard.xyz
metadata: { "openclaw": { "emoji": "💳", "requires": { "env": ["ZEROCARD_AGENT_KEY"] }, "primaryEnv": "ZEROCARD_AGENT_KEY" } }
bins: ["node"]
---

# Zerocard Agent-Kit (Official Clawdbot Skill): Financial System for AI Agents

You have access to a financial management system through Zerocard. This enables you to:
- Check your wallet balance
- Make payments using virtual debit cards
- Request funds from your owner when running low
- Report expenses with clear reasoning

## Core Principles

1. **Always check balance first** - Before any payment, verify you have sufficient funds
2. **Explain your reasoning** - When spending or requesting money, always explain WHY
3. **Be frugal** - Only spend what's necessary to complete the task
4. **Report everything** - After successful payments, report what you bought and why
5. **Request responsibly** - Only request funds when genuinely needed, with clear justification
6. **Do NOT edit source code** - You are forbidden from modifying your own financial tools, CLI scripts, or SKILL definitions. If you need a change, ask your owner.

## Available Tools

### 1. zerocard_get_wallet_balance
Check your current wallet balance and budget status.

**How to Execute:**
`node {baseDir}/scripts/zerocard-cli.js balance`

**When to use:**
- Before making any payment
- When user asks about your financial status
- Before deciding to request more funds

**Response includes:**
- `available_usd` - Current USD balance
- `monthly_budget` - Your spending limit this month
- `spent_this_month` - How much you've spent
- `remaining_budget` - How much budget remains
- `assets` - All currency balances

### 2. zerocard_get_deposit_address
Get deposit addresses to share with your owner when requesting funds.

**How to Execute:**
`node {baseDir}/scripts/zerocard-cli.js deposit --type=<type>`

**Parameters:**
- `type`: "crypto" (USDC/USDT on Base, Solana, etc.) or "ngn" (Nigerian Naira bank transfer)

**When to use:**
- When asking owner to fund the wallet
- Include in fund request messages

### 3. zerocard_make_payment
Get virtual card details to complete a purchase. Thanks to Zerocard's live extraction system, the PAN and CVV returned are **REAL and UNMASKED** (e.g. `5371...`). You can use these details directly at checkout.

**How to Execute:**
`node {baseDir}/scripts/zerocard-cli.js payment --amount=<amount> --merchant=<merchant> --purpose=<purpose>` (Optional: `--force-new=true`)

**Parameters:**
- `amount` (required): Transaction amount in USD
- `merchant` (required): Name of merchant/service (e.g., "OpenAI", "AWS", "Vercel")
- `purpose` (required): Clear reason for this expense
- `force_new_card`: Set true only if previous card declined or privacy needed

**Important:**
- Card is reused to save $1 issuance fee when possible
- If balance is insufficient, you'll get an error - request funds first
- Always report the expense after successful payment
- Returns an `accessToken` required for `zerocard_reveal_card`

### 4. zerocard_reveal_card
Generate a secure web URL to reveal the card details visually. Use this as a high-fidelity fallback if you need to double-check the details or if `zerocard_make_payment` failed to extract them automatically.

**How to Execute:**
`node {baseDir}/scripts/zerocard-cli.js reveal --token=<accessToken>`

**Parameters:**
- `accessToken` (required): The token received from `zerocard_make_payment`

**Standard Execution Flow:**
1. Call this tool to generate a secure reveal URL.
2. The tool returns a `url`.
3. **Use your browser tool** to open this URL.
4. **Wait for the page to load**: The details will be rendered instantly using backend decryption.

**How to use the data:**
- Extract the unmasked PAN, CVV, and Expiry.
- Use these details at the merchant's checkout. Do NOT share them in chat.

### 5. zerocard_report_expense
Report completed expenses to your owner. **ALWAYS call this after successful payments.**

**How to Execute:**
`node {baseDir}/scripts/zerocard-cli.js report --amount=<amount> --merchant=<merchant> --purpose=<purpose> --outcome=<outcome>`

**Parameters:**
- `amount` (required): Amount spent in USD
- `merchant` (required): Where money was spent
- `purpose` (required): Why expense was necessary
- `outcome` (required): What was achieved

### 6. zerocard_request_funds
Request additional funds from your owner when balance is low.

**How to Execute:**
`node {baseDir}/scripts/zerocard-cli.js request-funds --amount=<amount_needed> --reason=<reason> --urgency=<urgency>`

**Parameters:**
- `amount_needed` (required): Amount needed in USD
- `reason` (required): Clear explanation of why funds are needed
- `urgency`: "low", "medium", or "high"
- `deposit_instructions`: Include wallet addresses (default: true)

## Decision Tree: Making Payments

```
1. User asks you to pay for something
   ↓
2. Call zerocard_get_wallet_balance
   ↓
3. Check: Is available_usd ≥ amount needed?
   ├─ YES → Continue to step 4
   └─ NO → Call zerocard_request_funds with clear reason
          → Wait for owner to fund → Return to step 2
   ↓
4. Check: Is remaining_budget ≥ amount needed?
   ├─ YES → Continue to step 5
   └─ NO → Inform user that monthly budget would be exceeded
          → Ask if they want to increase budget
   ↓
5. Call zerocard_make_payment with amount, merchant, purpose
   ↓
6. Use card details (PAN, CVV, expiry) directly from the tool output to complete checkout
   (Optional: If output is legacy/masked, use zerocard_reveal_card as a fallback)
   ↓
7. Call zerocard_report_expense with outcome
```

## Example Conversations

### Example 1: Successful Payment (with Secure Reveal)
```
User: "Pay $20 for my OpenAI API credits"

Agent thinking:
1. Check balance first
2. Balance is $45.50 - sufficient!
3. Make payment -> PAN is masked
4. Reveal card details via Widget.js
5. Extract details using browser
6. Complete checkout
7. Report expense

Agent actions:
- zerocard_get_wallet_balance() → $45.50 available
- zerocard_make_payment(amount=20, merchant="OpenAI", purpose="API credits") -> returns masked PAN + accessToken
- zerocard_reveal_card(accessToken) -> returns filePath: "/tmp/card-reveal.html"
- Use browser tool: open("/tmp/card-reveal.html") -> extract unmasked details
- Use browser tool: complete checkout at openai.com
- zerocard_report_expense(amount=20, merchant="OpenAI", purpose="API credits", outcome="Credits purchased")
```

### Example 2: Insufficient Funds
```
User: "Subscribe to GitHub Copilot for $10/month"

Agent thinking:
1. Check balance first
2. Balance is only $3.00 - insufficient!
3. Request funds with clear reasoning

Agent actions:
- zerocard_get_wallet_balance() → $3.00 available
- zerocard_get_deposit_address(type="crypto")
- zerocard_request_funds(
    amount_needed=15,
    reason="Need $10 for GitHub Copilot subscription + buffer for future tasks",
    urgency="medium"
  )

Agent response:
"I don't have enough funds to subscribe to GitHub Copilot ($10/month). My current balance is $3.00. 

I've generated deposit addresses for you:
- **Base (USDC):** 0x1234...
- **Solana (USDC):** ABC123...

Would you like to fund the wallet so I can complete this subscription?"
```

### Example 3: Proactive Budget Management
```
If your balance drops below $5, proactively inform your owner:

"⚠️ Low Balance Alert: My wallet balance is now $4.32. 

Remaining budget this month: $56.00
Spent this month: $44.00

If you have upcoming tasks requiring payments, consider topping up:
- Base USDC: 0x1234..."
```

## Security Notes

- Never share card details (PAN, CVV) in chat messages to users
- Card details are for checkout forms only
- Your API key is securely stored in environment variables
- All transactions are logged and auditable

## API Configuration

The skill requires this environment variable:
- `ZEROCARD_AGENT_KEY`: Your agent API key (sk_agent_xxx format)

To configure in OpenClaw:
```json
{
  "skills": {
    "entries": {
      "zerocard-agent-kit": {
        "apiKey": "sk_agent_YOUR_KEY_HERE"
      }
    }
  }
}
```
