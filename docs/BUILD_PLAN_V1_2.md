# BigBoy V1.2 — Nansen Wallet Discovery & Scoring

> Mục tiêu duy nhất: thay danh sách wallet nhập tay nhỏ của V1.1 bằng một pipeline có thể tự tìm, ưu tiên và chấm chất lượng wallet từ Nansen.
>
> Vẫn dùng Google Sheets + Apps Script. Chưa làm PostgreSQL, dashboard riêng, entity clustering sâu, aggregator attribution hoặc candidate score hoàn chỉnh.

---

## 1. Kết quả cần nhìn thấy

Sau khi chạy:

```text
BigBoy > Run Nansen Discovery
BigBoy > Score Priority Wallets
BigBoy > Rebuild Wallet Cohort
BigBoy > Run Full Refresh
```

Google Sheets phải hiển thị được:

- wallet mới Nansen phát hiện;
- wallet nào đang chờ chấm;
- PnL 90D/180D và các metric chất lượng;
- lý do wallet pass/fail;
- cohort `PROVISIONAL` và `VERIFIED`;
- số Nansen credit đã dùng;
- token result của V1.1 có thêm số verified/provisional buyers.

V1.2 không khẳng định mọi wallet được Nansen gắn Smart Money đều tốt. Nansen chỉ là nguồn discovery và dữ liệu đánh giá; quyết định giữ wallet phải đi qua wallet gate của BigBoy.

---

## 2. Điều kiện đầu vào

V1.2 chỉ bắt đầu khi V1.1 đã đạt:

- direct DEX trades import được vào `03_TRADES_RAW`;
- re-run không duplicate;
- entity netting thủ công hoạt động;
- `04_TOKEN_RESULTS` truy ngược được tới wallet và transaction;
- Dune/App Script chạy ổn với 10–30 wallets.

Không sửa logic attribution của V1.1 trong phiên bản này. Nếu direct-taker bỏ sót trade, ghi limitation và để V1.4 xử lý.

---

## 3. Phạm vi V1.2

### 3.1 Làm trong phiên bản này

```text
Nansen discovery
→ WALLET_INBOX
→ priority queue
→ Nansen wallet metrics
→ wallet gate + wallet score
→ PROVISIONAL / VERIFIED cohort
→ đồng bộ tracked wallets
→ chạy lại pipeline Dune của V1.1
```

### 3.2 Chưa làm

- Dune/Arkham entity resolution;
- gom nhiều wallet cùng một chủ tự động;
- market maker detection đầy đủ;
- aggregator trades;
- Safe/AA/contract-wallet fallback;
- multi-hop normalization nâng cao;
- token candidate score 0–100;
- `STRONG`;
- dashboard;
- Telegram;
- PostgreSQL;
- historical backtest.

---

## 4. Nguyên tắc thiết kế

### 4.1 Hai lớp wallet

#### `PROVISIONAL`

Wallet vừa được discovery hoặc chưa đủ dữ liệu để xác minh.

- giúp tăng độ phủ;
- được track giao dịch;
- không được tự tạo `CANDIDATE`;
- mặc định quality weight thấp;
- phải có ngày review tiếp theo.

#### `VERIFIED`

Wallet đã qua wallet gate.

- PnL dương ở cả 90D và 180D;
- có nhiều token thắng;
- không phụ thuộc một winner duy nhất;
- đủ hoạt động gần đây;
- wallet score đạt ngưỡng.

V1.2 chưa biết chắc hai wallet có cùng chủ hay không. Tạm dùng:

```text
cluster_key = WALLET:<lowercase_address>
```

V1.3 sẽ sửa independence/entity.

### 4.2 Không dùng FIFO đơn giản

Nansen credit phải ưu tiên wallet có khả năng ảnh hưởng trực tiếp đến token result:

```text
wallet đang cùng mua token với verified wallets
→ wallet xuất hiện nhiều lần
→ wallet có discovery volume lớn
→ wallet chưa từng chấm
→ wallet cũ cần review
```

### 4.3 Không đoán field API

Trước khi code mapping:

1. gọi endpoint bằng request nhỏ;
2. lưu response mẫu đã redact;
3. xác nhận field và kiểu dữ liệu;
4. viết contract mapping;
5. thiếu metric bắt buộc thì chuyển `WAIT_DATA`, không tự gán 0.

---

## 5. Google Sheets thay đổi

Giữ nguyên sáu sheet của V1.1. Thêm ba sheet mới và mở rộng một số cột.

### 5.1 `06_WALLET_INBOX`

