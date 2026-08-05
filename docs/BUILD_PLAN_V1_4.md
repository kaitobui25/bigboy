# BigBoy V1.4 — Attribution, Contract Wallet & Multi-hop Normalization

> Mục tiêu duy nhất: tăng độ chính xác và độ phủ của trade detection bằng cách nhận diện đúng wallet/entity đứng sau aggregator, Safe/AA/contract wallet và gom nhiều pool legs thành một economic buy/sell.
>
> Vẫn dùng Google Sheets + Apps Script + Dune. Chưa làm final candidate score, dashboard riêng, PostgreSQL hoặc trading execution.

---

## 1. Kết quả cần nhìn thấy

Sau V1.4, một token result phải truy ngược được:

```text
token result
→ normalized economic event
→ selected attribution
→ raw DEX/aggregator/transfer rows
→ transaction
→ wallet
→ entity
```

Mỗi economic event phải có:

- matched wallet và cluster;
- attribution method;
- confidence;
- target token;
- BUY/SELL/ROTATION/IGNORE/AMBIGUOUS;
- raw USD và normalized USD;
- source transaction link;
- reason nếu cần review.

V1.4 chấp nhận một số transaction là `AMBIGUOUS`. Không chấp nhận gán bừa để tăng recall.

---

## 2. Điều kiện đầu vào

V1.4 chỉ bắt đầu khi V1.3 đã đạt:

- tracked wallets có `cluster_key`;
- system wallets bị loại;
- entity-first aggregation hoạt động;
- đã có transaction sample direct, aggregator, contract wallet và multi-hop;
- đã đo được direct-taker-only bỏ sót loại transaction nào.

V1.4 giữ nguyên wallet score và entity mapping, trừ khi phát hiện bug.

---

## 3. Phạm vi V1.4

### 3.1 Làm trong phiên bản này

```text
DEX pool-level trades
+ aggregator intent trades
+ EOA tx_from fallback
+ targeted token-transfer fallback
→ attribution selection
→ transaction grouping
→ token net-flow normalization
→ economic events
→ entity-first token aggregation
```

### 3.2 Chưa làm

- final token gate/score/status;
- shadow validation 14 ngày;
- full audit/change-log framework;
- dashboard;
- PostgreSQL;
- real-time mempool;
- Solana;
- auto execution.

---

## 4. Attribution methods

Selection order:

```text
1. AGGREGATOR_TAKER
2. DEX_TAKER
3. TX_FROM_FALLBACK
4. NET_TRANSFER_FALLBACK
5. AMBIGUOUS
```

Một economic event chỉ có **một primary attribution**.

Default confidence:

| method | confidence |
|---|---:|
| `AGGREGATOR_TAKER` | 1.00 |
| `DEX_TAKER` | 1.00 |
| `TX_FROM_FALLBACK` | 0.80 |
| `NET_TRANSFER_FALLBACK` | 0.70 |
| `AMBIGUOUS` | 0.00 |

Các giá trị phải configurable và chỉ điều chỉnh sau validation.

### Nguyên tắc

- không dùng `tx_to` như token receiver;
- không dùng `tx_from` cho contract wallet;
- aggregator intent được ưu tiên hơn pool legs;
- missing owner/conflict → ambiguous;
- ambiguous event không được tính vào candidate;
- recall thấp còn sửa được, false attribution nguy hiểm hơn.

---

## 5. Contract wallet detection

Lưu:

```text
is_contract_wallet
contract_type
contract_detection_source
```

Nguồn:

- code presence trên EVM;
- Dune label;
- known Safe/AA labels;
- manual override;
- contract allowlist/registry.

`contract_type`:

```text
EOA
SAFE
AA_ACCOUNT
SMART_WALLET
ROUTER
PROTOCOL
UNKNOWN_CONTRACT
```

Policy:

```text
EOA → cho phép DEX_TAKER và TX_FROM_FALLBACK
SAFE/AA/SMART_WALLET → taker/aggregator/transfer fallback, không tx_from fallback
ROUTER/PROTOCOL → không coi là tracked owner
UNKNOWN_CONTRACT → review hoặc transfer fallback
```

