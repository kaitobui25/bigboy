# BigBoy V1 — Build Plan

> Phiên bản: 1.0  
> Phạm vi: tìm Smart Money token candidate bằng Google Sheets, Apps Script, Nansen, Dune và Arkham Web UI.  
> Không bao gồm chart confirmation, breakout/retest, execution hoặc quản lý lệnh.

---

## 1. Mục tiêu sản phẩm

BigBoy V1 phải trả lời được câu hỏi:

> Token nào đang được ít nhất 3 entity Smart Money độc lập cùng mua, trong đó có tối thiểu 2 entity đã được xác minh chất lượng ví và nguồn dữ liệu đủ tin cậy?

Đầu ra là danh sách nghiên cứu:

```text
WATCH
CANDIDATE
STRONG
```

Đầu ra không được gọi là buy signal.

### 1.1 Definition of Done

V1 được coi là hoàn thành khi:

- Google Sheets được tạo đúng schema và có menu điều khiển.
- Nansen discovery có thể thêm ví mới mà không tạo duplicate.
- Ví được chia rõ thành `PROVISIONAL` và `VERIFIED`.
- PnL 90D/180D được lưu, chấm điểm và audit được.
- Dune labels loại được các ví hệ thống phổ biến.
- Entity mapping không đếm nhiều địa chỉ cùng chủ thành nhiều whale.
- Dune DEX trades được import incremental.
- Attribution không phụ thuộc duy nhất vào `tx_from`.
- Multi-hop swap được gom về economic buy/sell cuối cùng.
- Token được aggregate theo entity trước, sau đó mới aggregate theo token.
- Chỉ có một luồng quyết định status: `GATE → SCORE → STATUS`.
- Có thể click từ candidate về transaction và ví nguồn.
- Mỗi API call được ghi log credit, thời gian và lỗi.
- Pipeline chạy ổn định ít nhất 14 ngày ở chế độ shadow.

---

## 2. Quyết định kiến trúc V1

### 2.1 Công nghệ

| Thành phần | Lựa chọn V1 | Lý do |
|---|---|---|
| Data store/dashboard | Google Sheets | Dễ quan sát, sửa tay và audit giai đoạn đầu |
| Automation | Google Apps Script | Miễn phí, tích hợp Sheets trực tiếp |
| Source control | GitHub + `clasp` | Code không bị nhốt trong Apps Script editor |
| Smart Money discovery/PnL | Nansen API | Dùng ở nơi có giá trị cao nhất |
| DEX trades/labels | Dune API | Giảm số call Nansen, phù hợp H1–H4 |
| Entity khó | Arkham Web UI | V1 kiểm tra thủ công, không phụ thuộc Arkham API |
| Token metadata/link | DEX Screener hoặc GeckoTerminal | Chỉ dùng để làm candidate dễ xem |
| Notification | Google Sheets trước | Telegram để phase sau nếu cần |

### 2.2 Phạm vi chain

V1 chỉ hỗ trợ EVM:

```text
ethereum
base
arbitrum
```

Solana để V1.1 vì:

- schema giao dịch khác EVM;
- cách nhận dạng owner/account khác;
- logic AA/Safe của EVM không dùng nguyên xi cho Solana;
- thêm Solana ngay sẽ làm attribution khó kiểm thử.

### 2.3 Không dùng n8n trong V1

n8n chưa cần thiết vì mục tiêu đầu tiên là:

- dữ liệu đúng;
- dễ audit;
- chi phí thấp;
- ít thành phần vận hành.

Chỉ xem xét n8n khi Apps Script timeout, Sheets quá chậm hoặc cần webhook/notification phức tạp.

---

## 3. Ba lỗi cấu trúc phải được sửa ngay từ thiết kế

### 3.1 Cohort không được là whitelist nhỏ cố định

Hệ thống phải có hai lớp:

#### `PROVISIONAL_POOL`

Ví được thấy trong Nansen Smart Money discovery nhưng chưa kiểm tra PnL đầy đủ.

- Có độ phủ rộng.
- Quality weight thấp.
- Có thể giúp đưa token vào `WATCH`.
- Không được tự mình tạo `STRONG`.

#### `VERIFIED_COHORT`

Ví đã vượt wallet gate và entity check.

- PnL 90D dương.
- PnL 180D dương.
- Có đủ số token giao dịch/thắng.
- Không phụ thuộc một winner.
- Không phải ví hệ thống.
- Có entity/independence confidence.

Hệ thống không được chỉ track verified wallets rồi bỏ qua toàn bộ provisional wallets.

### 3.2 Attribution không được join chỉ bằng `tx_from`

Thứ tự attribution:

```text
1. AGGREGATOR_TAKER
2. DEX_TAKER
3. TX_FROM_FALLBACK
4. NET_TRANSFER_FALLBACK
5. AMBIGUOUS
```

Không dùng `dex.trades.tx_to` như token receiver.

### 3.3 Status chỉ được tính ở một nơi

Pipeline bắt buộc:

```text
GATE → SCORE → STATUS
```

- Gate chỉ trả `PASS/FAIL`.
- Score chỉ được tính sau khi gate pass.
- Status chỉ được tính bởi một function duy nhất.
- Không tồn tại bộ rule thứ hai tự gọi token là CANDIDATE/STRONG.

---

## 4. Cấu trúc repository dự kiến

