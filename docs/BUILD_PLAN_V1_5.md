# BigBoy V1.5 — Candidate Gate, Score, Audit & Validation

> Mục tiêu duy nhất: biến dữ liệu wallet/entity/attribution đã được kiểm tra ở V1.2–V1.4 thành một candidate engine có quy tắc duy nhất, tái tạo được và đủ audit để chạy shadow.
>
> Vẫn dùng Google Sheets + Apps Script. Không PostgreSQL, dashboard web, chart confirmation hoặc auto trading.

---

## 1. Kết quả cần nhìn thấy

Sau V1.5, `TOKEN_CANDIDATES` phải hiển thị:

```text
Token: ABC
Chain: Base
Status: CANDIDATE

Verified buy entities 24h: 2
Provisional buy entities 24h: 3
Effective entities 24h: 3.4
Quality-adjusted net buy 24h: +$67,000
Raw net buy 24h: +$121,000
Median verified wallet score: 72
Largest weighted entity share: 34%
High-confidence attribution share: 88%
Ambiguous volume share: 4%
Gate: PASS
Candidate score: 73
```

Người dùng phải truy ngược được:

```text
candidate
→ token aggregate
→ entity aggregate
→ normalized event
→ attribution
→ raw transaction
→ wallet score
→ entity mapping
```

Output là research list, không phải buy signal.

---

## 2. Điều kiện đầu vào

V1.5 chỉ bắt đầu khi:

- V1.2 wallet score/gate ổn định;
- V1.3 cluster/exclusion không double-count entity;
- V1.4 economic events không duplicate;
- attribution precision/recall đã đo trên golden set;
- raw và adjusted values đều có;
- ambiguous events không được tính;
- có đủ dữ liệu thật để kiểm tra threshold.

Không dùng V1.5 để che lỗi upstream bằng score phức tạp.

---

## 3. Phạm vi V1.5

### 3.1 Làm trong phiên bản này

```text
entity-level aggregates
→ token-level aggregates
→ hard gate
→ candidate score
→ strong eligibility
→ one status function
→ audit chain
→ API/change logs
→ validation report
→ 14-day shadow run
```

### 3.2 Chưa làm

- chart breakout/retest;
- liquidity execution gate hoàn chỉnh;
- TradingView webhook;
- exchange API;
- auto order;
- portfolio/risk engine;
- PostgreSQL;
- Redis;
- real-time mempool;
- ML;
- Solana;
- dashboard web;
- Telegram bắt buộc.

---

## 4. Nguồn chân lý duy nhất

Pipeline bắt buộc:

```text
GATE → SCORE → STATUS
```

### Quy tắc

- Gate chỉ trả `PASS/FAIL` và fail reasons.
- Score chỉ tính khi gate pass.
- Status chỉ được đặt bởi một function duy nhất.
- Không sheet formula, menu hoặc service khác được tự gán `CANDIDATE/STRONG`.
- Threshold chỉ đọc từ config đã validate.
- Mọi candidate phải lưu rule/config version.

---

## 5. Google Sheets thay đổi

### 5.1 `13_TOKEN_AGGREGATES`

Lưu hai tầng aggregate.

#### Entity × token × window

| column | ý nghĩa |
|---|---|
| `aggregate_key` | key |
| `window` | 24H/72H |
| `chain` | chain |
| `token_address` | token |
| `cluster_key` | entity |
| `cohort_type` | verified/provisional |
| `entity_raw_buy` | raw buy |
| `entity_raw_sell` | raw sell |
| `entity_raw_net` | net |
| `entity_adjusted_net` | adjusted net |
| `entity_first_buy` | first |
| `entity_last_buy` | last |
| `entity_attribution_quality` | quality |
| `entity_wallet_score` | conservative score |
| `independence_contribution` | capped contribution |
| `source_event_keys` | links |

#### Token × window

| column | ý nghĩa |
|---|---|
| `token_aggregate_key` | key |
| `effective_entities` | weighted count |
| `verified_buy_entities` | verified count |
| `provisional_buy_entities` | provisional count |
| `sell_entities` | seller count |
| `raw_buy` | raw buy |
| `raw_sell` | raw sell |
| `raw_net` | raw net |
| `quality_adjusted_net_buy` | adjusted net |
| `median_verified_wallet_score` | quality |
| `largest_weighted_entity_share` | concentration |
| `high_conf_attribution_share` | attribution |
| `ambiguous_volume_share` | ambiguity |
| `first_buy_at` | first |
| `last_buy_at` | last |
| `buy_time_spread_minutes` | persistence |
| `same_minute_volume_share` | sync flag |
| `review_required` | review |

