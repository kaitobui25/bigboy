# BigBoy V1.2 deployment

## Scope

This build implements the Nansen wallet pipeline directly, while creating the V1.1-compatible sheet foundation. Dune trade import is intentionally not implemented because no Dune API/query configuration is required for V1.2 wallet discovery and scoring.

## Deploy with clasp

```powershell
cd <your-bigboy-repo>
git fetch origin
git switch agent/v1-2-nansen-wallet-pipeline
git pull
Copy-Item .clasp.example.json .clasp.json
# Replace scriptId inside .clasp.json with your real Apps Script ID.
clasp login
clasp push
clasp open-script
```

Do not commit `.clasp.json` or `.clasprc.json`.

## First run

1. Reload the Google Sheet.
2. Open `BigBoy > Setup / Upgrade V1.2`.
3. Open `BigBoy > Set Nansen API Key` and paste the key.
4. In `01_CONFIG`, set `NANSEN_ENABLED` to `TRUE`.
5. For broad Base discovery, set `MIN_DISCOVERY_TRADE_USD=1000`.
6. Run `BigBoy > Run V1.2 Self Tests` first. This uses no API credits.
7. Check the local budget and Nansen Usage Analytics before running another API call.
8. Run these separately during acceptance:
   - `Run Nansen Discovery`
   - `Score Priority Wallets`
   - `Rebuild Wallet Cohort`
   - `Sync Cohort to Tracked Wallets`

## Empty discovery diagnostics

Version 1.2.1 distinguishes three outcomes in `05_RUN_LOG`:

- `NO_DATA`: HTTP 200, but Nansen returned `data=[]`. BigBoy did not filter any wallet.
- `FAILED` with `PARSER_REJECTED_ALL`: Nansen returned rows, but the parser rejected all of them.
- `SUCCESS`: at least one valid row reached the wallet inbox pipeline.

For a run created by the older code, inspect the latest `NANSEN_DISCOVERY` row:

```text
rows_received = 0 and wallet_count = 0
→ Nansen returned no data.

rows_received > 0 and wallet_count = 0
→ parser or chain/address normalization problem.
```

The Smart Money DEX Trades endpoint only covers a rolling 24-hour window. A high minimum trade value on one chain can legitimately return no rows.

## Important budget behavior

The script keeps a conservative local daily ledger in Script Properties. It reserves the estimated cost before each request. When Nansen exposes an observed credit-cost response header, the ledger is adjusted.

`credits_used` in the Google Sheet is therefore a local estimate unless such a header is present. Check Nansen Usage Analytics for the actual account deduction before making another call. Do not reset the local budget merely to bypass a legitimately consumed request.

Suggested acceptance settings:

```text
NANSEN_DAILY_BUDGET=9
MAX_WALLETS_SCORE_PER_RUN=1
NANSEN_DISCOVERY_LIMIT=20
MIN_DISCOVERY_TRADE_USD=1000
NANSEN_DETAIL_PER_PAGE=100
NANSEN_MAX_PNL_PAGES=5
```

With 100 total credits, discovery must not be polled repeatedly. Populate a cohort, then reduce discovery frequency.

## Expected sheets

- `00_README`
- `01_CONFIG`
- `02_WALLETS`
- `03_TRADES_RAW`
- `04_TOKEN_RESULTS`
- `05_RUN_LOG`
- `06_WALLET_INBOX`
- `07_WALLET_METRICS`
- `08_WALLET_COHORT`

## Current limitations

- V1.2 treats every address as an independent temporary entity.
- No Dune/Arkham entity resolution or market-maker exclusion yet.
- No aggregator, Safe/AA, contract-wallet or multi-hop attribution.
- Token quality enrichment works only when V1.1-format rows already exist in `03_TRADES_RAW` and `04_TOKEN_RESULTS`.