---

## 6. Dune query set

### 6.1 Direct DEX query

Nâng cấp query V1.1:

```text
sql/v1_4_dex_trades_incremental.sql
```

Input:

```text
wallet list
chains
from_time
min_amount_usd
```

Output:

```text
chain
block_time
tx_hash
evt_index
taker
tx_from
tx_to
token_bought_address
token_bought_symbol
token_sold_address
token_sold_symbol
amount_usd
project
```

Primary match:

```text
taker IN tracked_wallets
```

EOA fallback candidate:

```text
tx_from IN tracked_wallets
AND tracked wallet is EOA
AND taker is null/router/unusable
```

Query chỉ đánh dấu candidate; Apps Script attribution engine quyết định primary method.

### 6.2 Aggregator query

```text
sql/v1_4_aggregator_trades.sql
```

Output tối thiểu:

```text
chain
block_time
tx_hash
trace_or_evt_index
taker
project
token_bought_address
token_sold_address
amount_usd
```

Mục đích:

- lấy intent-level trade;
- xác định user/taker trước khi swap bị chia thành nhiều pool legs;
- ngăn double-count volume.

### 6.3 Transfer fallback query

```text
sql/v1_4_token_transfer_fallback.sql
```

Chỉ chạy cho transaction trong review queue:

- contract wallet;
- Safe/AA;
- Nansen có trade nhưng direct/aggregator không match;
- candidate quan trọng nhưng attribution thấp;
- missing token legs.

Không scan token transfers toàn chain.

Output:

```text
chain
tx_hash
evt_index
token_address
from_address
to_address
amount
amount_usd
```

Apps Script tính net flow về tracked wallet/cluster.

### 6.4 Contract-code helper

Có thể dùng query/helper để trả:

```text
chain
address
has_code
known_contract_type
```

Cache kết quả; không query lại mọi run.

---

## 7. Google Sheets thay đổi

### 7.1 Mở rộng `03_TRADES_RAW`

Schema chuẩn:

| column | ý nghĩa |
|---|---|
| `raw_event_key` | source-specific idempotency key |
| `source` | DEX_TRADES/DEX_AGGREGATOR/TOKEN_TRANSFERS |
| `chain` | chain |
| `block_time` | time |
| `tx_hash` | tx |
| `evt_index` | event/trace index |
| `wallet_match_candidate` | wallet candidate |
| `taker` | taker |
| `tx_from` | sender |
| `tx_to` | destination |
| `token_bought_address` | token bought |
| `token_bought_symbol` | symbol |
| `token_sold_address` | token sold |
| `token_sold_symbol` | symbol |
| `amount_usd` | USD |
| `project` | protocol |
| `raw_payload_hash` | hash |
| `imported_at` | import time |

Raw rows append/upsert theo key. Không xóa pool legs chỉ vì aggregator đã match; giữ raw để audit nhưng không double-count ở economic-event layer.

### 7.2 `11_ATTRIBUTION`

| column | ý nghĩa |
|---|---|
| `attribution_key` | khóa |
| `chain` | chain |
| `tx_hash` | tx |
| `matched_wallet_key` | wallet |
| `matched_cluster_key` | entity |
| `attribution_method` | method |
| `attribution_confidence` | 0–1 |
| `is_contract_wallet` | TRUE/FALSE |
| `contract_type` | type |
| `is_router_taker` | router flag |
| `requires_review` | TRUE/FALSE |
| `review_reason` | reason |
| `selected_as_primary` | TRUE/FALSE |
| `calculated_at` | time |
| `source_raw_keys` | supporting raw rows |

Một `chain + tx_hash + cluster` chỉ có một primary attribution.

### 7.3 `12_TOKEN_EVENTS`

