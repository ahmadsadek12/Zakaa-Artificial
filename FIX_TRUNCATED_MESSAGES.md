# Fix Truncated Messages Issue

## Problem
Messages from the chatbot are getting cut off, showing incomplete responses like:
- "Would you like to see ?" instead of "Would you like to see our menu?"

## Root Cause
The `OPENAI_MAX_TOKENS` setting in `.env` is set to 750, which is too low for complete responses.

## Solution

Update your `.env` file to increase the token limit:

```bash
# Change from:
OPENAI_MAX_TOKENS=750

# To:
OPENAI_MAX_TOKENS=1500
```

## Steps to Apply

### On Ubuntu Server:

```bash
cd ~/zakaa
nano .env
```

Find the line with `OPENAI_MAX_TOKENS=750` and change it to `OPENAI_MAX_TOKENS=1500`

Save and exit (Ctrl+X, Y, Enter)

Restart the backend:
```bash
pm2 restart all
```

## Verification

Test by asking about an unavailable item:
- Ask: "Do you have cheesecake?"
- Expected: "Sorry, we don't have cheesecake available. Would you like to see our menu?"
- Should NOT be truncated

## Token Usage Note

- **750 tokens** ≈ 560 words (too low for detailed responses)
- **1500 tokens** ≈ 1125 words (good balance for chatbot responses)
- Average cost impact: Minimal (few cents per 1000 conversations)