```text
bigboy/
├── README.md
├── docs/
│   ├── BUILD_PLAN_V1.md
│   ├── GOOGLE_SHEETS_SCHEMA.md
│   ├── OPERATIONS.md
│   └── VALIDATION_PLAN.md
├── src/
│   └── apps-script/
│       ├── appsscript.json
│       ├── Main.gs
│       ├── Menu.gs
│       ├── Config.gs
│       ├── SheetRepository.gs
│       ├── ApiAudit.gs
│       ├── NansenClient.gs
│       ├── DuneClient.gs
│       ├── WalletDiscoveryService.gs
│       ├── WalletScoringService.gs
│       ├── EntityService.gs
│       ├── TradeImportService.gs
│       ├── AttributionService.gs
│       ├── SwapNormalizer.gs
│       ├── CandidateService.gs
│       ├── DashboardService.gs
│       └── Utils.gs
├── sql/
│   ├── 01_wallet_labels.sql
│   ├── 02_dex_trades_incremental.sql
│   ├── 03_dex_aggregator_trades.sql
│   └── 04_token_transfer_fallback.sql
├── tests/
│   ├── fixtures/
│   │   ├── wallet_pnl.json
│   │   ├── direct_swap.json
│   │   ├── multi_hop_swap.json
│   │   ├── aggregator_swap.json
│   │   ├── contract_wallet_swap.json
│   │   └── duplicate_events.json
│   ├── wallet_scoring.test.js
│   ├── entity_aggregation.test.js
│   ├── attribution.test.js
│   ├── swap_normalizer.test.js
│   └── candidate_status.test.js
├── scripts/
│   └── create-sheet-template.js
├── .clasp.example.json
├── .gitignore
└── package.json
```

### 4.1 Secret management

Không commit:

- Nansen API key;
- Dune API key;
- Google Sheet ID thật;
- Apps Script ID thật;
- Arkham login/session;
- API response chứa dữ liệu riêng tư.

Secret được lưu trong Apps Script `Script Properties`:

```text
NANSEN_API_KEY
DUNE_API_KEY
DUNE_QUERY_LABELS_ID
DUNE_QUERY_DEX_TRADES_ID
DUNE_QUERY_AGGREGATOR_ID
DUNE_QUERY_TRANSFER_FALLBACK_ID
GOOGLE_SHEET_ID
```

`.clasp.json` thật phải nằm trong `.gitignore`. Repo chỉ chứa `.clasp.example.json`.

---

## 5. Google Sheets design

Tên file đề xuất:

```text
BigBoy Smart Money Token Finder V1
```

### 5.1 `00_DASHBOARD`

Mục đích: trang duy nhất người vận hành cần mở hằng ngày.

Hiển thị:

- system stage;
- last successful run;
- Nansen credits used today;
- Dune credits used month-to-date;
- provisional wallet count;
- verified wallet count;
- independent verified entity count;
- attribution recall gần nhất;
- số `WATCH / CANDIDATE / STRONG`;
- số row cần review;
- lỗi gần nhất.

Không nhập dữ liệu trực tiếp ở sheet này.

### 5.2 `01_CONFIG`

| Key | Default | Ghi chú |
|---|---:|---|
| `SYSTEM_ENABLED` | TRUE | Kill switch |
| `SYSTEM_STAGE` | BOOTSTRAP | BOOTSTRAP/EXPANSION/MAINTENANCE |
| `TIMEZONE` | Asia/Tokyo | Dùng thống nhất |
| `CHAINS` | ethereum,base,arbitrum | V1 EVM |
| `MIN_DISCOVERY_TRADE_USD` | 10000 | Discovery filter |
| `MIN_TRACKED_TRADE_USD` | 10000 | Raw trade import |
| `MIN_WALLET_SCORE` | 65 | Verified gate |
| `PROVISIONAL_QUALITY_WEIGHT` | 0.40 | Weight tối đa khi chưa chấm |
| `UNKNOWN_ENTITY_WEIGHT` | 0.50 | Independence chưa rõ |
| `ROTATION_WEIGHT` | 0.70 | Altcoin→altcoin |
| `MIN_VERIFIED_ENTITIES_GATE` | 2 | Gate tối thiểu |
| `MIN_EFFECTIVE_ENTITIES_GATE` | 3.0 | Gate tối thiểu |
| `MIN_ADJUSTED_NET_BUY_24H` | 40000 | Dùng weighted value |
| `MAX_WEIGHTED_ENTITY_SHARE` | 0.50 | Tránh một entity chi phối |
| `MIN_HIGH_CONF_ATTR_SHARE` | 0.70 | Chất lượng attribution |
| `CANDIDATE_SCORE_MIN` | 65 | Tier |
| `STRONG_SCORE_MIN` | 80 | Tier |
| `NANSEN_DAILY_BUDGET` | 9 | Local safety budget |
| `DUNE_SCAN_INTERVAL_HOURS` | 6 | Bắt đầu 4 lần/ngày |
| `IMPORT_OVERLAP_HOURS` | 2 | Tránh miss dữ liệu trễ |
| `WALLET_REVIEW_DAYS` | 30 | Review định kỳ |
| `RAW_RETENTION_DAYS` | 30 | Archive raw data |

Mọi config phải được parse/validate. Thiếu key quan trọng thì pipeline fail fast, không chạy với default ngầm.

### 5.3 `02_API_LOG`

Cột:

```text
timestamp
run_id
provider
endpoint
purpose
request_key
http_status
rows_returned
credits_used
duration_ms
success
error_code
error_message
retry_count
```

Yêu cầu:

- Mỗi API call đều có log.
- Nansen đọc credit thực tế từ response header nếu có.
- Apps Script dừng Nansen calls khi local daily budget đã hết.
- Không log API key/body chứa secret.

### 5.4 `03_WALLET_INBOX`

Cột:

```text
wallet_key
chain
wallet_address
first_seen_at
last_seen_at
discovery_count
discovery_trade_count
discovery_volume_usd
nansen_labels
latest_source_token
latest_source_tx
priority_score
queue_status
next_action
```

`wallet_key`:

```text
chain:lowercase_address
```

`queue_status`:

```text
NEW
PROVISIONAL
WAIT_SCORE
WAIT_ENTITY
VERIFIED
REJECTED
STALE
```

### 5.5 `04_WALLET_METRICS`

Cột:

```text
wallet_key
pnl_90d_realized
pnl_180d_realized
win_rate_90d
traded_tokens_180d
profitable_tokens_180d
largest_winner_usd
largest_winner_share
wallet_score
wallet_gate_pass
wallet_gate_reasons
scored_at
next_review_at
source_snapshot_id
```

`source_snapshot_id` cho phép audit response Nansen nào đã tạo ra score.

### 5.6 `05_ENTITY_MAP`

Cột:

```text
wallet_key
dune_label
dune_category
dune_owner
arkham_entity_name
arkham_entity_id
entity_type
cluster_key
independence_weight
excluded
exclusion_reason
verification_status
checked_at
review_due_at
notes
```

`verification_status`:

```text
AUTO_CONFIRMED
MANUAL_CONFIRMED
NEEDS_REVIEW
AMBIGUOUS
```

`cluster_key` precedence:

```text
ARKHAM:<entity_id>
DUNE_OWNER:<normalized_owner>
SHARED_SIGNER:<address>
PRIVATE_FUNDER:<address>
WALLET:<address>
```

Không dùng exchange hot wallet làm shared funder để gom entity.

### 5.7 `06_WALLET_COHORT`

Đây là view/materialized sheet được rebuild từ inbox, metrics và entity map.

Cột:

```text
wallet_key
chain
wallet_address
cohort_type
cluster_key
wallet_score
wallet_quality_weight
independence_weight
combined_wallet_weight
nansen_labels
active
last_seen_at
next_review_at
```

`cohort_type`:

```text
PROVISIONAL
VERIFIED
```

Formula:

```text
PROVISIONAL:
wallet_quality_weight = PROVISIONAL_QUALITY_WEIGHT

VERIFIED:
wallet_quality_weight = wallet_score / 100

combined_wallet_weight =
wallet_quality_weight × independence_weight
```

### 5.8 `07_TRADES_RAW`

Cột:

```text
raw_event_key
source
chain
block_time
tx_hash
evt_index
wallet_match_candidate
taker
tx_from
tx_to
token_bought_address
token_bought_symbol
token_sold_address
token_sold_symbol
amount_usd
project
raw_payload_hash
imported_at
```

`source`:

```text
DEX_TRADES
DEX_AGGREGATOR
TOKEN_TRANSFERS
```

Raw data là append-only. Không sửa tay.

### 5.9 `08_ATTRIBUTION`

Cột:

```text
attribution_key
chain
tx_hash
matched_wallet_key
matched_cluster_key
attribution_method
attribution_confidence
is_contract_wallet
is_router_taker
requires_review
review_reason
selected_as_primary
calculated_at
```

`attribution_method`:

```text
AGGREGATOR_TAKER
DEX_TAKER
TX_FROM_FALLBACK
NET_TRANSFER_FALLBACK
AMBIGUOUS
```

Confidence mặc định:

| Method | Confidence |
|---|---:|
| AGGREGATOR_TAKER | 1.00 |
| DEX_TAKER | 1.00 |
| TX_FROM_FALLBACK | 0.80 |
| NET_TRANSFER_FALLBACK | 0.70 |
| AMBIGUOUS | 0.00 |

Confidence phải có thể override trong config sau khi validation.

### 5.10 `09_TOKEN_EVENTS`

Cột:

```text
economic_event_key
chain
tx_hash
event_time
token_address
token_symbol
wallet_key
cluster_key
cohort_type
event_type
raw_value_usd
event_weight
wallet_quality_weight
independence_weight
attribution_confidence
signed_raw_value_usd
quality_adjusted_value_usd
normalization_notes
```

`event_type`:

```text
BUY_DIRECT
SELL_DIRECT
ROTATION_BUY
ROTATION_SELL
IGNORE
AMBIGUOUS
```

Formula:

```text
quality_adjusted_value_usd =
signed_raw_value_usd
× event_weight
× wallet_quality_weight
× independence_weight
× attribution_confidence
```

### 5.11 `10_TOKEN_AGGREGATES`

Phải aggregate hai tầng.

#### Tầng A: entity × token

```text
entity_raw_buy
entity_raw_sell
entity_raw_net
entity_adjusted_net
entity_first_buy
entity_last_buy
entity_attribution_quality
```

#### Tầng B: token

```text
effective_entities_24h
effective_entities_72h
verified_buy_entities_24h
provisional_buy_entities_24h
sell_entities_24h
raw_buy_24h
raw_sell_24h
raw_net_24h
quality_adjusted_net_buy_24h
quality_adjusted_net_buy_72h
median_verified_wallet_score
largest_weighted_entity_share
high_conf_attribution_share
first_buy_at
last_buy_at
buy_time_spread_minutes
```

Không được count wallet address trực tiếp ở token level.

