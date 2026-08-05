# BigBoy V1.1 — Google Sheets First MVP

> Mục tiêu duy nhất: chạy một pipeline nhỏ từ wallet list đến `TOKEN_RESULTS` trên Google Sheets.
>
> Không database. Không dashboard riêng. Không Nansen automation. Không cố xử lý toàn bộ trường hợp on-chain ngay trong phiên bản này.

---

## 1. Kết quả cần nhìn thấy

Sau khi setup và nhấn menu `BigBoy > Run Full Refresh`, Google Sheets phải hiển thị danh sách dạng:

| updated_at | chain | token | status | buy_entities_24h | buy_wallets_24h | raw_buy_24h | raw_sell_24h | raw_net_24h | raw_net_72h | wallets | dex_url |
|---|---|---|---|---:|---:|---:|---:|---:|---:|---|---|
| 2026-08-05 22:00 | base | ABC | CANDIDATE | 3 | 4 | 62000 | 9000 | 53000 | 81000 | 0x12…, 0x34… | link |

Người dùng phải mở được từng transaction nguồn để tự kiểm tra.

Đây là research list, không phải buy signal.

---

## 2. Câu hỏi V1.1 phải trả lời được

Với một danh sách wallet nhập tay:

1. Trong 24 giờ và 72 giờ gần nhất, các wallet đó đã mua token nào?
2. Có bao nhiêu entity độc lập cùng net-buy token đó?
3. Tổng raw buy, raw sell và raw net buy là bao nhiêu?
4. Wallet và transaction nào tạo ra kết quả?
5. Refresh lại có bị duplicate hoặc tăng volume sai không?

Nếu chưa trả lời ổn định năm câu này thì chưa mở rộng sang Nansen, entity automation hay dashboard.

---

## 3. Phạm vi kỹ thuật

### 3.1 Thành phần dùng trong V1.1

```text
Google Sheets
Google Apps Script
Dune API
Một Dune SQL query
GitHub + clasp
```

### 3.2 Chain

V1.1 chạy **một chain mỗi lần**, mặc định:

```text
base
```

Có thể đổi config sang `ethereum` hoặc `arbitrum` sau khi query được kiểm tra, nhưng không aggregate nhiều chain chung trong V1.1.

### 3.3 Wallet input

Nhập tay khoảng:

```text
10–30 wallets
```

Nguồn wallet có thể lấy thủ công từ Nansen hoặc Arkham Web UI. V1.1 không tự gọi Nansen API.

Mỗi wallet phải có `entity_key` nhập tay. Hai địa chỉ biết là cùng một chủ phải dùng cùng `entity_key` để không bị đếm hai lần.

Ví dụ:

```text
wallet_address: 0xabc...
entity_key: ENTITY_001
```

Nếu chưa biết chủ, dùng chính địa chỉ làm entity tạm:

```text
entity_key: WALLET:0xabc...
```

---

## 4. Những gì cố ý chưa làm

V1.1 không xử lý đầy đủ:

- wallet quality/PnL scoring;
- provisional và verified cohort;
- entity discovery tự động;
- market maker detection;
- Dune labels;
- Arkham API;
- aggregator intent;
- Safe, AA hoặc contract wallet attribution;
- `tx_from` fallback;
- transfer fallback;
- multi-hop normalization phức tạp;
- bot-cluster detection;
- candidate quality score 0–100;
- `STRONG` status;
- trigger tự động;
- Telegram;
- dashboard;
- PostgreSQL;
- historical backtest.

Các giới hạn trên phải được ghi ở sheet `00_README` để người xem không hiểu nhầm độ phủ dữ liệu.

---

## 5. Luồng dữ liệu tối thiểu

```text
01_CONFIG
     ↓
02_WALLETS nhập tay
     ↓
Dune dex.trades direct taker match
     ↓
03_TRADES_RAW
     ↓
net theo entity × token
     ↓
04_TOKEN_RESULTS
     ↓
kiểm tra tx/explorer thủ công
```

V1.1 chỉ nhận giao dịch khi tracked wallet xuất hiện ở field direct taker đáng tin cậy của query đã kiểm tra.

Không dùng `tx_from` để tăng coverage trong V1.1. Chấp nhận bỏ sót aggregator/contract-wallet trades còn hơn gán nhầm và tưởng dữ liệu đã đầy đủ.

---

## 6. Google Sheets schema

Chỉ tạo sáu sheet.