`13_TOKEN_AGGREGATES` là derived sheet, rebuild được hoàn toàn.

### 5.2 `14_TOKEN_CANDIDATES`

| column | ý nghĩa |
|---|---|
| `candidate_key` | `chain:token_address` |
| `updated_at` | time |
| `chain` | chain |
| `token_address` | token |
| `token_symbol` | symbol |
| `gate_pass` | TRUE/FALSE |
| `gate_fail_reasons` | reasons |
| `candidate_score` | 0–100/null |
| `candidate_status` | REJECTED/WATCH/CANDIDATE/STRONG |
| `strong_eligible` | TRUE/FALSE |
| `strong_fail_reasons` | reasons |
| `effective_entities_24h` | metric |
| `verified_buy_entities_24h` | metric |
| `provisional_buy_entities_24h` | metric |
| `quality_adjusted_net_buy_24h` | metric |
| `quality_adjusted_net_buy_72h` | metric |
| `raw_net_buy_24h` | metric |
| `median_verified_wallet_score` | metric |
| `largest_weighted_entity_share` | metric |
| `high_conf_attribution_share` | metric |
| `ambiguous_volume_share` | metric |
| `first_buy_at` | time |
| `last_buy_at` | time |
| `dex_url` | link |
| `review_status` | status |
| `rule_version` | version |
| `config_version` | version |
| `source_aggregate_keys` | links |

`04_TOKEN_RESULTS` của V1.1 có thể giữ làm compatibility view hoặc chuyển thành view đơn giản đọc từ `14_TOKEN_CANDIDATES`. Không duy trì hai engine status.

### 5.3 `15_VALIDATION_REPORT`

Một row cho mỗi validation run/check:

```text
validation_id
run_at
validation_type
sample_size
metric_name
actual_value
required_value
pass
details
source_links
rule_version
```

Validation types:

```text
GOLDEN_TX
ENTITY_DEDUP
CANDIDATE_REPRODUCIBILITY
DUPLICATE_CHECK
ATTRIBUTION_QUALITY
BUDGET_CHECK
SHADOW_DAILY
```

### 5.4 `16_API_LOG`

Log từng API call:

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

Không log secret hoặc raw Authorization header.

### 5.5 `17_CHANGE_LOG`

Manual/config override:

```text
change_id
timestamp
operator
target_type
target_key
field
old_value
new_value
reason
source_url
rule_version
```

Raw data không được manual edit. Nếu cần sửa interpretation, dùng override layer và log.

---

## 6. Entity-first aggregation

### 6.1 Net entity trước

Với mỗi token/window:

```text
entity_raw_net =
sum(raw buys) - sum(raw sells)

entity_adjusted_net =
sum(quality-adjusted signed events)
```

Entity buyer:

```text
entity_adjusted_net > 0
```

Nhiều wallet cùng cluster không tăng entity count.

### 6.2 Conservative entity wallet quality

Nếu cluster có nhiều active verified wallets:

```text
entity_wallet_score =
median(active verified wallet scores)
```

Quy tắc:

- không dùng max score làm đại diện;
- provisional wallets không nâng score;
- missing score không tự biến thành verified;
- policy phải có fixture.

### 6.3 Effective entity count

Mỗi entity chỉ góp tối đa independence contribution của chính entity:

```text
effective_entities =
sum(independence_contribution of positive-net entities)
```

Không cộng toàn bộ wallet weights trong cùng cluster.

Ví dụ:

```text
verified A = 1.0
verified B = 1.0
unknown provisional C = 0.5
unknown provisional D = 0.5
total = 3.0
```

### 6.4 Quality-adjusted net buy

```text
quality_adjusted_net_buy =
sum(entity_adjusted_net for positive/negative entities)
```

Adjusted event value đã gồm:

```text
event weight
× wallet quality
× independence
× attribution confidence
```

Raw net vẫn phải dương; adjusted value không được che việc raw flow âm.

### 6.5 Concentration

```text
largest_weighted_entity_share =
max(positive entity adjusted net)
/
sum(all positive entity adjusted net)
```

Denominator bằng 0 → gate fail, không chia ngầm.

---

## 7. Hard gate

Default gate pass khi tất cả đúng:

```text
verified_buy_entities_24h >= 2
effective_entities_24h >= 3.0
quality_adjusted_net_buy_24h >= 40,000 USD
raw_net_buy_24h > 0
median_verified_wallet_score >= 65
largest_weighted_entity_share <= 0.50
high_conf_attribution_share >= 0.70
ambiguous_volume_share <= configured maximum
review_required = FALSE
```

Ngoài ra:

- ít nhất 2 entity high-confidence;
- candidate không chỉ được tạo bởi provisional wallets;
- không có unresolved system/MM/entity conflict;
- denominator của quality metrics đủ lớn;
- token không nằm trong ignore/base-asset registry.

Gate output:

```text
gate_pass
gate_fail_reasons[]
```

Fail reasons machine-readable:

```text
INSUFFICIENT_VERIFIED_ENTITIES
INSUFFICIENT_EFFECTIVE_ENTITIES
LOW_ADJUSTED_NET_BUY
RAW_NET_NOT_POSITIVE
LOW_WALLET_QUALITY
ENTITY_CONCENTRATION_HIGH
ATTRIBUTION_QUALITY_LOW
AMBIGUOUS_SHARE_HIGH
REVIEW_REQUIRED
INSUFFICIENT_DATA
```

---

## 8. Candidate score

Chỉ tính khi gate pass.

| component | max |
|---|---:|
| Effective entities | 25 |
| Quality-adjusted net buy | 25 |
| Verified wallet quality | 20 |
| Attribution/data quality | 15 |
| Buy persistence | 10 |
| Entity diversity | 5 |
| **Total** | **100** |

### 8.1 Clamp

Mỗi component có floor/cap. Ví dụ volume cực lớn không thể bù attribution kém hoặc entity concentration cao.

### 8.2 Explainability

Lưu breakdown:

```text
score_entities
score_net_buy
score_wallet_quality
score_attribution
score_persistence
score_diversity
```

Có thể lưu trong `14_TOKEN_CANDIDATES` hoặc detail sheet/helper table, nhưng phải truy ra được.

### 8.3 Score không phải xác suất

`73` không có nghĩa 73% thắng. Đây chỉ là ranking score trong universe đang track.

---

## 9. Strong eligibility

Ngoài `score >= 80`:

```text
verified_buy_entities_24h >= 3
effective_entities_24h >= 4.0
quality_adjusted_net_buy_72h > 0
high_conf_attribution_share >= 0.80
ambiguous_volume_share <= stricter maximum
review_required = FALSE
```

Strong rules trả:

```text
strong_eligible
strong_fail_reasons[]
```

Không tạo hệ status thứ hai.

---

## 10. Status function duy nhất

```javascript
function getCandidateStatus(gatePass, score, strongEligible) {
  if (!gatePass) return 'REJECTED';
  if (score >= 80 && strongEligible) return 'STRONG';
  if (score >= 65) return 'CANDIDATE';
  return 'WATCH';
}
```

Quy tắc:

- score `null` khi gate fail;
- không có code path khác set status;
- `04_TOKEN_RESULTS` chỉ đọc status;
- manual override status bị cấm; chỉ override input/entity mapping với log;
- unit test kiểm tra toàn bộ boundary.

---

## 11. Bot/synchronized-buy review

Metrics:

```text
buy_time_spread_minutes
same_minute_volume_share
same_block_entity_count
similar_order_size_score
shared_funder_count
```

Review nếu:

- hơn 80% adjusted buy trong 60 giây;
- nhiều entity order size gần giống;
- shared-control suspicion chưa resolve;
- nhiều entity cùng block và behavior giống;
- one entity concentration bị che bởi mapping chưa chắc.

Không auto reject chỉ vì cùng mua nhanh. Nhưng high suspicion:

```text
review_required = TRUE
status tối đa trước final function = gate fail
```

Tức là gate fail với `REVIEW_REQUIRED` cho đến khi resolve.

---

## 12. Config và versioning

Config cần:

