# BigBoy V1.3 — Entity Mapping & System/MM Filtering

> Mục tiêu duy nhất: biến danh sách wallet của V1.2 thành danh sách **entity độc lập đáng tin hơn**, không đếm nhiều address cùng một chủ thành nhiều whale và không để ví hệ thống/market maker làm sai tín hiệu.
>
> Vẫn dùng Google Sheets + Apps Script + Dune. Arkham chỉ dùng Web UI để review thủ công. Chưa làm aggregator, Safe/AA, transfer fallback, dashboard hoặc PostgreSQL.

---

## 1. Kết quả cần nhìn thấy

Sau V1.3, từ một token result người dùng phải thấy:

- có bao nhiêu wallet tham gia;
- các wallet đó được gom thành bao nhiêu entity;
- entity nào `VERIFIED`, `UNKNOWN` hoặc `EXCLUDED`;
- wallet nào bị loại vì CEX/router/bridge/custodian/protocol;
- wallet nào bị gắn `MARKET_MAKER_SUSPECTED`;
- nguồn nào tạo ra entity mapping;
- manual review nào còn mở.

Ví dụ:

```text
Token ABC
wallet buyers: 6
independent entities: 3
verified entities: 2
unknown entities: 1
excluded wallets: 2
largest entity share: 41%
```

V1.3 vẫn chưa gọi đây là final candidate gate. V1.5 mới quyết định đầy đủ.

---

## 2. Điều kiện đầu vào

V1.3 chỉ bắt đầu khi V1.2 đã đạt:

- Nansen discovery và scoring chạy ổn;
- có `PROVISIONAL` và `VERIFIED`;
- cohort sync sang tracked wallets không duplicate;
- có wallet score và gate reasons;
- đã xuất hiện trường hợp nghi ngờ cùng owner hoặc ví hệ thống/MM.

V1.3 không thay đổi wallet quality score của V1.2. Nó bổ sung **entity quality và independence**.

---

## 3. Phạm vi V1.3

### 3.1 Làm trong phiên bản này

```text
wallet cohort
→ Dune labels/owner
→ auto exclusion
→ manual Arkham review
→ cluster_key
→ independence weight
→ entity-first netting
→ token results theo entity
```

### 3.2 Chưa làm

- aggregator intent;
- Safe/AA/contract-wallet attribution;
- `tx_from` fallback;
- token transfer fallback;
- multi-hop economic-event normalization đầy đủ;
- final candidate score;
- `STRONG`;
- dashboard;
- PostgreSQL;
- auto trading.

---

## 4. Khái niệm bắt buộc

### 4.1 Wallet khác entity

```text
wallet = một address
entity = một chủ/đơn vị kinh tế có thể điều khiển một hoặc nhiều wallet
```

Nếu 5 address cùng một quỹ mua token, phải tính là **1 entity**, không phải 5 whale.

### 4.2 Independence không phải nhị phân hoàn toàn

Mỗi entity có:

```text
independence_weight
```

Default:

| trạng thái | weight |
|---|---:|
| confirmed independent private entity | 1.00 |
| owner khá chắc nhưng chưa manual confirm | 0.80 |
| unknown wallet/entity | 0.50 |
| suspected shared control/bot cluster | 0.25 |
| excluded system wallet | 0.00 |

Weight chuẩn bị cho V1.5. V1.3 vẫn hiển thị cả raw entity count và effective entity count.

### 4.3 Exclusion và suspicion khác nhau

- `excluded = TRUE`: không được tính vào token result.
- `MARKET_MAKER_SUSPECTED`: chưa auto exclude chỉ vì heuristic.
- `NEEDS_REVIEW`: vẫn giữ dữ liệu nhưng không được nâng token lên mức cao hơn `WATCH`.
- `AMBIGUOUS`: không coi là independent verified entity.

---

## 5. Nguồn dữ liệu

### 5.1 Dune labels

Dùng một query cho toàn bộ active wallet cohort.

Input:

```text
wallet list
chains
```

Output tối thiểu:

```text
chain
wallet_address
label
category
owner
source
```

Mục đích:

- nhận dạng CEX/router/bridge/protocol/custodian;
- lấy owner để tạo cluster ban đầu;
- giảm số wallet phải mở Arkham thủ công.

### 5.2 Arkham Web UI

Không dùng Arkham API trong V1.3.

Chỉ mở Arkham cho:

- wallet score cao nhưng Dune owner trống;
- nhiều wallet có funding/behavior giống nhau;
- nghi ngờ market maker;
- fund/VC/DAO/OTC cần quyết định giữ hay review;
- token result quan trọng nhưng independence confidence thấp.