### 6.1 `00_README`

Hiển thị:

- mục tiêu V1.1;
- cách chạy;
- thời gian refresh gần nhất;
- chain hiện tại;
- giới hạn direct-taker-only;
- cảnh báo `NOT A BUY SIGNAL`;
- link đến tài liệu GitHub.

Đây không phải dashboard. Không xây KPI cards hoặc chart.

### 6.2 `01_CONFIG`

| key | default | ghi chú |
|---|---:|---|
| `SYSTEM_ENABLED` | TRUE | Kill switch đơn giản |
| `CHAIN` | base | Một chain mỗi lần |
| `LOOKBACK_HOURS` | 72 | Query raw trades |
| `RESULT_WINDOW_24H` | 24 | Aggregate ngắn hạn |
| `RESULT_WINDOW_72H` | 72 | Aggregate mở rộng |
| `MIN_TRADE_USD` | 5000 | Có thể hạ khi test ít dữ liệu |
| `MIN_CANDIDATE_ENTITIES` | 3 | Ngưỡng CANDIDATE |
| `MIN_WATCH_ENTITIES` | 2 | Ngưỡng WATCH |
| `MIN_CANDIDATE_NET_BUY_USD` | 10000 | Guard tối thiểu, chỉnh sau khi xem dữ liệu thật |
| `TIMEZONE` | Asia/Tokyo | Hiển thị nhất quán |

Apps Script phải fail rõ nếu thiếu config bắt buộc. Không cần config framework phức tạp.

### 6.3 `02_WALLETS`

| column | ý nghĩa |
|---|---|
| `active` | TRUE/FALSE |
| `chain` | base/ethereum/arbitrum |
| `wallet_address` | lowercase address |
| `entity_key` | ID chủ ví nhập tay |
| `wallet_name` | tên dễ nhớ, optional |
| `source` | Nansen/Arkham/manual |
| `source_url` | link kiểm tra |
| `notes` | ghi chú |

Validation tối thiểu:

- address phải bắt đầu bằng `0x` và đủ độ dài EVM;
- không duplicate `chain + wallet_address`;
- `entity_key` không được trống;
- chỉ lấy row `active = TRUE`.

### 6.4 `03_TRADES_RAW`

| column | ý nghĩa |
|---|---|
| `raw_key` | `chain:tx_hash:evt_index:wallet` |
| `imported_at` | thời gian import |
| `block_time` | thời gian giao dịch |
| `chain` | chain |
| `tx_hash` | transaction hash |
| `evt_index` | event index |
| `wallet_address` | tracked taker |
| `entity_key` | entity map từ `02_WALLETS` |
| `token_bought_address` | token nhận |
| `token_bought_symbol` | symbol hiển thị |
| `token_sold_address` | token bán |
| `token_sold_symbol` | symbol hiển thị |
| `amount_usd` | Dune USD amount |
| `project` | DEX project |
| `tx_url` | explorer link |

Quy tắc:

- append/upsert theo `raw_key`;
- re-run không tạo duplicate;
- không sửa tay raw rows;
- row thiếu tx hash, taker, token address hoặc amount USD hợp lệ thì bỏ qua và ghi lỗi vào run log.

### 6.5 `04_TOKEN_RESULTS`

| column | ý nghĩa |
|---|---|
| `result_key` | `chain:token_address` |
| `updated_at` | thời gian rebuild |
| `chain` | chain |
| `token_address` | contract |
| `token_symbol` | symbol |
| `status` | OBSERVED/WATCH/CANDIDATE |
| `buy_entities_24h` | entity có net buy dương |
| `buy_wallets_24h` | số wallet net buy |
| `raw_buy_24h` | tổng direct buys |
| `raw_sell_24h` | tổng direct sells |
| `raw_net_24h` | buy - sell |
| `buy_entities_72h` | entity net buy 72h |
| `raw_net_72h` | net 72h |
| `largest_entity_share_24h` | mức tập trung |
| `first_buy_at` | buy đầu tiên trong window |
| `last_buy_at` | buy gần nhất |
| `wallets` | danh sách wallet rút gọn |
| `entities` | danh sách entity_key |
| `tx_count_24h` | số tx liên quan |
| `dex_url` | DEX Screener/GeckoTerminal link |

Không cần sheet dashboard riêng.

### 6.6 `05_RUN_LOG`

Chỉ log theo mỗi lần chạy, không log từng HTTP call chi tiết.