| column | ý nghĩa |
|---|---|
| `economic_event_key` | idempotency key |
| `chain` | chain |
| `tx_hash` | tx |
| `event_time` | time |
| `token_address` | target token |
| `token_symbol` | symbol |
| `wallet_key` | wallet |
| `cluster_key` | entity |
| `cohort_type` | verified/provisional |
| `event_type` | type |
| `raw_value_usd` | raw value |
| `event_weight` | direct/rotation weight |
| `wallet_quality_weight` | from V1.2 |
| `independence_weight` | from V1.3 |
| `attribution_confidence` | confidence |
| `signed_raw_value_usd` | buy positive/sell negative |
| `quality_adjusted_value_usd` | prepared value |
| `normalization_notes` | notes |
| `source_attribution_key` | attribution link |

`event_type`:

```text
BUY_DIRECT
SELL_DIRECT
ROTATION_BUY
ROTATION_SELL
IGNORE
AMBIGUOUS
```

### 7.4 Review queue mở rộng

Thêm review types:

```text
ATTRIBUTION_AMBIGUOUS
CONTRACT_WALLET
AGGREGATOR_CONFLICT
MISSING_TOKEN_LEG
TRANSFER_FALLBACK_REQUIRED
MULTI_OWNER_TRANSACTION
NORMALIZATION_OUTLIER
```

### 7.5 `04_TOKEN_RESULTS`

Rebuild từ `12_TOKEN_EVENTS`, không trực tiếp từ pool-level raw rows.

Thêm:

```text
high_conf_attribution_share
ambiguous_volume_share
direct_buy_volume
rotation_buy_volume
attribution_review_count
```

Status vẫn tạm thời. Final gate/score thuộc V1.5.

---

## 8. Idempotency và deduplication

Keys:

```text
DEX raw:
DEX_TRADES:chain:tx_hash:evt_index

Aggregator raw:
DEX_AGGREGATOR:chain:tx_hash:trace_or_evt_index

Transfer raw:
TOKEN_TRANSFERS:chain:tx_hash:evt_index

Attribution:
chain:tx_hash:wallet_key:method

Economic event:
chain:tx_hash:cluster_key:token_address:event_type
```

Dedup giữa aggregator intent và pool legs:

```text
chain + tx_hash + cluster + economic token pair
```

Nếu aggregator attribution high confidence:

- aggregator record là primary;
- pool legs vẫn giữ raw;
- normalization dùng net token flow/intent một lần;
- không cộng từng pool leg như các trade độc lập.

---

## 9. Transaction grouping

Group theo:

```text
chain + tx_hash + matched_cluster_key
```

Không group chỉ theo tx hash nếu transaction có nhiều owner tách biệt.

Nếu không tách được owner:

```text
event_type = AMBIGUOUS
requires_review = TRUE
```

---

## 10. Base asset registry

Dùng contract address, không dùng symbol.

Nhóm:

```text
STABLE
NATIVE_WRAPPED
BTC_WRAPPED
LIQUID_STAKING
IGNORE_EQUIVALENT
```

Mỗi row registry cần:

```text
chain
token_address
asset_group
active
version
updated_at
notes
```

Native asset không có ERC-20 address phải dùng canonical pseudo-address được định nghĩa thống nhất.

Registry thay đổi phải versioned để có thể tái tạo normalization cũ.

---

## 11. Token net-flow normalization

Trong một transaction/entity:

```text
token_net_usd =
USD bought - USD sold
```

Hoặc với transfer fallback:

```text
net token amount/value into tracked wallet/cluster
```

Intermediate token được loại khi residual nhỏ hơn:

```text
max(
  transaction_notional × INTERMEDIATE_RESIDUAL_RATIO,
  INTERMEDIATE_RESIDUAL_ABS_USD
)
```

Không loại residual lớn bất thường; chuyển review.

### 11.1 Direct buy

```text
base asset giảm
non-base token tăng
→ BUY_DIRECT
event_weight = 1.0
```

### 11.2 Direct sell

```text
non-base token giảm
base asset tăng
→ SELL_DIRECT
event_weight = 1.0
```

### 11.3 Rotation

```text
altcoin A giảm
altcoin B tăng
→ ROTATION_SELL A
→ ROTATION_BUY B
event_weight = 0.7 default
```

### 11.4 Ignore

