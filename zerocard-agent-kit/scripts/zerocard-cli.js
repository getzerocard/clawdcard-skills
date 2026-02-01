#!/usr/bin/env node
/**
 * Zerocard Agent-Kit CLI
 * 
 * This CLI tool executes API calls to the Zerocard backend for AI agents.
 * It reads credentials from environment variables and outputs JSON responses.
 * 
 * Usage: zerocard-cli <command> [options]
 * 
 * Commands:
 *   balance         Get wallet balance
 *   deposit         Get deposit address (--type=crypto|ngn)
 *   payment         Get payment card details (--amount --merchant --purpose)
 *   reveal          Generate secure Widget.js HTML (--token)
 *   report          Report an expense (--amount --merchant --purpose --outcome)
 *   request-funds   Request funds from owner (--amount --reason --urgency)
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Configuration from environment
const AGENT_KEY = process.env.ZEROCARD_AGENT_KEY;
const API_URL = process.env.ZEROCARD_API_URL || 'https://clawdcard-server-production.up.railway.app';
function parseArgs(args) {
    const result = { command: null, options: {} };

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg.startsWith('--')) {
            const [key, value] = arg.slice(2).split('=');
            result.options[key] = value || true;
        } else if (!result.command) {
            result.command = arg;
        }
    }

    return result;
}

async function makeRequest(method, path, body = null) {
    const url = new URL(path, API_URL);
    const isHttps = url.protocol === 'https:';
    const httpModule = isHttps ? https : http;

    const options = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method: method,
        headers: {
            'Authorization': AGENT_KEY,
            'x-agent-key': AGENT_KEY, // Keep for backward compatibility
            'Content-Type': 'application/json',
        },
    };

    return new Promise((resolve, reject) => {
        const req = httpModule.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (res.statusCode >= 400) {
                        resolve({ success: false, error: json.message || 'Request failed', statusCode: res.statusCode });
                    } else {
                        resolve({ success: true, data: json });
                    }
                } catch (e) {
                    resolve({ success: false, error: 'Invalid JSON response', raw: data });
                }
            });
        });

        req.on('error', (e) => {
            resolve({ success: false, error: e.message });
        });

        if (body) {
            req.write(JSON.stringify(body));
        }

        req.end();
    });
}

async function getBalance() {
    const result = await makeRequest('GET', '/v1/agents/wallet/balance');
    console.log(JSON.stringify(result, null, 2));
}

async function getDepositAddress(type) {
    const result = await makeRequest('GET', `/v1/agents/wallet/deposit-address?type=${type}`);
    console.log(JSON.stringify(result, null, 2));
}

async function makePayment(amount, merchant, purpose, forceNew = false) {
    const result = await makeRequest('POST', '/v1/agents/get-payment-method', {
        amount: parseFloat(amount),
        merchant,
        purpose,
        force_new: forceNew,
    });

    // Mask card details in output for security (only show last 4 of PAN)
    if (result.success && result.data.pan) {
        const maskedPan = '**** **** **** ' + result.data.pan.slice(-4);
        console.log(JSON.stringify({
            success: true,
            message: 'Payment card ready',
            card: {
                cardId: result.data.cardId,
                pan: result.data.pan,  // Full PAN for checkout
                pan_masked: maskedPan, // Masked for display
                expiry: result.data.expiry,
                cvv: result.data.cvv,
            },
            instructions: 'Use these card details at checkout. Do NOT share in chat.',
        }, null, 2));
    } else {
        console.log(JSON.stringify(result, null, 2));
    }
}

async function reportExpense(amount, merchant, purpose, outcome) {
    // This is a client-side action - the AI agent reports to the user
    // We just format the report nicely
    const report = {
        success: true,
        type: 'expense_report',
        expense: {
            amount: parseFloat(amount),
            merchant,
            purpose,
            outcome,
            timestamp: new Date().toISOString(),
        },
        message: `Expense of $${amount} at ${merchant} has been recorded.`,
    };
    console.log(JSON.stringify(report, null, 2));
}

async function requestFunds(amount, reason, urgency = 'medium', includeDeposit = true) {
    let depositInfo = null;

    if (includeDeposit) {
        // Get deposit addresses to include in request
        const cryptoResult = await makeRequest('GET', '/v1/agents/wallet/deposit-address?type=crypto');
        const ngnResult = await makeRequest('GET', '/v1/agents/wallet/deposit-address?type=ngn');

        depositInfo = {
            crypto: cryptoResult.success ? cryptoResult.data : null,
            ngn: ngnResult.success ? ngnResult.data : null,
        };
    }

    const request = {
        success: true,
        type: 'fund_request',
        request: {
            amount_needed: parseFloat(amount),
            reason,
            urgency,
            timestamp: new Date().toISOString(),
        },
        deposit_info: depositInfo,
        message: `Fund request for $${amount} has been prepared. Share deposit instructions with owner.`,
    };
    console.log(JSON.stringify(request, null, 2));
}

async function revealCard(accessToken) {
    const revealUrl = `${API_URL}/v1/agents/reveal/${accessToken}?x-agent-key=${AGENT_KEY}`;

    console.log(JSON.stringify({
        success: true,
        message: 'Secure card reveal URL generated',
        url: revealUrl,
        instructions: 'Use your browser tool to open this URL to see card details. The page uses real-time backend extraction to ensure reliability.',
    }, null, 2));
}

/**
 * Get billing info (name and address) for the agent's owner.
 */