### 5.12 `11_TOKEN_CANDIDATES`

Cột:

```text
candidate_key
updated_at
chain
token_address
token_symbol
gate_pass
gate_fail_reasons
candidate_score
candidate_status
effective_entities_24h
verified_buy_entities_24h
provisional_buy_entities_24h
quality_adjusted_net_buy_24h
quality_adjusted_net_buy_72h
raw_net_buy_24h
median_verified_wallet_score
largest_weighted_entity_share
high_conf_attribution_share
first_buy_at
last_buy_at
dex_url
review_status
```

### 5.13 `12_REVIEW_QUEUE`

Một hàng cho mỗi việc cần người kiểm tra:

```text
review_id
review_type
priority
entity_or_tx
description
recommended_action
source_links
status
reviewed_by
reviewed_at
resolution
```

`review_type`:

```text
ENTITY_UNKNOWN
MARKET_MAKER_SUSPECTED
ATTRIBUTION_AMBIGUOUS
CONTRACT_WALLET
BOT_CLUSTER_SUSPECTED
CANDIDATE_DATA_QUALITY
```

---

## 6. Wallet lifecycle và chống bottleneck

### 6.1 System stages

#### `BOOTSTRAP`

Điều kiện:

```text
verified independent entities < 30
```

Mục tiêu:

- tạo provisional pool rộng;
- tận dụng trial credits;
- xác minh logic trước khi tăng quy mô.

Chính sách:

- ưu tiên score ví mới;
- chưa rescore định kỳ trừ khi dữ liệu lỗi;
- token chỉ có provisional buyers tối đa là `WATCH`.

#### `EXPANSION`

Điều kiện:

```text
30 <= verified independent entities < 80
```

Chính sách:

- mỗi ngày score ít nhất một ví mới;
- ví thứ hai được chọn theo candidate impact;
- bắt đầu rescore ví cũ có dấu hiệu stale/mất phong độ;
- theo dõi coverage metrics.

#### `MAINTENANCE`

Điều kiện:

```text
verified independent entities >= 80
AND attribution validation đạt ngưỡng
```

Chính sách:

- một ví mới + một ví review mỗi ngày;
- loại ví inactive/stale;
- giữ provisional pool để không đóng mẫu quan sát.

### 6.2 Priority scoring cho ví cần chấm

```text
priority_score =
shared_candidate_count × 25
+ cooccurrence_with_verified_count × 15
+ min(discovery_count, 10) × 3
+ has_90d_label × 10
+ has_180d_label × 15
+ log10(discovery_volume_usd + 1) × 5
- recently_scored_penalty
```

Mục tiêu: dùng credit cho ví đang ảnh hưởng trực tiếp đến kết quả token, không theo FIFO đơn giản.

### 6.3 Provisional constraints

- `wallet_quality_weight = 0.40` mặc định.
- Unknown entity tiếp tục nhân `independence_weight = 0.50`.
- Một provisional wallet chưa xác minh đầy đủ có combined weight tối đa 0.20.
- Gate yêu cầu ít nhất 2 verified entities.
- `STRONG` yêu cầu ít nhất 3 verified entities.

Như vậy provisional pool tăng coverage nhưng không lấn át verified cohort.

---

## 7. Credit optimization plan

### 7.1 Nansen budget

Default local cap:

```text
9 credits/ngày
```

Apps Script phải ghi credit thực tế từ response header. Nếu giá endpoint thay đổi, local estimate chỉ dùng làm guard phụ.

#### Daily flow

```text
1 Smart Money discovery call     ~5 credits
2 wallet scoring calls/wallet    ~2 credits
```

Với ngân sách còn lại:

- bình thường score 2 ví/ngày nếu call cost cho phép;
- khi budget thấp chỉ score 1 ví;
- không tự retry lỗi 4xx;
- retry 5xx tối đa một lần với exponential backoff.

### 7.2 Trial credit strategy

Nếu tài khoản còn trial credits:

1. Dành 10–15% cho test endpoint/schema.
2. Dành phần lớn còn lại để score batch ví priority cao.
3. Không dùng trial credits để polling Smart Money nhiều lần/ngày.
4. Ghi snapshot request/response để không phải gọi lại chỉ vì mapping lỗi.

### 7.3 Nansen endpoints bị cấm trong V1 nếu chưa được duyệt

- endpoint labels có cost cao;
- premium labels;
- historical/backtesting endpoint;
- token-level premium scan toàn thị trường;
- pagination không giới hạn.

Mọi endpoint mới phải được thêm vào allowlist trong `Config.gs`.

### 7.4 Dune optimization

- Một query cho toàn bộ whitelist EVM.
- Incremental từ `last_success_time - overlap`.
- Filter chain, block_time và partition field.
- Chỉ select cột cần dùng.
- Small engine.
- Bắt đầu 4 lần/ngày.
- Không chạy lại query chỉ để refresh UI.
- Cache execution result ID và cursor.

### 7.5 Arkham usage

V1 không dùng Arkham API tự động.

Arkham Web UI chỉ dùng cho:

- ví score cao chưa có Dune owner;
- nghi ngờ market maker;
- nhiều ví có funding/behavior giống nhau;
- contract wallet khó attribution;
- candidate có giá trị cao nhưng entity confidence thấp.

---

## 8. Nansen integration plan

### 8.1 Discovery job

Schedule:

```text
01:00 JST hằng ngày
```

Flow:

