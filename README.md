# BigBoy V1.2 — Nansen Wallet Pipeline

BigBoy V1.2 tu dong tim, uu tien va cham chat luong Smart Money wallet bang Nansen, sau do luu ket qua trong Google Sheets.

Dau ra la cohort wallet phuc vu nghien cuu:

```text
PROVISIONAL
VERIFIED
REJECTED / WAIT_DATA
```

Day khong phai buy signal va chua dat lenh.

## V1.2 da lam

- Google Sheets schema va migration idempotent.
- Smart Money DEX Trades discovery.
- Wallet inbox chong duplicate.
- Priority queue khong dung FIFO don gian.
- PnL Summary 90D.
- PnL Detail 180D co pagination guard.
- Wallet score 0–100 voi component breakdown.
- Wallet hard gate va ly do pass/fail.
- Cohort `PROVISIONAL / VERIFIED`.
- Dong bo cohort sang tracked wallet list ma khong xoa row manual.
- Local Nansen credit guard, retry va run log.
- Parser self-test khong goi API.
- Comment tieng Viet cho cac doan logic chinh trong `src/apps-script`.

## Discovery diagnostics

Tu version `1.2.1`, discovery khong con bao `SUCCESS` mo ho khi API tra rong:

```text
NO_DATA
Nansen HTTP 200 nhung data=[]

FAILED / PARSER_REJECTED_ALL
Nansen co tra row nhung BigBoy loai toan bo

SUCCESS
Co it nhat mot valid wallet row
```

Xem chi tiet o `05_RUN_LOG`:

```text
rows_received
wallet_count
error_message
credits_used
```

`credits_used` la local estimate neu Nansen khong tra credit-cost header. Nansen Usage Analytics moi la nguon kiem tra so credit that bi tru.

## Defaults cho Base acceptance

```text
CHAIN=base
MIN_DISCOVERY_TRADE_USD=1000
NANSEN_DISCOVERY_LIMIT=20
NANSEN_DAILY_BUDGET=9
MAX_WALLETS_SCORE_PER_RUN=1
```

Discovery dung threshold rong; chat luong wallet duoc loc o buoc PnL scoring, khong nen dung trade-value threshold qua cao de thay cho wallet gate.

## Deploy

Xem [docs/V1_2_DEPLOY.md](docs/V1_2_DEPLOY.md).

## Build plan

- [V1.2](docs/BUILD_PLAN_V1_2.md)
- [V1.3](docs/BUILD_PLAN_V1_3.md)
- [V1.4](docs/BUILD_PLAN_V1_4.md)
- [V1.5](docs/BUILD_PLAN_V1_5.md)

## Chua lam trong V1.2

- Dune trade import cua V1.1.
- Entity resolution va market-maker exclusion.
- Aggregator, Safe/AA, contract-wallet attribution.
- Multi-hop normalization.
- Final token gate/score/status.
- PostgreSQL, dashboard web hoac auto trading.