- stable-to-stable;
- native/wrapped-native conversion;
- configured liquid-staking wrap/unwrap;
- residual intermediate token;
- excluded entity;
- below threshold;
- protocol bookkeeping with no economic position change.

### 11.5 Ambiguous

- multiple owners cannot be separated;
- missing token leg;
- conflicting aggregator/direct owner;
- impossible or extreme USD;
- transfer flow does not reconcile;
- more than one plausible target token without clear intent.

Ambiguous events contribute zero to candidate metrics.

---

## 12. Quality-adjusted event value

Prepare for V1.5:

```text
quality_adjusted_value_usd =
signed_raw_value_usd
× event_weight
× wallet_quality_weight
× independence_weight
× attribution_confidence
```

V1.4 displays this metric but does not yet use it as the sole candidate decision.

Guard:

- clamp weights to `[0,1]`;
- excluded entity weight = 0;
- ambiguous confidence = 0;
- provisional quality remains conservative;
- raw and adjusted values both retained.

---

## 13. Attribution quality metrics

Per token/window:

```text
high_conf_attribution_share =
adjusted absolute volume with confidence >= 0.9
/
total adjusted absolute volume
```

```text
ambiguous_volume_share =
ambiguous raw volume
/
(raw supported volume + ambiguous raw volume)
```

Per run:

```text
direct_match_count
aggregator_match_count
tx_from_fallback_count
transfer_fallback_count
ambiguous_count
review_count
```

Không dùng high confidence share nếu denominator quá nhỏ; ghi `INSUFFICIENT_DATA`.

---

## 14. Config mới

| key | default | ý nghĩa |
|---|---:|---|
| `ATTR_AGGREGATOR_CONFIDENCE` | 1.00 | confidence |
| `ATTR_DEX_TAKER_CONFIDENCE` | 1.00 | confidence |
| `ATTR_TX_FROM_CONFIDENCE` | 0.80 | EOA only |
| `ATTR_TRANSFER_CONFIDENCE` | 0.70 | fallback |
| `ROTATION_WEIGHT` | 0.70 | alt rotation |
| `INTERMEDIATE_RESIDUAL_RATIO` | 0.10 | tolerance |
| `INTERMEDIATE_RESIDUAL_ABS_USD` | 500 | tolerance |
| `MIN_HIGH_CONF_ATTR_SHARE_DISPLAY` | 0.70 | warning |
| `MAX_AMBIGUOUS_SHARE_DISPLAY` | 0.20 | warning |
| `MAX_TRANSFER_FALLBACK_TX_PER_RUN` | 20 | compute guard |
| `CONTRACT_CACHE_DAYS` | 30 | cache |
| `NORMALIZATION_VERSION` | v1 | event version |

Script Properties:

```text
DUNE_QUERY_DEX_TRADES_ID
DUNE_QUERY_AGGREGATOR_ID
DUNE_QUERY_TRANSFER_FALLBACK_ID
DUNE_QUERY_CONTRACT_HELPER_ID
```

---

## 15. Apps Script thay đổi

Thêm:

```text
src/apps-script/
├── AttributionService.gs
├── ContractWalletService.gs
├── SwapNormalizer.gs
├── BaseAssetRegistry.gs
├── TransferFallbackService.gs
└── AttributionMetrics.gs
```

Menu:

```text
BigBoy
├── Import Direct + Aggregator Trades
├── Process Attribution
├── Process Transfer Fallback Queue
├── Normalize Transactions
├── Rebuild Token Results
└── Run V1.4 Pipeline
```

Mỗi stage có checkpoint riêng. Stage sau không chạy nếu stage trước fail.

---

## 16. Golden transaction set

Tạo fixtures thật đã kiểm tra bằng explorer:

```text
10 direct EOA swaps
5 aggregator swaps
5 multi-hop swaps
5 Safe/AA/contract-wallet swaps
5 ambiguous/negative cases
```

Mỗi fixture có expected:

```text
matched wallet
matched cluster
method
confidence range
target token
event type
normalized USD range
should_count
```

Không lưu secret hoặc dữ liệu riêng tư.