| key | default |
|---|---:|
| `MIN_VERIFIED_ENTITIES_GATE` | 2 |
| `MIN_EFFECTIVE_ENTITIES_GATE` | 3.0 |
| `MIN_ADJUSTED_NET_BUY_24H` | 40000 |
| `MIN_MEDIAN_VERIFIED_WALLET_SCORE` | 65 |
| `MAX_WEIGHTED_ENTITY_SHARE` | 0.50 |
| `MIN_HIGH_CONF_ATTR_SHARE` | 0.70 |
| `MAX_AMBIGUOUS_VOLUME_SHARE` | 0.20 |
| `CANDIDATE_SCORE_MIN` | 65 |
| `STRONG_SCORE_MIN` | 80 |
| `STRONG_MIN_VERIFIED_ENTITIES` | 3 |
| `STRONG_MIN_EFFECTIVE_ENTITIES` | 4.0 |
| `STRONG_MIN_HIGH_CONF_ATTR_SHARE` | 0.80 |
| `BOT_SYNC_VOLUME_SHARE_REVIEW` | 0.80 |
| `RULE_VERSION` | v1.5.0 |

Mọi run lưu:

```text
config_version
rule_version
normalization_version
```

Config thiếu key bắt buộc → fail fast. Không dùng default ngầm trong production run.

---

## 13. Audit chain

Từ `14_TOKEN_CANDIDATES`, cung cấp link/filter key đến:

1. token aggregate;
2. entity aggregate;
3. token events;
4. attribution;
5. raw rows;
6. transaction explorer;
7. wallet metrics;
8. entity map;
9. config/rule version.

Audit không cần dashboard. Có thể dùng menu:

```text
BigBoy > Trace Selected Candidate
```

Menu tạo/filter một temporary trace sheet hoặc mở các sheet đúng key.

Candidate không trace được → invalid và gate fail `INSUFFICIENT_DATA`.

---

## 14. API/error audit

### 14.1 API rules

- 400/401/403: không retry, disable related job, log rõ;
- 429: retry tối đa một lần theo `Retry-After`;
- 5xx: exponential backoff, tối đa một lần;
- schema mismatch: fail fast;
- partial response: không commit derived stage;
- budget exceeded: clean skip.

### 14.2 Checkpoints

```text
last_successful_discovery_at
last_successful_scoring_at
last_successful_labels_at
last_successful_trade_import_at
last_successful_attribution_at
last_successful_normalization_at
last_successful_candidate_build_at
```

Không update checkpoint nếu stage chưa commit hoàn chỉnh.

### 14.3 Locking

Mọi scheduled/manual pipeline dùng `LockService`.

Không lấy được lock:

```text
SKIPPED_LOCKED
```

Không retry tức thì.

---

## 15. Idempotency

Keys:

```text
wallet_key = chain:address
raw_event_key = source:chain:tx_hash:evt_index
attribution_key = chain:tx_hash:wallet_key:method
economic_event_key = chain:tx_hash:cluster_key:token:event_type
entity_aggregate_key = window:chain:token:cluster
token_aggregate_key = window:chain:token
candidate_key = chain:token
```

Re-run cùng input:

- không tăng volume;
- không tăng entity count;
- status và score giống nhau;
- audit links không đổi ngoài `updated_at/run_id`.

---

## 16. Testing strategy

### 16.1 Unit tests

Bắt buộc:

- wallet-score boundaries;
- provisional vs verified weight;
- same cluster counted once;
- excluded entity contributes zero;
- raw and adjusted net;
- effective entity cap;
- concentration denominator;
- gate pass/fail reasons;
- score component clamps;
- strong eligibility;
- exactly one status function;
- duplicate import/event;
- ambiguous excluded;
- config validation;
- rule version propagation.

### 16.2 Golden transaction set

Dùng fixtures V1.4 và thêm expected aggregate/candidate outcome.

### 16.3 Golden candidate set

Tạo tối thiểu:

```text
3 PASS candidates
3 gate-fail by entity count
2 gate-fail by concentration
2 gate-fail by attribution
2 gate-fail by ambiguous/review
2 STRONG eligible
2 score 64/65 boundary
2 score 79/80 boundary
```

### 16.4 Reproducibility test

Từ snapshot inputs cố định:

```text
candidate rows
score breakdown
gate reasons
status
```

phải giống 100%.

---

## 17. Shadow validation 14 ngày

Không dùng output để trade trong giai đoạn này.

Mỗi ngày kiểm:

- candidate có đúng entity count;
- duplicate economic events;
- missing trades;
- attribution false positive;
- provisional share;
- entity concentration;
- status tái tạo;
- API budget;
- data freshness;
- review backlog.

Mỗi candidate sample cần manual review:

```text
entity
wallet
transaction
normalized event
gate
score
status
```

Threshold chỉ chỉnh bằng change log và version mới. Không sửa giữa run mà không ghi lại.

---

## 18. Acceptance thresholds