```text
check kill switch
→ check daily credit budget
→ call Smart Money DEX Trades
→ validate response schema
→ extract unique wallet keys
→ upsert WALLET_INBOX
→ update discovery count/volume
→ calculate priority score
→ write API_LOG
```

Request nguyên tắc:

- ba chain trong một call nếu API hỗ trợ ổn định;
- label 90D/180D;
- min trade USD configurable;
- một page trong V1;
- order theo giá trị hoặc thời gian được API hỗ trợ thực tế.

Không hard-code field name trước khi có contract test với response thật.

### 8.2 Wallet scoring job

Schedule:

```text
01:15 JST hằng ngày
```

Chọn ví theo `priority_score`.

Calls tối thiểu:

- PnL 90D summary/detail cần thiết;
- PnL 180D detail để tính breadth và concentration.

Nếu một response đã chứa đủ metrics thì không gọi endpoint thừa.

### 8.3 Wallet gate

Hard gate mặc định:

```text
pnl_90d_realized > 0
pnl_180d_realized > 0
traded_tokens_180d >= 8
profitable_tokens_180d >= 5
largest_winner_share <= 0.50
wallet_score >= 65
```

### 8.4 Wallet score

| Component | Max |
|---|---:|
| PnL consistency 90D/180D | 25 |
| Win rate | 15 |
| Number of profitable tokens | 20 |
| Winner concentration | 20 |
| Recent activity | 10 |
| 90D/180D label overlap | 10 |
| Total | 100 |

Wallet score không được xem là xác suất thắng. Nó chỉ là ranking score.

---

## 9. Entity resolution plan

### 9.1 Auto rejection

Loại tự động nếu Dune/metadata xác định là:

```text
CEX
DEX/router
bridge
liquidity pool
protocol contract
token contract
burn address
custodian
vesting distributor
```

### 9.2 Không loại tự động

Không loại chỉ vì là:

```text
fund
VC
DAO treasury
OTC desk
```

Các loại này chuyển sang review vì có thể là Smart Money thật nhưng có khả năng hedge/hoạt động đặc biệt.

### 9.3 Market maker heuristic

Gắn `MARKET_MAKER_SUSPECTED` nếu:

- buy/sell hai chiều liên tục;
- turnover rất cao;
- median holding time rất ngắn;
- giao dịch nhiều token nhưng inventory gần trung tính;
- nhiều tương tác LP/CEX;
- Dune/Arkham label liên quan MM/LP.

Không auto reject chỉ dựa trên một heuristic.

### 9.4 Entity deduplication

Khi aggregate:

```text
n wallet addresses cùng cluster_key = 1 entity
```

Mọi buy và sell trong cluster phải net với nhau trước khi entity được tính là buyer.

---

## 10. Dune query plan

### 10.1 Query 01 — Wallet labels

Input:

```text
wallet CSV/list
```

Output:

```text
wallet
label
category
owner
source
```

Mục đích:

- auto reject service wallets;
- tạo initial `cluster_key` theo owner;
- giảm số ví phải mở Arkham thủ công.

### 10.2 Query 02 — Incremental DEX trades

Input:

```text
wallet list
from_time
chains
min_amount_usd
```

Primary match:

```text
dex.trades.taker = tracked wallet
```

Fallback match:

```text
dex.trades.tx_from = tracked wallet
AND wallet is EOA
AND taker is null/router/unusable
```

Không dùng `tx_to` làm receiver.

Output phải gồm:

```text
taker
tx_from
tx_to
token bought/sold
amount_usd
tx_hash
evt_index
project
```

### 10.3 Query 03 — Aggregator trades

Dùng để tìm intent-level trade khi ví dùng aggregator.

Deduplication key giữa aggregator và pool-level trade:

```text
chain + tx_hash + wallet/cluster + economic token pair
```

Nếu aggregator match có confidence cao, nó được ưu tiên làm attribution record; pool legs vẫn được giữ raw nhưng không double-count.

### 10.4 Query 04 — Token transfer fallback

Chỉ chạy cho transaction/wallet trong review queue:

- contract wallet;
- AA/relayer;
- Nansen thấy trade nhưng Dune direct match không thấy;
- candidate quan trọng có attribution confidence thấp.

Logic:

1. Lấy token transfers trong transaction.
2. Tính net token flow về tracked wallet/cluster.
3. Xác định base asset giảm và target token tăng.
4. Nếu không tách được owner giữa nhiều operation, đánh dấu `AMBIGUOUS`.

Không chạy query fallback cho toàn bộ chain vì tốn compute.

---

## 11. Attribution engine

### 11.1 Selection order

```text
AGGREGATOR_TAKER
→ DEX_TAKER
→ TX_FROM_FALLBACK
→ NET_TRANSFER_FALLBACK
→ AMBIGUOUS
```

Một economic event chỉ có một primary attribution.

### 11.2 Contract wallet detection

Cần lưu `is_contract_wallet`.

Nguồn:

- EVM code presence từ Dune/query helper;
- Dune label;
- Safe/AA known labels;
- manual override.

`TX_FROM_FALLBACK` không được dùng cho contract wallet.

### 11.3 Attribution data quality metrics

```text
high_conf_attribution_share =
adjusted buy volume với confidence >= 0.9
/
total adjusted buy volume
```

Gate mặc định yêu cầu:

```text
high_conf_attribution_share >= 0.70
```

### 11.4 Attribution validation

Tạo sample tối thiểu:

- 10 EOA wallets;
- 5 Safe/contract wallets nếu tìm được;
- 5 aggregator-heavy wallets;
- tối thiểu 50 transactions.