---

## 17. Các bước build

### Step 1 — Collect golden transactions

- [ ] Chọn sample thật.
- [ ] Mở explorer/Nansen/Dune detail.
- [ ] Viết expected outcomes.
- [ ] Bao phủ negative cases.

**Exit:** có bộ sự thật để phát triển.

### Step 2 — Raw schema migration

- [ ] Expand `03_TRADES_RAW`.
- [ ] Preserve V1.1/V1.3 data.
- [ ] Add source-specific keys.
- [ ] Migration idempotent.
- [ ] Update schema version.

**Exit:** raw layer chứa nhiều nguồn.

### Step 3 — Aggregator import và dedupe

- [ ] Query aggregator.
- [ ] Import raw.
- [ ] Match tracked taker.
- [ ] Link pool legs.
- [ ] Không double-count.

**Exit:** aggregator sample ra đúng một intent.

### Step 4 — Contract detection

- [ ] Code presence/label cache.
- [ ] Classify EOA/Safe/AA/router.
- [ ] Block tx_from fallback cho contract.
- [ ] Generate review for unknown contract.

**Exit:** contract wallet không bị gán như EOA.

### Step 5 — Attribution engine

- [ ] Implement precedence.
- [ ] Select one primary.
- [ ] Store confidence/reason.
- [ ] Detect owner conflicts.
- [ ] Re-run deterministic.

**Exit:** attribution tái tạo được.

### Step 6 — Transfer fallback

- [ ] Only review-queue transactions.
- [ ] Fetch transfers.
- [ ] Net to wallet/cluster.
- [ ] Reconcile token legs.
- [ ] Ambiguous if unresolved.

**Exit:** targeted fallback tăng recall mà không scan rộng.

### Step 7 — Normalization

- [ ] Base registry.
- [ ] Group tx/entity.
- [ ] Direct buy/sell.
- [ ] Rotation.
- [ ] Intermediate residual.
- [ ] Economic event keys.
- [ ] Adjusted value.

**Exit:** multi-hop tạo đúng economic events.

### Step 8 — Rebuild token results

- [ ] Aggregate token events by entity.
- [ ] Add attribution quality.
- [ ] Ambiguous excluded.
- [ ] Links back to raw/attribution.

**Exit:** result traceable end-to-end.

### Step 9 — Technical acceptance

- [ ] Direct EOA recall >= 90% trong sample.
- [ ] Overall attribution precision >= 95% trong sample.
- [ ] False attribution rate <= 2%.
- [ ] Aggregator duplicate economic events = 0.
- [ ] Contract wallet never uses tx_from fallback.
- [ ] Ambiguous event never contributes to candidate metrics.

**Exit:** đạt Definition of Done.

---

## 18. Definition of Done

- [ ] Có ba raw sources: DEX, aggregator, targeted transfers.
- [ ] Mỗi economic event có một primary attribution.
- [ ] EOA và contract wallet được phân biệt.
- [ ] `tx_from` chỉ dùng fallback cho EOA.
- [ ] Aggregator/pool legs không double-count.
- [ ] Multi-hop được gom thành direct/rotation/ignore/ambiguous events.
- [ ] Base asset registry dùng address và version.
- [ ] Ambiguous events không đóng góp candidate.
- [ ] Token results có attribution-quality metrics.
- [ ] Golden set đạt technical acceptance.
- [ ] End-to-end trace hoạt động.
- [ ] Không thêm final gate/score, dashboard hoặc database.

---

## 19. Điều kiện chuyển sang V1.5

Chỉ chuyển khi:

- golden set ổn định;
- attribution precision/recall được đo;
- duplicate economic event bằng 0;
- high-confidence và ambiguous share có thể tính;
- normalized events tái tạo được;
- entity netting dùng normalized events;
- đã có đủ dữ liệu thật để chọn threshold candidate.

V1.5 sẽ khóa một nguồn chân lý duy nhất:

```text
GATE → SCORE → STATUS
```

và thêm audit/validation/shadow operation. Nó không mở rộng thêm nguồn transaction trừ bug.