```text
Duplicate economic events: 0
Status reproducibility: 100%
False entity double count: 0 trong validation sample
EOA direct attribution recall: >= 90%
Overall attribution precision: >= 95%
False attribution rate: <= 2%
Candidate with failed gate: 0
Strong without 3 verified entities: 0
API budget overrun: 0
Untraceable candidate: 0
```

Contract/AA recall báo cáo riêng, không trộn với EOA để che lỗi.

Nếu threshold chưa đạt sau 14 ngày, V1.5 chưa hoàn thành.

---

## 19. Apps Script thay đổi

Thêm:

```text
src/apps-script/
├── TokenAggregateService.gs
├── CandidateGate.gs
├── CandidateScore.gs
├── CandidateStatus.gs
├── AuditTrace.gs
├── ValidationService.gs
├── ApiAudit.gs
└── ChangeLog.gs
```

Menu:

```text
BigBoy
├── Rebuild Token Aggregates
├── Rebuild Candidates
├── Trace Selected Candidate
├── Run Validation Report
├── Run Full V1.5 Pipeline
├── Show API/Credit Usage
└── Open Review Queue
```

---

## 20. Các bước build

### Step 1 — Aggregate layer

- [ ] Entity × token 24h/72h.
- [ ] Conservative entity score.
- [ ] Effective entity count.
- [ ] Adjusted/raw net.
- [ ] Concentration.
- [ ] Persistence/sync metrics.
- [ ] Idempotent rebuild.

**Exit:** aggregate snapshot tái tạo được.

### Step 2 — Gate

- [ ] Config validation.
- [ ] All hard conditions.
- [ ] Machine-readable reasons.
- [ ] Insufficient-data handling.
- [ ] Review-required handling.

**Exit:** gate test boundaries pass.

### Step 3 — Candidate score

- [ ] Six components.
- [ ] Clamp each component.
- [ ] Breakdown storage.
- [ ] Score only after gate.
- [ ] Versioning.

**Exit:** score explainable.

### Step 4 — Strong/status

- [ ] Strong eligibility.
- [ ] Single status function.
- [ ] Remove/disable old V1.1 status paths.
- [ ] Compatibility view only.

**Exit:** một nguồn status duy nhất.

### Step 5 — Audit

- [ ] API log.
- [ ] Change log.
- [ ] Trace keys/links.
- [ ] Checkpoints.
- [ ] Candidate invalid if untraceable.

**Exit:** end-to-end audit hoạt động.

### Step 6 — Validation automation

- [ ] Unit fixtures.
- [ ] Golden transactions.
- [ ] Golden candidates.
- [ ] Duplicate/reproducibility checks.
- [ ] Daily validation report.

**Exit:** validation có PASS/FAIL machine-readable.

### Step 7 — Shadow operation

- [ ] Tạo schedule cần thiết.
- [ ] Run 14 ngày.
- [ ] Manual candidate reviews.
- [ ] Log threshold changes.
- [ ] Fix upstream gaps, không score-che lỗi.

**Exit:** đạt acceptance thresholds.

---

## 21. Definition of Done

- [ ] Entity-first and token-level aggregates tồn tại.
- [ ] Gate là nguồn minimum quality duy nhất.
- [ ] Candidate score chỉ chạy sau gate.
- [ ] Strong eligibility tách rõ nhưng không tạo status engine thứ hai.
- [ ] Chỉ một function đặt status.
- [ ] Candidate có rule/config/normalization version.
- [ ] Candidate trace được về raw transaction và wallet/entity evidence.
- [ ] API và manual changes có log.
- [ ] Re-run không thay đổi score/count với input cố định.
- [ ] Golden transaction/candidate tests pass.
- [ ] Shadow 14 ngày đạt acceptance thresholds.
- [ ] Không thêm dashboard web, PostgreSQL, chart hoặc execution.

---

## 22. Sau V1.5

Chỉ sau khi V1.5 ổn định mới cân nhắc:

```text
V1.6:
- vận hành tiện hơn;
- trigger orchestration;
- review workflow;
- Telegram optional;
- dashboard trong Sheets hoặc web nếu thật sự cần.

V1.7:
- PostgreSQL/worker khi Sheets timeout hoặc raw rows quá lớn.

V1.8+:
- liquidity filter;
- breakout/retest;
- paper trading;
- risk management;
- live execution sau validation riêng.
```

Không migrate database chỉ vì kiến trúc trông “chuyên nghiệp hơn”. Chỉ migrate khi có bottleneck đo được.