| column | ý nghĩa |
|---|---|
| `started_at` | bắt đầu |
| `finished_at` | kết thúc |
| `run_id` | ID lần chạy |
| `action` | SETUP/IMPORT/REBUILD/FULL_REFRESH |
| `status` | SUCCESS/FAILED/SKIPPED |
| `wallet_count` | số ví query |
| `rows_received` | Dune rows |
| `rows_inserted` | raw rows mới |
| `rows_duplicate` | row đã có |
| `result_count` | token results |
| `error_message` | lỗi ngắn gọn |

---

## 7. Quy tắc xác định buy/sell tối thiểu

V1.1 dùng registry base asset đơn giản theo contract address:

```text
stablecoins
wrapped native asset
wrapped BTC optional
```

Với target token X:

### Buy X

```text
base asset sold
AND X bought
```

### Sell X

```text
X sold
AND base asset bought
```

### Ignore

```text
stable → stable
wrapped native ↔ native equivalent
trade không có một phía là base asset
amount_usd < MIN_TRADE_USD
wallet không active
```

Altcoin-to-altcoin rotation chưa tính trong V1.1.

---

## 8. Aggregate theo entity trước

Không đếm trực tiếp số wallet mua token.

Bước 1, group theo:

```text
entity_key + token_address + time window
```

Tính:

```text
entity_buy
entity_sell
entity_net = entity_buy - entity_sell
```

Entity chỉ được xem là buyer khi:

```text
entity_net > 0
```

Bước 2, aggregate lên token:

```text
buy_entities = count(entity_net > 0)
raw_buy = sum(entity_buy)
raw_sell = sum(entity_sell)
raw_net = sum(entity_net)
```

`largest_entity_share_24h`:

```text
largest positive entity net
/
sum of all positive entity net
```

Cách này đủ để tránh lỗi rõ nhất: hai wallet cùng một chủ bị đếm thành hai whale.

---

## 9. Status đơn giản của V1.1

Chỉ có một function đặt status:

```javascript
function getStatus(metrics, config) {
  if (
    metrics.buyEntities24h >= config.MIN_CANDIDATE_ENTITIES &&
    metrics.rawNet24h >= config.MIN_CANDIDATE_NET_BUY_USD
  ) {
    return 'CANDIDATE';
  }

  if (
    metrics.buyEntities24h >= config.MIN_WATCH_ENTITIES &&
    metrics.rawNet24h > 0
  ) {
    return 'WATCH';
  }

  return 'OBSERVED';
}
```

V1.1 không có `STRONG`, quality score hoặc claim rằng entity là Smart Money đã được xác minh đầy đủ.

---

## 10. Dune query V1.1

Tạo một file:

```text
sql/v1_1_direct_dex_trades.sql
```

Input dự kiến:

```text
chain
wallet list
from_time
min_amount_usd
```

Query chỉ cần trả:

```text
block_time
tx_hash
evt_index
taker
token_bought_address
token_bought_symbol
token_sold_address
token_sold_symbol
amount_usd
project
```

Điều kiện chính:

```text
taker IN tracked_wallets
block_time >= from_time
amount_usd >= min_amount_usd
```

Yêu cầu trước khi code Apps Script:

1. Chạy query trực tiếp trên Dune với 2–3 wallet có giao dịch đã biết.
2. So sánh tối thiểu 10 transaction với explorer/Nansen.
3. Xác nhận field `taker`, token bought/sold và amount USD đúng nghĩa trên chain đang dùng.
4. Lưu query ID vào Apps Script Script Properties, không hard-code secret.

V1.1 chấp nhận recall chưa cao nhưng không chấp nhận double-count hoặc gán nhầm rõ ràng.

---

## 11. Apps Script tối thiểu

Cấu trúc đề xuất:

```text
src/apps-script/
├── appsscript.json
├── Main.gs
├── Menu.gs
├── Config.gs
├── Sheets.gs
├── DuneClient.gs
├── TradeImport.gs
├── TokenAggregate.gs
└── Utils.gs
```

Không tách thêm service/repository layer khi chưa có nhu cầu thực tế.

### Menu

```text
BigBoy
├── Setup Sheets
├── Validate Config & Wallets
├── Import Dune Trades
├── Rebuild Token Results
└── Run Full Refresh
```

### Script Properties

```text
DUNE_API_KEY
DUNE_QUERY_ID
GOOGLE_SHEET_ID
```