| column | ý nghĩa |
|---|---|
| `wallet_key` | `chain:lowercase_address` |
| `chain` | chain |
| `wallet_address` | address |
| `first_seen_at` | lần đầu discovery |
| `last_seen_at` | lần gần nhất |
| `discovery_count` | số lần xuất hiện |
| `discovery_trade_count` | số trade discovery |
| `discovery_volume_usd` | volume discovery |
| `nansen_labels` | label trả về |
| `latest_source_token` | token gần nhất |
| `latest_source_tx` | tx gần nhất nếu có |
| `priority_score` | điểm ưu tiên chấm |
| `queue_status` | trạng thái hàng đợi |
| `next_action` | hành động tiếp theo |
| `last_error` | lỗi gần nhất |

`queue_status`:

```text
NEW
PROVISIONAL
WAIT_SCORE
WAIT_DATA
VERIFIED
REJECTED
STALE
```

Upsert theo `wallet_key`. Discovery lặp lại chỉ tăng count/volume và cập nhật thời gian, không tạo row mới.

### 5.2 `07_WALLET_METRICS`

| column | ý nghĩa |
|---|---|
| `wallet_key` | khóa wallet |
| `pnl_90d_realized` | realized PnL 90D |
| `pnl_180d_realized` | realized PnL 180D |
| `win_rate_90d` | win rate ngắn hạn |
| `traded_tokens_180d` | số token đã trade |
| `profitable_tokens_180d` | số token có lời |
| `largest_winner_usd` | winner lớn nhất |
| `largest_winner_share` | tỷ trọng winner lớn nhất |
| `recent_activity_at` | hoạt động gần nhất |
| `label_90d_match` | có label ngắn hạn phù hợp |
| `label_180d_match` | có label dài hạn phù hợp |
| `wallet_score` | ranking 0–100 |
| `wallet_gate_pass` | TRUE/FALSE |
| `wallet_gate_reasons` | lý do pass/fail |
| `scored_at` | thời gian chấm |
| `next_review_at` | lần chấm lại |
| `source_snapshot_key` | khóa response snapshot/log |

Không sửa tay các metric lấy từ API. Manual note đặt ở `06_WALLET_INBOX` hoặc `02_WALLETS`.

### 5.3 `08_WALLET_COHORT`

Đây là sheet được rebuild, không nhập tay.

| column | ý nghĩa |
|---|---|
| `wallet_key` | khóa |
| `chain` | chain |
| `wallet_address` | address |
| `cohort_type` | PROVISIONAL/VERIFIED |
| `cluster_key` | tạm thời theo address |
| `wallet_score` | score |
| `wallet_quality_weight` | weight |
| `active` | có đưa sang Dune tracking |
| `last_seen_at` | lần thấy cuối |
| `next_review_at` | review |
| `source` | NANSEN/MANUAL |
| `cohort_reason` | lý do |

Weight mặc định:

```text
PROVISIONAL = 0.40
VERIFIED = wallet_score / 100
```

Weight chỉ dùng để hiển thị và chuẩn bị cho V1.5. V1.2 chưa dùng weighted net-buy để tạo score token.

### 5.4 Mở rộng `02_WALLETS`

`02_WALLETS` tiếp tục là danh sách operational mà Dune query đọc. Thêm:

```text
wallet_key
cohort_type
wallet_score
managed_by
last_synced_at
```

`managed_by`:

```text
MANUAL
NANSEN_AUTO
```

Quy tắc đồng bộ:

- không xóa row `MANUAL`;
- upsert row `NANSEN_AUTO` từ `08_WALLET_COHORT`;
- wallet `REJECTED/STALE` chuyển `active = FALSE`, không xóa lịch sử;
- giữ `entity_key = WALLET:<address>` cho đến V1.3.

### 5.5 Mở rộng `04_TOKEN_RESULTS`

Thêm:

```text
verified_buy_entities_24h
provisional_buy_entities_24h
median_verified_wallet_score
wallet_quality_note
```

V1.2 status tạm thời:

- `CANDIDATE`: đạt rule V1.1 và có ít nhất 2 verified buyers;
- `WATCH`: net buy dương nhưng chưa đủ verified buyers;
- `OBSERVED`: còn lại.

Đây chưa phải final gate/score. V1.5 sẽ thay thế.

### 5.6 Mở rộng `05_RUN_LOG`

Thêm optional columns:

```text
provider
credits_used
requests_made
budget_remaining
```

Chưa cần API audit từng call; chỉ cần đủ kiểm soát credit theo run.

---

## 6. Config mới

Thêm vào `01_CONFIG`:

| key | default | ý nghĩa |
|---|---:|---|
| `NANSEN_ENABLED` | FALSE | chỉ bật sau contract test |
| `NANSEN_DAILY_BUDGET` | 9 | local safety cap |
| `NANSEN_DISCOVERY_LIMIT` | 100 | giới hạn rows/page |
| `MIN_DISCOVERY_TRADE_USD` | 10000 | lọc discovery |
| `MAX_WALLETS_SCORE_PER_RUN` | 2 | tránh cháy credit |
| `MIN_WALLET_SCORE` | 65 | verified threshold |
| `PROVISIONAL_QUALITY_WEIGHT` | 0.40 | weight tạm |
| `MIN_TRADED_TOKENS_180D` | 8 | breadth |
| `MIN_PROFITABLE_TOKENS_180D` | 5 | breadth thắng |
| `MAX_LARGEST_WINNER_SHARE` | 0.50 | chống one-hit wonder |
| `WALLET_REVIEW_DAYS` | 30 | chấm lại |
| `MAX_TRACKED_WALLETS` | 300 | guard cho Sheets/Dune |

Nansen API key chỉ lưu trong Script Properties:

```text
NANSEN_API_KEY
```

Không log API key, Authorization header hoặc full request chứa secret.

---

## 7. Nansen discovery

### 7.1 Input mong muốn

- chain đang hỗ trợ;
- Smart Money/DEX activity phù hợp;
- lookback ngắn để tìm wallet đang hoạt động;
- min trade USD;
- pagination bị giới hạn.

Không hard-code tên endpoint/field trước contract test với API thật.

### 7.2 Flow

```text
check NANSEN_ENABLED
→ check local budget
→ call discovery
→ validate schema
→ normalize chain/address
→ remove invalid/system-looking rows obvious
→ upsert 06_WALLET_INBOX
→ recalculate priority
→ log usage
```

V1.2 chỉ auto-reject các address kỹ thuật hiển nhiên do response xác định chắc chắn. Phân loại CEX/router/bridge/MM hoàn chỉnh để V1.3.

### 7.3 Priority score

Công thức ban đầu:

```text
priority_score =
shared_token_with_verified_count × 25
+ cooccurrence_with_verified_count × 15
+ min(discovery_count, 10) × 3
+ has_90d_label × 10
+ has_180d_label × 15
+ log10(discovery_volume_usd + 1) × 5
- recently_scored_penalty
```

Nếu chưa có verified wallet, ưu tiên:

```text
discovery_count
→ discovery_volume_usd
→ activity recency
```

Priority chỉ là thứ tự sử dụng credit, không phải wallet quality score.

---

## 8. Wallet gate và score

### 8.1 Hard gate mặc định

```text
pnl_90d_realized > 0
pnl_180d_realized > 0
traded_tokens_180d >= 8
profitable_tokens_180d >= 5
largest_winner_share <= 0.50
wallet_score >= 65
```

Missing metric bắt buộc:

```text
wallet_gate_pass = FALSE
queue_status = WAIT_DATA
```

Không biến missing thành 0 rồi gọi là thua.

### 8.2 Wallet score 0–100

| component | max |
|---|---:|
| PnL consistency 90D/180D | 25 |
| Win rate | 15 |
| Profitable-token breadth | 20 |
| Winner concentration | 20 |
| Recent activity | 10 |
| 90D/180D label overlap | 10 |
| **Total** | **100** |

Mỗi component phải clamp về range. Một PnL cực lớn không được bù việc chỉ thắng đúng một memecoin.

### 8.3 Review policy

- `VERIFIED`: review sau 30 ngày hoặc khi activity giảm mạnh;
- `PROVISIONAL`: ưu tiên lại khi cùng xuất hiện ở token đang được verified wallets mua;
- `REJECTED`: không gọi lại thường xuyên; chỉ review khi có dữ liệu mới rõ;
- `STALE`: inactive vượt thời gian config, ngừng track nhưng giữ lịch sử.

---

## 9. Credit guard

Trước mỗi call:

```text
estimated_or_observed_usage_today + planned_call_cost
<= NANSEN_DAILY_BUDGET
```

Quy tắc:

- đọc usage thực tế từ response metadata/header nếu có;
- cost chưa biết thì dùng estimate bảo thủ;
- 4xx không retry;
- 429 retry tối đa một lần theo `Retry-After`;
- 5xx retry tối đa một lần;
- hết budget thì kết thúc clean với `SKIPPED_BUDGET`;
- pagination phải có hard limit.

Trial credits ưu tiên:

1. contract test;
2. batch scoring wallet priority cao;
3. không polling discovery nhiều lần/ngày.

---

## 10. Apps Script thay đổi

Thêm:

```text
src/apps-script/
├── NansenClient.gs
├── WalletDiscovery.gs
├── WalletScoring.gs
├── WalletCohort.gs
└── CreditGuard.gs
```

