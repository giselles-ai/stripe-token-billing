# stripe-token-billing

CLI tool for managing Stripe Rate Card models for token-based billing.

Automates the process of adding new LLM models to a Stripe Rate Card by creating Metered Items and Rates for both input and output tokens in a single command.

## Setup

### 1. Install

```bash
npx stripe-token-billing --help
```

### 2. Configure credentials

Create config files for each environment under `~/.config/stripe-token-billing/`:

```bash
mkdir -p ~/.config/stripe-token-billing
```

**Sandbox** (`~/.config/stripe-token-billing/.env.sandbox`):

```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_RATE_CARD_ID=brc_...
STRIPE_METER_ID=mtr_...
```

**Production** (`~/.config/stripe-token-billing/.env.production`):

```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_RATE_CARD_ID=brc_...
STRIPE_METER_ID=mtr_...
```

### Environment Variables

| Variable | Description |
|---|---|
| `STRIPE_SECRET_KEY` | Stripe API key (`sk_test_...` or `sk_live_...`) |
| `STRIPE_RATE_CARD_ID` | Existing Rate Card ID (`rcd_...`) |
| `STRIPE_METER_ID` | Existing Meter ID (`mtr_...`) |

## Usage

The `--env` flag is required for all commands. It loads the corresponding config file (`~/.config/stripe-token-billing/.env.<environment>`).

### Add a model

```bash
# Preview what will be created (no API calls)
npx stripe-token-billing --env sandbox add \
  --model "google/gemini-3-flash" \
  --input-price 0.50 \
  --output-price 3.00 \
  --markup 10 \
  --dry-run

# Create in sandbox
npx stripe-token-billing --env sandbox add \
  --model "google/gemini-3-flash" \
  --input-price 0.50 \
  --output-price 3.00 \
  --markup 10

# Then create the same model in production
npx stripe-token-billing --env production add \
  --model "google/gemini-3-flash" \
  --input-price 0.50 \
  --output-price 3.00 \
  --markup 10
```

### List rates

```bash
npx stripe-token-billing --env sandbox list
```

### Options

| Option | Description | Default |
|---|---|---|
| `--env` | Environment to use (e.g. `sandbox`, `production`) | Required |
| `--model` | Model identifier (e.g. `google/gemini-3-flash`) | Required |
| `--input-price` | Price per million input tokens (USD) | Required |
| `--output-price` | Price per million output tokens (USD) | Required |
| `--markup` | Markup percentage | `10` |
| `--dry-run` | Preview without making API calls | `false` |

## Development

```bash
pnpm install
pnpm test          # Run tests
pnpm test:watch    # Run tests in watch mode
pnpm format        # Auto-fix lint & format
pnpm build         # Compile TypeScript
```

## What it creates

For each model, the `add` command creates:

1. **Input tokens Metered Item** — with `meter_segment_conditions` for `model` and `token_type=input`
2. **Input tokens Rate** — unit amount = `input_price × (1 + markup%) ÷ 1,000,000`
3. **Output tokens Metered Item** — same as above with `token_type=output`
4. **Output tokens Rate** — unit amount = `output_price × (1 + markup%) ÷ 1,000,000`

All resources are tagged with `created_by: "Stripe Token Billing"` metadata.