Không commit `.clasp.json`, API key hoặc Sheet ID thật.

---

## 12. Các bước build

### Step 1 — Tạo skeleton và Sheet setup

- [ ] Tạo Apps Script project skeleton.
- [ ] Tạo menu.
- [ ] `Setup Sheets` tạo đúng 6 sheets và headers.
- [ ] Freeze header, basic filter và number/date format.
- [ ] Không tạo dashboard/chart.

**Exit:** mở Sheet và nhìn thấy schema hoàn chỉnh.

### Step 2 — Config và wallet validation

- [ ] Đọc config thành object.
- [ ] Validate required keys.
- [ ] Normalize wallet lowercase.
- [ ] Phát hiện duplicate.
- [ ] Validate `entity_key`.
- [ ] Chỉ lấy active wallets đúng chain.

**Exit:** danh sách wallet hợp lệ sẵn sàng gửi sang Dune.

### Step 3 — Xác minh Dune query bằng tay

- [ ] Tạo query direct-taker.
- [ ] Test 2–3 wallet.
- [ ] Kiểm tra ít nhất 10 transactions.
- [ ] Ghi lại known limitations.

**Exit:** query output có thể tin để import thử.

### Step 4 — Import raw trades

- [ ] Execute hoặc lấy result query qua Dune API.
- [ ] Parse response.
- [ ] Map taker sang wallet/entity.
- [ ] Tạo explorer URL.
- [ ] Upsert theo `raw_key`.
- [ ] Ghi `05_RUN_LOG`.

**Exit:** `03_TRADES_RAW` có dữ liệu thật và refresh không duplicate.

### Step 5 — Token aggregation

- [ ] Classify direct base-asset buy/sell.
- [ ] Ignore unsupported rotation.
- [ ] Net entity trước.
- [ ] Aggregate token 24h và 72h.
- [ ] Tính concentration.
- [ ] Gọi một status function duy nhất.
- [ ] Replace/rebuild `04_TOKEN_RESULTS` theo `result_key`.

**Exit:** token results khớp với raw transactions đã kiểm tra.

### Step 6 — Manual acceptance

- [ ] Chọn tối thiểu 3 token result.
- [ ] Truy ngược từ token đến entity, wallet và tx.
- [ ] So sánh volume/count bằng tính tay.
- [ ] Run Full Refresh hai lần và xác nhận số liệu không đổi.
- [ ] Thử API error và config lỗi.

**Exit:** V1.1 đạt Definition of Done.

---

## 13. Definition of Done

V1.1 hoàn thành khi tất cả điều kiện sau đúng:

- [ ] `Setup Sheets` tạo đúng 6 sheet và schema mà không cần sửa tay.
- [ ] Có thể nhập 10–30 wallets và validate được.
- [ ] `Run Full Refresh` lấy direct DEX trades thật từ Dune.
- [ ] `03_TRADES_RAW` không duplicate sau khi chạy lại.
- [ ] `04_TOKEN_RESULTS` hiển thị 24h/72h buy, sell, net và entity count.
- [ ] Nhiều wallets cùng `entity_key` chỉ được tính là một entity.
- [ ] Có `OBSERVED`, `WATCH`, `CANDIDATE` từ một status function duy nhất.
- [ ] Có wallet list, entity list, tx links và token link để kiểm tra.
- [ ] Ba token mẫu được đối chiếu thủ công và tính đúng.
- [ ] Lỗi API/config hiện rõ trong `05_RUN_LOG`.
- [ ] Không có database, dashboard, trigger hoặc notification được thêm ngoài scope.

---

## 14. Điều kiện chuyển sang V1.2

Chỉ chuyển sang V1.2 khi V1.1 đã chạy bằng dữ liệu thật và có câu trả lời rõ cho:

- Bao nhiêu phần trăm trade bị bỏ sót vì direct-taker-only?
- Danh sách wallet nhập tay có quá ít token result không?
- Duplicate/entity netting có hoạt động đúng không?
- Dune API và Apps Script có ổn định với khối lượng hiện tại không?

V1.2 ưu tiên tự động tìm/chấm wallet bằng Nansen. Tuy nhiên nếu V1.1 cho thấy attribution là bottleneck lớn hơn wallet coverage, có thể đổi thứ tự và làm attribution trước. Quyết định phải dựa trên kết quả thật của V1.1, không dựa trên phỏng đoán.