Menu mở rộng:

```text
BigBoy
├── Run Nansen Discovery
├── Score Priority Wallets
├── Rebuild Wallet Cohort
├── Sync Cohort to Tracked Wallets
└── Run Wallet Pipeline
```

Sau manual acceptance có thể tạo **một trigger hằng ngày** cho wallet pipeline. Chưa tạo trigger dày hoặc notification.

Mọi job dùng `LockService` để tránh chạy chồng.

---

## 11. Các bước build

### Step 1 — Contract test Nansen

- [ ] Xác nhận endpoint discovery.
- [ ] Xác nhận endpoint/response wallet PnL.
- [ ] Kiểm tra metric nào có sẵn cho 90D/180D.
- [ ] Ghi response fixture đã redact.
- [ ] Ghi cost quan sát được.
- [ ] Không code score trước khi mapping chắc chắn.

**Exit:** có contract mapping và fixture thật.

### Step 2 — Sheet migration

- [ ] Tạo 3 sheet mới.
- [ ] Mở rộng headers V1.1.
- [ ] Migration idempotent.
- [ ] Không xóa data V1.1.
- [ ] Schema version được ghi trong `00_README`.

**Exit:** Sheet cũ nâng cấp an toàn.

### Step 3 — Discovery và inbox

- [ ] Nansen client.
- [ ] Budget guard.
- [ ] Discovery request.
- [ ] Address normalization.
- [ ] Inbox upsert/dedupe.
- [ ] Priority score.
- [ ] Run log.

**Exit:** discovery lặp lại không tạo duplicate wallet.

### Step 4 — Wallet scoring

- [ ] Chọn top priority.
- [ ] Fetch metrics.
- [ ] Validate missing/outlier.
- [ ] Tính components.
- [ ] Gate reasons.
- [ ] Review date.
- [ ] Không vượt max wallets/run.

**Exit:** có wallet pass/fail giải thích được.

### Step 5 — Cohort và Dune sync

- [ ] Build provisional/verified.
- [ ] Sync `NANSEN_AUTO` rows.
- [ ] Không đụng manual rows.
- [ ] Apply max tracked-wallet guard.
- [ ] Chạy lại import V1.1.

**Exit:** Dune scan dùng cohort rộng hơn.

### Step 6 — Token result quality columns

- [ ] Map wallet cohort vào raw trades.
- [ ] Tính verified/provisional buyers.
- [ ] Update status tạm thời.
- [ ] Truy ngược token → wallet metrics.

**Exit:** token results cho biết chất lượng buyer, không chỉ số lượng.

### Step 7 — Acceptance

- [ ] Kiểm tra tối thiểu 20 discovery wallets.
- [ ] Chấm thủ công 5 wallet qua Nansen UI để đối chiếu.
- [ ] Re-run discovery/scoring không duplicate.
- [ ] Hết budget tạo `SKIPPED_BUDGET`, không lỗi nửa chừng.
- [ ] Manual wallets không bị overwrite.
- [ ] Direct Dune results của V1.1 vẫn đúng.

**Exit:** đạt Definition of Done.

---

## 12. Definition of Done

- [ ] Nansen discovery tự upsert wallet vào `06_WALLET_INBOX`.
- [ ] Priority queue không dùng FIFO đơn giản.
- [ ] Wallet metrics 90D/180D được lưu và validate.
- [ ] Wallet gate trả lý do rõ.
- [ ] Wallet score có component breakdown và clamp.
- [ ] Có `PROVISIONAL` và `VERIFIED`.
- [ ] Cohort sync sang `02_WALLETS` không phá manual rows.
- [ ] Daily budget không bị vượt.
- [ ] `04_TOKEN_RESULTS` hiển thị verified/provisional buyers.
- [ ] Re-run không duplicate wallet, metrics hoặc tracked rows.
- [ ] Ít nhất 5 wallet được đối chiếu thủ công.
- [ ] Không thêm entity automation, attribution nâng cao, dashboard hay database.

---

## 13. Điều kiện chuyển sang V1.3

Chỉ chuyển khi:

- đã có cohort đủ rộng để xuất hiện trường hợp nhiều wallet có thể cùng chủ;
- verified wallet score tái tạo được từ metrics;
- Nansen cost/run đã đo được;
- token results cho thấy entity independence là bottleneck thật;
- danh sách system/MM suspects đã xuất hiện đủ để kiểm thử.

V1.3 sẽ xử lý `cluster_key`, loại ví hệ thống và market-maker suspicion. Nó không sửa aggregator/contract-wallet attribution; phần đó thuộc V1.4.