Đối chiếu với:

- Nansen address DEX trades;
- block explorer;
- Dune transaction detail.

Metrics:

```text
recall
precision
ambiguous rate
false attribution rate
```

Acceptance:

```text
EOA direct recall >= 90%
overall precision >= 95%
false attribution rate <= 2%
ambiguous rows không được tạo CANDIDATE/STRONG
```

Contract/AA recall được báo cáo riêng, không trộn để che lỗi.

---

## 12. Swap normalization

### 12.1 Transaction grouping

Group raw rows theo:

```text
chain + tx_hash + matched cluster
```

### 12.2 Token net flow

Trong một transaction:

```text
bought token = +USD
sold token = -USD
```

Intermediate token bị loại nếu net residual nhỏ hơn:

```text
max(10% của transaction notional, configurable absolute tolerance)
```

### 12.3 Event classification

#### `BUY_DIRECT`

```text
base asset giảm
non-base token tăng
weight = 1.0
```

#### `SELL_DIRECT`

```text
non-base token giảm
base asset tăng
weight = 1.0
```

#### `ROTATION_BUY / ROTATION_SELL`

```text
altcoin A giảm
altcoin B tăng
weight = 0.7
```

#### `IGNORE`

- stable-to-stable;
- native-to-wrapped-native;
- liquid staking wrap/unwrap đã cấu hình;
- residual intermediate token;
- giao dịch dưới threshold;
- excluded entity.

#### `AMBIGUOUS`

- nhiều owner trong cùng transaction không tách được;
- missing token legs;
- amount USD không hợp lý;
- attribution conflict.

Ambiguous event không được tính vào candidate score.

### 12.4 Base asset registry

Tạo config riêng theo chain, dùng contract address chứ không dùng symbol.

Nhóm:

```text
STABLE
NATIVE_WRAPPED
BTC_WRAPPED
LIQUID_STAKING
```

Registry phải có version/update date.

---

## 13. Entity-first token aggregation

### 13.1 Entity netting

Với mỗi token và cửa sổ thời gian:

```text
entity_raw_net = raw buys - raw sells
entity_adjusted_net = adjusted buys - adjusted sells
```

Một entity chỉ được tính là buyer khi:

```text
entity_adjusted_net > 0
```

### 13.2 Effective entity count

Không cộng tất cả wallet weights.

Mỗi cluster chỉ đóng góp tối đa independence weight của entity đó:

```text
effective_entities =
Σ entity_independence_contribution
```

Ví dụ:

```text
verified entity A = 1.0
verified entity B = 1.0
unknown provisional C = 0.5
unknown provisional D = 0.5
Total = 3.0
```

### 13.3 Quality-adjusted net buy

```text
entity_quality_weight =
wallet_quality_weight
× independence_weight
× attribution_confidence

quality_adjusted_net_buy =
Σ(entity_raw_net × entity_quality_weight)
```

Nếu một entity có nhiều ví, sử dụng policy bảo thủ:

- wallet score cao nhất không tự động đại diện toàn entity;
- V1 dùng median score của các active verified wallets trong cluster;
- provisional wallets không nâng score của verified entity;
- config/policy phải được test bằng fixture.

### 13.4 Entity concentration

```text
largest_weighted_entity_share =
max(entity adjusted buy)
/
sum(all positive entity adjusted buy)
```

Gate mặc định:

```text
<= 0.50
```

---

## 14. Gate, score và status

### 14.1 Gate — nguồn chân lý duy nhất cho minimum quality

Gate pass khi tất cả điều kiện đúng:

```text
verified_buy_entities_24h >= 2
effective_entities_24h >= 3.0
quality_adjusted_net_buy_24h >= 40,000 USD
raw_net_buy_24h > 0
median_verified_wallet_score >= 65
largest_weighted_entity_share <= 0.50
high_conf_attribution_share >= 0.70
ambiguous_adjusted_volume_share <= configured maximum
```

Ngoài ra:

- ít nhất 2 entity high-confidence;
- không có single entity tạo gần như toàn bộ tín hiệu;
- candidate không chỉ được tạo bởi provisional wallets.

Gate trả:

```text
gate_pass
gate_fail_reasons[]
```

### 14.2 Candidate score

Chỉ tính khi gate pass.

| Component | Max |
|---|---:|
| Effective entities | 25 |
| Quality-adjusted net buy | 25 |
| Verified wallet quality | 20 |
| Attribution/data quality | 15 |
| Buy persistence | 10 |
| Entity diversity | 5 |
| Total | 100 |

Score phải clamp từng component, tránh một biến cực lớn bù mọi lỗi khác.

### 14.3 Status function duy nhất

```javascript
function getCandidateStatus(gatePass, score) {
  if (!gatePass) return 'REJECTED';
  if (score >= 80) return 'STRONG';
  if (score >= 65) return 'CANDIDATE';
  return 'WATCH';
}
```

Không có code path nào khác được phép set status.

### 14.4 Strong additional constraints

Ngoài score >= 80:

```text
verified_buy_entities_24h >= 3
effective_entities_24h >= 4
quality_adjusted_net_buy_72h > 0
high_conf_attribution_share >= 0.80
```

Các điều kiện này nên nằm trong `strongEligibility`, không tạo một hệ status thứ hai.

Final logic:

```text
if !gatePass → REJECTED
else if score >= 80 and strongEligibility → STRONG
else if score >= 65 → CANDIDATE
else → WATCH
```