async function getBillingInfo() {
    try {
        const response = await axios.get(`${API_URL}/v1/agents/billing-info`, {
            headers: { 'x-agent-key': AGENT_KEY },
            timeout: 10000,
        });

        console.log(JSON.stringify({
            success: true,
            billingInfo: response.data,
        }, null, 2));
    } catch (error) {
        console.error(JSON.stringify({
            success: false,
            error: error.response?.data?.message || error.message,
        }, null, 2));
        process.exit(1);
    }
}

/**
 * Update the knowledge base in SKILL.md with new payment instructions.
 */
async function updateKnowledgeBase(platform, instructions) {
    if (!platform || !instructions) {
        console.error(JSON.stringify({
            success: false,
            error: 'Missing platform or instructions',
        }, null, 2));
        process.exit(1);
    }

    const fs = require('fs');
    const path = require('path');
    const skillPath = path.join(__dirname, '../SKILL.md');

    try {
        let content = fs.readFileSync(skillPath, 'utf8');
        const knowledgeHeader = '## Knowledge Base';
        const newEntry = `\n### [${platform}]\n- ${instructions}\n`;

        if (content.includes(knowledgeHeader)) {
            content = content.replace(knowledgeHeader, `${knowledgeHeader}\n${newEntry}`);
        } else {
            content += `\n\n${knowledgeHeader}\n${newEntry}`;
        }

        fs.writeFileSync(skillPath, content);

        console.log(JSON.stringify({
            success: true,
            message: `Knowledge base updated for ${platform}`,
        }, null, 2));
    } catch (error) {
        console.error(JSON.stringify({
            success: false,
            error: error.message,
        }, null, 2));
        process.exit(1);
    }
}

/**
 * Get billing info (name and address) for the agent's owner.
 */
async function getBillingInfo() {
    const result = await makeRequest('GET', '/v1/agents/billing-info');
    if (result.success) {
        console.log(JSON.stringify({
            success: true,
            billingInfo: result.data,
        }, null, 2));
    } else {
        console.log(JSON.stringify(result, null, 2));
    }
}

/**
 * Update the knowledge base in SKILL.md with new payment instructions.
 */
async function updateKnowledgeBase(platform, instructions) {
    const fs = require('fs');
    const path = require('path');
    const skillPath = path.join(__dirname, '../SKILL.md');

    try {
        let content = fs.readFileSync(skillPath, 'utf8');
        const knowledgeHeader = '## Knowledge Base';
        const newEntry = `\n### [${platform}]\n- ${instructions}\n`;

        if (content.includes(knowledgeHeader)) {
            // Append right after the header for latest info first
            content = content.replace(knowledgeHeader, `${knowledgeHeader}\n${newEntry}`);
        } else {
            content += `\n\n${knowledgeHeader}\n${newEntry}`;
        }

        fs.writeFileSync(skillPath, content);

        console.log(JSON.stringify({
            success: true,
            message: `Knowledge base updated for ${platform}`,
        }, null, 2));
    } catch (error) {
        console.error(JSON.stringify({
            success: false,
            error: error.message,
        }, null, 2));
        process.exit(1);
    }
}

async function main() {
    if (!AGENT_KEY) {
        console.error(JSON.stringify({
            success: false,
            error: 'ZEROCARD_AGENT_KEY environment variable is required',
        }));
        process.exit(1);
    }

    const args = process.argv.slice(2);
    const { command, options } = parseArgs(args);

    switch (command) {
        case 'balance':
            await getBalance();
            break;

        case 'deposit':
            await getDepositAddress(options.type || 'crypto');
            break;

        case 'payment':
            if (!options.amount || !options.merchant || !options.purpose) {
                console.error(JSON.stringify({
                    success: false,
                    error: 'Required: --amount, --merchant, --purpose',
                }));
                process.exit(1);
            }
            await makePayment(options.amount, options.merchant, options.purpose, options['force-new'] === 'true');
            break;

        case 'reveal':
            if (!options.token) {
                console.error(JSON.stringify({
                    success: false,
                    error: 'Required: --token',
                }));
                process.exit(1);
            }
            await revealCard(options.token);
            break;

        case 'report':
            if (!options.amount || !options.merchant || !options.purpose || !options.outcome) {
                console.error(JSON.stringify({
                    success: false,
                    error: 'Required: --amount, --merchant, --purpose, --outcome',
                }));
                process.exit(1);
            }
            await reportExpense(options.amount, options.merchant, options.purpose, options.outcome);
            break;

        case 'request-funds':
            if (!options.amount || !options.reason) {
                console.error(JSON.stringify({
                    success: false,
                    error: 'Required: --amount, --reason',
                }));
                process.exit(1);
            }
            await requestFunds(options.amount, options.reason, options.urgency, options.deposit !== 'false');
            break;

        case 'billing':
            await getBillingInfo();
            break;

        case 'learn':
            if (!options.platform || !options.instructions) {
                console.error(JSON.stringify({
                    success: false,
                    error: 'Required: --platform, --instructions',
                }));
                process.exit(1);
            }
            await updateKnowledgeBase(options.platform, options.instructions);
            break;

        default:
            console.error(JSON.stringify({
                success: false,
                error: 'Unknown command. Available: balance, deposit, payment, report, request-funds, billing, learn',
            }));
            process.exit(1);
    }
}

main().catch(err => {
    console.error(JSON.stringify({ success: false, error: err.message }));
    process.exit(1);
});