Manual conclusion phải có source URL và note. Không chấp nhận đổi cluster chỉ dựa vào cảm giác.

### 5.3 Manual override

Manual override có precedence cao nhưng phải lưu:

```text
old value
new value
reason
source_url
reviewed_by
reviewed_at
```

Không sửa trực tiếp dữ liệu Dune raw.

---

## 6. Google Sheets thay đổi

Giữ nguyên sheet V1.1–V1.2. Thêm hai sheet.

### 6.1 `09_ENTITY_MAP`

| column | ý nghĩa |
|---|---|
| `wallet_key` | khóa wallet |
| `chain` | chain |
| `wallet_address` | address |
| `dune_label` | label |
| `dune_category` | category |
| `dune_owner` | owner |
| `arkham_entity_name` | tên entity manual |
| `arkham_entity_id` | ID/link identifier nếu có |
| `entity_type` | loại entity |
| `cluster_key` | khóa gom |
| `cluster_source` | nguồn quyết định |
| `independence_weight` | 0–1 |
| `excluded` | TRUE/FALSE |
| `exclusion_reason` | lý do |
| `verification_status` | trạng thái |
| `market_maker_score` | heuristic score |
| `checked_at` | thời gian |
| `review_due_at` | review lại |
| `notes` | ghi chú |
| `source_url` | Dune/Arkham/explorer |

`verification_status`:

```text
AUTO_CONFIRMED
MANUAL_CONFIRMED
NEEDS_REVIEW
AMBIGUOUS
```

`entity_type` gợi ý:

```text
PRIVATE_TRADER
FUND
VC
DAO_TREASURY
OTC_DESK
MARKET_MAKER
CEX
DEX_ROUTER
BRIDGE
CUSTODIAN
PROTOCOL
TOKEN_CONTRACT
BURN
UNKNOWN
```

### 6.2 `10_REVIEW_QUEUE`

| column | ý nghĩa |
|---|---|
| `review_id` | khóa |
| `review_type` | loại review |
| `priority` | HIGH/MEDIUM/LOW |
| `wallet_or_cluster` | target |
| `related_token` | token liên quan nếu có |
| `description` | vấn đề |
| `recommended_action` | gợi ý |
| `source_links` | link |
| `status` | OPEN/IN_PROGRESS/RESOLVED/IGNORED |
| `reviewed_by` | người review |
| `reviewed_at` | thời gian |
| `resolution` | kết luận |

`review_type`:

```text
ENTITY_UNKNOWN
OWNER_CONFLICT
MARKET_MAKER_SUSPECTED
SYSTEM_WALLET_UNCERTAIN
SHARED_FUNDER_SUSPECTED
BOT_CLUSTER_SUSPECTED
MANUAL_OVERRIDE_DUE
```

### 6.3 Mở rộng `08_WALLET_COHORT`

Thay `cluster_key = WALLET:<address>` tạm thời bằng mapping từ `09_ENTITY_MAP`.

Thêm:

```text
entity_type
entity_verification_status
independence_weight
excluded
exclusion_reason
combined_wallet_weight
```

Formula chuẩn bị:

```text
combined_wallet_weight =
wallet_quality_weight × independence_weight
```

Excluded wallet:

```text
active = FALSE
combined_wallet_weight = 0
```

### 6.4 Mở rộng `03_TRADES_RAW`

Không thay raw event key. Chỉ thêm snapshot fields khi rebuild/mapping:

```text
matched_cluster_key
entity_type
entity_excluded
```

Source-of-truth của entity vẫn là `09_ENTITY_MAP`; raw sheet không được sửa lịch sử để che mapping cũ. Khi cần, rebuild derived columns từ mapping hiện tại.

### 6.5 Mở rộng `04_TOKEN_RESULTS`

Thêm:

```text
raw_buy_wallets_24h
independent_buy_entities_24h
effective_entities_24h
verified_buy_entities_24h
unknown_buy_entities_24h
excluded_wallet_count_24h
largest_entity_share_24h
entity_quality_note
review_required
```

Token aggregate phải net theo cluster trước rồi mới count entity.

---

## 7. Cluster key precedence

Dùng thứ tự:

```text
1. MANUAL:<stable_id>
2. ARKHAM:<entity_id>
3. DUNE_OWNER:<normalized_owner>
4. SHARED_SIGNER:<address>       (chỉ khi có bằng chứng chắc)
5. PRIVATE_FUNDER:<address>      (chỉ khi funder không phải service/CEX)
6. WALLET:<address>
```

### Quy tắc an toàn