---

## 15. Bot-cluster và synchronized buying checks

Tạo các metrics:

```text
buy_time_spread_minutes
same_minute_volume_share
same_block_entity_count
similar_order_size_score
shared_funder_count
```

Gắn review nếu:

- hơn 80% adjusted buy volume xảy ra trong 60 giây;
- nhiều ví có order size gần như giống nhau;
- ví được funding cùng thời điểm;
- nhiều ví cùng cluster chưa được gom.

Không auto reject chỉ vì mua cùng lúc; có thể là cùng phản ứng với một event thật. Tuy nhiên status tối đa là `WATCH` cho đến khi review nếu bot-cluster suspicion cao.

---

## 16. Scheduling plan

### Hằng ngày 01:00 JST

```text
Nansen discovery
```

### Hằng ngày 01:15 JST

```text
score priority wallets trong daily budget
```

### Hằng ngày 02:00 JST

```text
refresh Dune labels cho ví mới/đến hạn
rebuild cohort
```

### 4 lần/ngày

```text
00:15
06:15
12:15
18:15 JST
```

Flow:

```text
import incremental DEX/aggregator trades
→ attribute
→ normalize
→ aggregate
→ gate
→ score
→ rebuild candidates/dashboard
```

### Hằng tuần Chủ nhật

```text
archive raw rows cũ
recalculate priority
flag stale wallets
refresh entity review queue
run data quality report
```

### Concurrency

Mọi scheduled job phải dùng `LockService`.

Nếu không lấy được lock:

- không chạy chồng;
- ghi `SKIPPED_LOCKED` vào API log;
- không retry tức thì.

---

## 17. Menu Google Sheets

```text
BigBoy
├── Setup / Validate Sheets
├── Run Nansen Discovery
├── Score Priority Wallets
├── Refresh Wallet Labels
├── Rebuild Cohort
├── Import DEX Trades
├── Process Attribution
├── Normalize Swaps
├── Rebuild Candidates
├── Run Full Pipeline
├── Open Review Queue
├── Run Validation Report
└── Show Credit Usage
```

Mọi manual run phải tạo `run_id` và dùng cùng logging như scheduled run.

---

## 18. Error handling

### 18.1 API errors

- 400/401/403: không retry; disable job liên quan; ghi lỗi rõ.
- 429: retry theo `Retry-After`, tối đa một lần trong V1.
- 5xx: exponential backoff, tối đa một retry.
- response schema sai: fail fast và lưu sample đã redact.

### 18.2 Partial pipeline failure

Mỗi stage ghi checkpoint:

```text
last_successful_discovery_at
last_successful_trade_import_at
last_successful_attribution_at
last_successful_candidate_build_at
```

Không update checkpoint nếu stage chưa commit xong dữ liệu.

### 18.3 Idempotency

Keys:

```text
wallet_key = chain:address
raw_event_key = source:chain:tx_hash:evt_index
attribution_key = chain:tx_hash:wallet_key:method
economic_event_key = chain:tx_hash:cluster_key:token:event_type
candidate_key = chain:token_address
```

Re-run cùng input không được tăng volume/entity count.

---

## 19. Testing strategy

### 19.1 Unit tests

Bắt buộc có fixture/test cho:

- wallet score boundaries;
- largest winner concentration;
- provisional versus verified weight;
- two wallets same cluster count as one entity;
- direct stablecoin buy;
- direct sell;
- altcoin rotation;
- multi-hop swap;
- aggregator duplicate;
- EOA `tx_from` fallback;
- contract wallet not using `tx_from` fallback;
- net-transfer fallback;
- ambiguous attribution;
- Gate pass/fail reasons;
- exactly one status function;
- strong eligibility;
- duplicate import.

### 19.2 Golden transaction set

Tạo file fixture chứa transaction thật đã được kiểm tra bằng explorer:

```text
10 direct EOA swaps
5 multi-hop swaps
5 aggregator swaps
5 Safe/contract wallet swaps
5 ambiguous/negative cases
```

Mỗi case có expected:

```text
matched wallet
cluster
method
confidence
target token
event type
normalized USD range
```

### 19.3 Shadow validation

Chạy tối thiểu 14 ngày mà chưa dùng output để trade.

Mỗi candidate review:

- entity count có đúng không;
- có duplicate không;
- Nansen/Dune có bỏ sót trade không;
- attribution có gán sai không;
- provisional share có quá lớn không;
- status có tái tạo được từ raw rows không.

### 19.4 Acceptance thresholds

```text
Duplicate economic events: 0
Status reproducibility: 100%
EOA direct attribution recall: >= 90%
Overall attribution precision: >= 95%
False entity double count: 0 trong validation sample
API budget overrun: 0
Candidate with failed gate: 0
Strong candidate without 3 verified entities: 0
```

---

## 20. Audit requirements

Từ một row `11_TOKEN_CANDIDATES`, người dùng phải truy ngược được:

```text
candidate
→ token aggregate
→ entity aggregate
→ normalized token events
→ attribution record
→ raw Dune rows
→ tx hash/explorer
→ wallet score snapshot
→ entity mapping source
```

Nếu không truy ngược được thì candidate không hợp lệ.

Các manual override phải lưu:

```text
old value
new value
reason
operator
timestamp
```

Không sửa dữ liệu raw.

---

## 21. Performance và giới hạn Google Sheets

V1 target:

```text
tracked addresses <= 300
verified entities <= 150
raw rows active <= 50,000
candidate rows active <= 1,000
```

