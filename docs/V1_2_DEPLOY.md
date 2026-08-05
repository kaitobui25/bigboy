# BigBoy V1.2 deployment

## Scope

This build implements the Nansen wallet pipeline directly, while creating the V1.1-compatible sheet foundation. Dune trade import is intentionally not implemented because no Dune API/query configuration is required for V1.2 wallet discovery and scoring.

## Deploy with clasp

```powershell
cd <your-bigboy-repo>
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
5. Keep Free-plan defaults initially:
   - `NANSEN_DAILY_BUDGET=9`
   - `MAX_WALLETS_SCORE_PER_RUN=1`
   - `NANSEN_DISCOVERY_LIMIT=20`
6. Run these separately during acceptance:
   - `Run Nansen Discovery`
   - `Score Priority Wallets`
   - `Rebuild Wallet Cohort`
   - `Sync Cohort to Tracked Wallets`

## Important budget behavior

The script keeps a conservative local daily ledger in Script Properties. It reserves the estimated cost before each request. When Nansen exposes an observed credit-cost response header, the ledger is adjusted.

With 100 total credits, 9 credits/day is suitable only for short acceptance testing. Reduce discovery frequency after the first cohort is populated.

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