- không dùng exchange hot wallet làm shared funder để gom entity;
- không gom chỉ vì cùng dùng một bridge/router;
- không gom chỉ vì mua cùng token cùng thời điểm;
- owner name phải normalize case/space/punctuation;
- owner conflict giữa nguồn → `NEEDS_REVIEW`;
- manual override không được mất khi refresh Dune.

---

## 8. Auto exclusion

Auto exclude khi nguồn đủ chắc xác định:

```text
CEX hot/cold wallet
DEX/router
bridge
liquidity pool
protocol contract
token contract
burn address
custodian
vesting/distributor
known service wallet
```

`exclusion_reason` phải machine-readable, ví dụ:

```text
SYSTEM_CEX
SYSTEM_ROUTER
SYSTEM_BRIDGE
SYSTEM_PROTOCOL
SYSTEM_CUSTODIAN
SYSTEM_TOKEN_CONTRACT
SYSTEM_BURN
```

Không auto exclude chỉ vì là:

```text
fund
VC
DAO treasury
OTC desk
```

Các loại trên có thể là Smart Money thật nhưng cần hiểu hành vi.

---

## 9. Market maker heuristic

Tính `market_maker_score` từ các dấu hiệu:

| dấu hiệu | ý nghĩa |
|---|---|
| buy/sell hai chiều liên tục | quoting/inventory management |
| turnover rất cao | hoạt động dịch vụ |
| median holding time rất ngắn | không phải directional trader |
| nhiều token nhưng net inventory gần 0 | market making |
| nhiều LP/CEX interactions | liquidity operation |
| label MM/LP | bằng chứng trực tiếp |
| order size lặp đều | automation pattern |

Không auto reject chỉ dựa trên một dấu hiệu.

Policy:

```text
score thấp → giữ
score trung bình → NEEDS_REVIEW
score cao + label/source chắc → excluded hoặc MANUAL_CONFIRMED MARKET_MAKER
```

Threshold ban đầu phải configurable và chỉ chốt sau khi review sample.

---

## 10. Shared-control và bot-cluster suspicion

Tạo review flag nếu:

- nhiều wallet nhận funding từ cùng private address;
- funding gần cùng thời điểm và số tiền gần giống;
- order size lặp giống nhau;
- cùng block/cùng giây mua nhiều lần;
- sequence giao dịch giống nhau;
- các wallet luôn cùng xuất hiện.

Không auto cluster nếu chỉ có synchronized buying. Có thể nhiều independent traders cùng phản ứng với tin tức.

Các metric gợi ý:

```text
same_minute_trade_share
same_block_wallet_count
similar_order_size_score
shared_private_funder_count
behavior_overlap_score
```

V1.3 chỉ tạo flag/review; clustering hành vi tự động sâu để phiên bản sau nếu thật sự cần.

---

## 11. Entity-first aggregation

### 11.1 Net theo cluster

Với mỗi:

```text
cluster_key + token_address + time_window
```

Tính:

```text
entity_buy
entity_sell
entity_net = entity_buy - entity_sell
```

Một entity là buyer khi:

```text
entity_net > 0
AND excluded = FALSE
```

Nếu nhiều wallet cùng cluster mua và bán, phải net chung trước.

### 11.2 Raw và effective counts

```text
independent_buy_entities =
count(entity_net > 0)

effective_entities =
sum(independence_weight for positive-net entities)
```

V1.3 hiển thị cả hai. Không dùng wallet count thay entity count.

### 11.3 Concentration

```text
largest_entity_share =
max(positive entity net)
/
sum(all positive entity net)
```

Nếu một entity tạo phần lớn volume, `review_required = TRUE`.

---

## 12. Config mới

Thêm:

| key | default | ý nghĩa |
|---|---:|---|
| `DUNE_LABELS_ENABLED` | TRUE | bật labels |
| `UNKNOWN_ENTITY_WEIGHT` | 0.50 | entity chưa rõ |
| `AUTO_OWNER_WEIGHT` | 0.80 | Dune owner khá chắc |
| `SUSPECTED_SHARED_CONTROL_WEIGHT` | 0.25 | nghi cùng chủ |
| `MAX_ENTITY_SHARE_REVIEW` | 0.60 | concentration review |
| `MM_REVIEW_SCORE` | 50 | chuyển review |
| `MM_EXCLUDE_SCORE` | 80 | chỉ áp dụng cùng evidence chắc |
| `ENTITY_REVIEW_DAYS` | 30 | review lại |
| `MAX_ARKHAM_MANUAL_REVIEWS_PER_DAY` | 5 | giới hạn công sức |

Script Properties:

```text
DUNE_QUERY_LABELS_ID
```

Arkham không có API key trong V1.3.

---

## 13. Apps Script và SQL

Thêm:

```text
sql/v1_3_wallet_labels.sql
```

