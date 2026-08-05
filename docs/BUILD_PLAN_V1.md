# BigBoy V1.x — Roadmap chia nhỏ

> Mục tiêu của roadmap: tạo kết quả nhìn thấy được càng sớm càng tốt, sau đó mới tăng độ chính xác và độ phức tạp từng bước.
>
> Bản đầu tiên phải chạy được trên Google Sheets. Chưa làm PostgreSQL, dashboard riêng, notification hay hạ tầng vận hành phức tạp.

---

## 1. Mục tiêu sản phẩm cuối cùng

BigBoy phải giúp trả lời:

> Token nào đang được nhiều Smart Money độc lập cùng mua và dữ liệu nào chứng minh điều đó?

Kết quả là danh sách để nghiên cứu, không phải tín hiệu mua tự động.

Mỗi token về sau phải truy ngược được đến:

```text
token
→ entity
→ wallet
→ transaction
→ nguồn dữ liệu
```

---

## 2. Vì sao phải chia nhỏ

Plan cũ gộp quá nhiều việc trong một lần build:

- tìm và chấm điểm ví;
- phân biệt nhiều ví cùng một chủ;
- import DEX trades;
- xử lý aggregator, contract wallet và multi-hop;
- normalize buy/sell;
- chấm điểm token;
- audit;
- dashboard;
- chạy shadow 14 ngày;
- chuẩn bị khả năng migrate database.

Nếu làm cùng lúc, rất khó biết lỗi nằm ở dữ liệu nguồn, attribution, aggregation hay giao diện.

Roadmap mới dùng nguyên tắc:

```text
Có kết quả trước
→ kiểm tra kết quả
→ sửa độ chính xác
→ tự động hóa thêm
→ chỉ mở rộng hạ tầng khi thật sự cần
```

---

## 3. Roadmap V1.x

| Phiên bản | Mục tiêu chính | Kết quả nhìn thấy | Chưa làm |
|---|---|---|---|
| **V1.1** | Sheet-first MVP | Google Sheets hiển thị token được các wallet theo dõi mua | Nansen automation, database, dashboard, scheduling |
| **V1.2** | Tự động tìm và chấm ví | Sheet tự thêm provisional/verified wallet từ Nansen | Entity resolution sâu, contract wallet |
| **V1.3** | Entity quality | Không đếm nhiều wallet cùng chủ thành nhiều whale; loại ví hệ thống/MM rõ ràng | Attribution nâng cao |
| **V1.4** | Attribution accuracy | Bắt aggregator, Safe/AA, contract wallet, multi-hop; giảm bỏ sót và double-count | Dashboard riêng |
| **V1.5** | Candidate quality và validation | Gate/score/status ổn định, audit trail, golden test set, shadow validation | Database |
| **V1.6** | Vận hành tiện hơn | Trigger, review queue, cảnh báo lỗi, Telegram tùy chọn, dashboard trong Sheets hoặc web | PostgreSQL nếu chưa cần |
| **V1.7** | Scale khi Sheets không đủ | PostgreSQL, worker, nhiều chain, lịch chạy dày, historical analysis | Auto trading |
| **V1.8+** | Xác nhận chart và execution | Breakout/retest, liquidity gate, risk management, paper trading | Live trading trước khi validation đủ |

Không bắt đầu phiên bản tiếp theo chỉ vì “code được”. Chỉ chuyển phiên bản khi exit criteria của phiên bản hiện tại đã đạt.

---

## 4. Trọng tâm hiện tại: V1.1

Tài liệu chi tiết:

```text
docs/BUILD_PLAN_V1_1.md
```

V1.1 chỉ cần hoàn thành một vertical slice nhỏ:

```text
Danh sách wallet nhập tay
→ lấy direct DEX trades từ Dune
→ ghi raw trades vào Google Sheets
→ aggregate theo entity nhập tay
→ hiển thị TOKEN_RESULTS
```

Khi nhấn một menu trong Google Sheets, người dùng phải thấy được:

- token nào vừa được các wallet theo dõi mua;
- có bao nhiêu entity độc lập cùng mua;
- tổng buy, sell và net buy 24h/72h;
- wallet nào đóng góp;
- transaction link để kiểm tra bằng explorer.

V1.1 không cố giải quyết mọi trường hợp on-chain. Các giới hạn phải được ghi rõ ngay trong Sheet để tránh hiểu nhầm kết quả là đầy đủ.

---

## 5. Quy tắc chống scope creep

Trong V1.1, không thêm các phần sau:

- PostgreSQL hoặc database khác;
- dashboard riêng;
- n8n;
- Telegram/Discord notification;
- Nansen API automation;
- Arkham API;
- wallet PnL scoring tự động;
- entity clustering tự động;
- aggregator attribution;
- Safe/AA/contract-wallet fallback;
- multi-hop normalization đầy đủ;
- Solana;
- backtest;
- chart confirmation;
- exchange API hoặc auto order;
- hệ thống audit phức tạp;
- shadow operation 14 ngày.

Một ý tưởng mới chỉ được thêm vào V1.1 khi thiếu nó thì không thể tạo hoặc kiểm tra `TOKEN_RESULTS`.

---

## 6. Khi nào mới viết chi tiết các plan sau

Chỉ tạo `BUILD_PLAN_V1_2.md` sau khi V1.1 đã chạy được với dữ liệu thật và đã trả lời được ba câu hỏi:

1. Dune direct trades có đưa đủ dữ liệu cần thiết vào Sheets không?
2. Token aggregation có tạo kết quả dễ kiểm tra bằng transaction thật không?
3. Bottleneck tiếp theo thực sự là thiếu wallet tốt, entity trùng hay attribution bỏ sót?

Kết quả thực tế của V1.1 sẽ quyết định thứ tự và phạm vi chi tiết của V1.2–V1.4. Không viết trước một kiến trúc lớn dựa trên giả định.

---

## 7. Tiêu chuẩn chung cho mọi phiên bản

- Không gọi output là buy signal.
- Raw data không sửa tay sau khi import.
- Re-run cùng input không được tạo duplicate.
- Mọi kết quả phải có source link để kiểm tra.
- Secret không được commit vào GitHub.
- Mỗi phiên bản phải có Definition of Done và danh sách rõ phần chưa làm.
- Ưu tiên giải pháp ít thành phần nhất có thể chứng minh logic hoạt động.