Optimization:

- batch read/write, không gọi `setValue` từng ô;
- dùng sheet index/map trong memory;
- append theo batch;
- archive raw monthly;
- không dùng volatile formulas trên hàng chục nghìn row;
- logic chính chạy trong Apps Script, Sheets chủ yếu hiển thị.

Điều kiện migrate PostgreSQL:

- Apps Script thường xuyên timeout;
- raw rows vượt 50k–100k và khó audit;
- cần scan dưới một giờ;
- cần nhiều chain;
- cần concurrent jobs/webhooks;
- cần backtest lớn.

---

## 22. Security và operational safety

- Không có trading API trong V1.
- Không có withdrawal key.
- API keys chỉ trong Script Properties.
- Sheet access giới hạn owner/editor cần thiết.
- Public repo không chứa sheet ID thật.
- API response log phải redact key/header nhạy cảm.
- Có `SYSTEM_ENABLED` kill switch.
- Có menu disable all triggers.
- Timezone cố định Asia/Tokyo.

---

## 23. Implementation phases

### Phase 0 — Repository bootstrap

- [x] README.
- [x] Build plan.
- [ ] `.gitignore`.
- [ ] `.clasp.example.json`.
- [ ] Apps Script skeleton.
- [ ] Test runner skeleton.

**Exit:** repo có thể clone và chạy test placeholder.

### Phase 1 — Sheet foundation

- [ ] Tạo sheet schema.
- [ ] Header validation.
- [ ] Config parser.
- [ ] Script Properties validation.
- [ ] Menu.
- [ ] Locking.
- [ ] API audit log.

**Exit:** một lệnh setup tạo đủ sheets, headers, validation và format.

### Phase 2 — Wallet discovery/scoring

- [ ] Nansen client.
- [ ] Discovery job.
- [ ] Inbox upsert/dedupe.
- [ ] Priority score.
- [ ] PnL fetch.
- [ ] Wallet gate/score.
- [ ] Credit guard.

**Exit:** tạo được provisional pool và verified candidates có audit.

### Phase 3 — Entity resolution

- [ ] Dune labels query.
- [ ] Auto exclusion.
- [ ] Cluster key.
- [ ] Arkham manual review queue.
- [ ] Cohort builder.

**Exit:** nhiều addresses cùng owner chỉ tạo một cluster.

### Phase 4 — Trade import/attribution

- [ ] Incremental Dune query.
- [ ] Aggregator query.
- [ ] Raw import idempotency.
- [ ] Taker-first attribution.
- [ ] EOA tx_from fallback.
- [ ] Contract/AA review path.
- [ ] Transfer fallback query.
- [ ] Attribution audit metrics.

**Exit:** đạt attribution acceptance trên golden set.

### Phase 5 — Normalization/aggregation

- [ ] Base asset registry.
- [ ] Multi-hop normalization.
- [ ] Direct buy/sell.
- [ ] Rotation events.
- [ ] Entity netting.
- [ ] Token aggregates 24h/72h.

**Exit:** fixtures cho ra đúng economic events và không double-count.

### Phase 6 — Candidate engine

- [ ] Gate.
- [ ] Fail reasons.
- [ ] Candidate score.
- [ ] Strong eligibility.
- [ ] Single status function.
- [ ] Dashboard/candidate links.
- [ ] Bot-cluster flags.

**Exit:** mọi candidate tái tạo được từ raw data.

### Phase 7 — Shadow operation

- [ ] Tạo triggers.
- [ ] Chạy 14 ngày.
- [ ] Daily validation report.
- [ ] Fix data gaps.
- [ ] Chốt threshold V1.

**Exit:** đạt acceptance thresholds và không vượt credit budget.

---

## 24. Không làm trong V1

- chart breakout/retest;
- TradingView webhook;
- exchange API;
- auto order;
- portfolio/risk engine;
- PostgreSQL;
- Redis;
- real-time mempool;
- ML model;
- Solana;
- historical profitability backtest đầy đủ;
- Nansen premium-label scan diện rộng.

Các phần này chỉ bắt đầu sau khi Token Candidate data quality đã được chứng minh.

---

## 25. Các quyết định cần giữ cố định trong lúc build

Để tránh scope creep, V1 mặc định:

```text
EVM only
Google Sheets + Apps Script
Dune polling 4 lần/ngày
Arkham manual review
Nansen daily budget guard
Provisional + verified cohort
Taker-first attribution
Entity-first aggregation
Gate → Score → Status
No trading
```

Thay đổi một trong các quyết định trên phải cập nhật tài liệu này trước khi sửa code.

---

## 26. Kết quả mong đợi sau V1

Một candidate hợp lệ phải hiển thị dạng:

```text
Token: ABC
Chain: Base
Status: CANDIDATE

Verified buy entities: 2
Provisional buy entities: 3
Effective entities: 3.4
Quality-adjusted net buy 24h: +$67,000
Raw net buy 24h: +$121,000
Median verified wallet score: 72
Largest weighted entity share: 34%
High-confidence attribution share: 88%
Gate: PASS
Candidate score: 73
```

Người vận hành phải có thể mở:

- các entity đóng góp;
- các wallet tương ứng;
- transaction hashes;
- attribution methods;
- PnL snapshot;
- gate/score breakdown.

Đây là tiêu chuẩn tối thiểu để cột token candidate đáng tin cậy và có thể tiếp tục sang phase kiểm tra thanh khoản/chart ở phiên bản sau.