Thêm Apps Script:

```text
src/apps-script/
├── EntityService.gs
├── DuneLabelClient.gs
├── EntityReviewQueue.gs
└── MarketMakerHeuristics.gs
```

Menu:

```text
BigBoy
├── Refresh Wallet Labels
├── Rebuild Entity Map
├── Rebuild Wallet Cohort
├── Open Entity Review Queue
└── Rebuild Token Results by Entity
```

---

## 14. Các bước build

### Step 1 — Dune label contract test

- [ ] Chạy query với 20 wallet đa dạng.
- [ ] Có CEX/router/bridge/private/unknown sample.
- [ ] Xác nhận owner/category/label semantics.
- [ ] Lưu fixture.
- [ ] Ghi các category được phép auto exclude.

**Exit:** mapping label có test case thật.

### Step 2 — Entity sheets và migration

- [ ] Tạo `09_ENTITY_MAP`.
- [ ] Tạo `10_REVIEW_QUEUE`.
- [ ] Mở rộng cohort/results.
- [ ] Migration không xóa manual data.
- [ ] Schema version update.

**Exit:** cấu trúc mới sẵn sàng.

### Step 3 — Auto labels và exclusion

- [ ] Batch active wallets.
- [ ] Upsert Dune label/owner.
- [ ] Normalize owner.
- [ ] Auto exclude category chắc chắn.
- [ ] Tạo review khi conflict/unknown.

**Exit:** system wallets phổ biến không còn được tính.

### Step 4 — Manual Arkham workflow

- [ ] Sort review theo impact.
- [ ] Hiển thị source links.
- [ ] Form/menu apply resolution.
- [ ] Lưu reason/operator/time.
- [ ] Manual override survive refresh.

**Exit:** entity khó có quy trình xử lý rõ.

### Step 5 — Cluster và cohort rebuild

- [ ] Apply precedence.
- [ ] Independence weight.
- [ ] Excluded = inactive.
- [ ] Multiple wallets same owner → one cluster.
- [ ] Rebuild `08_WALLET_COHORT`.

**Exit:** cohort có cluster ổn định.

### Step 6 — Market maker heuristics

- [ ] Tính basic buy/sell/turnover/holding indicators từ data hiện có.
- [ ] Apply label evidence.
- [ ] Tạo score và review.
- [ ] Không auto reject từ một heuristic.

**Exit:** MM suspects được tách khỏi directional traders.

### Step 7 — Entity-first token aggregation

- [ ] Map raw trades tới cluster.
- [ ] Net cluster trước.
- [ ] Tính raw/effective entity count.
- [ ] Tính largest entity share.
- [ ] Excluded wallets không góp volume/count.
- [ ] Token có unresolved high-impact entity tối đa `WATCH`.

**Exit:** kết quả không còn double-count chủ ví.

### Step 8 — Acceptance

- [ ] Ít nhất 5 case nhiều wallet cùng owner.
- [ ] Ít nhất 5 system wallets.
- [ ] Ít nhất 3 MM suspects.
- [ ] Ít nhất 5 unknown/private wallets.
- [ ] Manual override không mất sau refresh.
- [ ] Rebuild lặp lại cho kết quả giống nhau.

**Exit:** đạt Definition of Done.

---

## 15. Definition of Done

- [ ] Dune labels batch được toàn cohort.
- [ ] System wallets phổ biến bị loại với reason rõ.
- [ ] Nhiều wallet cùng owner chỉ tạo một `cluster_key`.
- [ ] Unknown entity có weight bảo thủ.
- [ ] Manual Arkham review có source và history.
- [ ] Market maker suspicion không dựa vào một heuristic.
- [ ] Entity-first netting chạy trước token count.
- [ ] `04_TOKEN_RESULTS` hiển thị wallet count, entity count và effective count.
- [ ] High-impact unresolved entity không tạo candidate mạnh.
- [ ] Re-run không duplicate mapping/review.
- [ ] Không thêm attribution V1.4, dashboard hoặc database.

---

## 16. Điều kiện chuyển sang V1.4

Chỉ chuyển khi:

- false entity double-count bằng 0 trong validation sample;
- system wallet exclusion ổn;
- cluster key tái tạo được;
- unresolved entity share được đo;
- đã xác định các trade bị bỏ sót do aggregator/Safe/AA/direct-taker limitation;
- có danh sách transaction thật cho direct, aggregator, contract wallet và multi-hop.

V1.4 sẽ tập trung vào **ai thực sự thực hiện economic trade trong transaction** và gom nhiều pool legs thành một buy/sell. Nó không thay đổi wallet score hoặc entity rules trừ bug rõ ràng.
