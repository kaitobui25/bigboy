# BigBoy — Smart Money Token Finder

BigBoy tìm các token đang được nhiều ví Smart Money mua và giữ đủ dữ liệu để kiểm tra ngược. Kết quả là **research list**, không phải tín hiệu mua tự động.

## Trạng thái hiện tại

### V1.2 — Nansen Wallet Discovery & Scoring

Đã có Apps Script cho:

- tạo/migrate 9 Google Sheets;
- lưu Nansen API key trong Script Properties;
- Smart Money discovery → `06_WALLET_INBOX`;
- priority queue không dùng FIFO;
- PnL summary 90D và PnL detail 180D có pagination guard;
- wallet score 0–100 với component breakdown;
- hard gate và lý do pass/fail;
- cohort `PROVISIONAL / VERIFIED`;
- đồng bộ cohort sang `02_WALLETS` mà không ghi đè manual rows;
- local daily credit guard và run log;
- bổ sung verified/provisional buyer vào token results nếu dữ liệu V1.1 đã tồn tại.

Chi tiết triển khai: [docs/V1_2_DEPLOY.md](docs/V1_2_DEPLOY.md).

## Deploy bằng clasp

```powershell
Copy-Item .clasp.example.json .clasp.json
# Thay scriptId bằng Apps Script ID thật.
clasp login
clasp push
```

Không commit `.clasp.json`, `.clasprc.json`, `.env` hoặc API key.

## Test

```powershell
npm test
```

## Roadmap

- [x] V1.2 — Nansen discovery và wallet scoring
- [ ] V1.3 — Entity mapping, loại ví hệ thống/MM
- [ ] V1.4 — Aggregator, contract wallet, multi-hop
- [ ] V1.5 — Gate, score, audit, validation cho token candidate

Các build plan nằm trong thư mục [`docs/`](docs/).

## Cảnh báo

Smart Money/on-chain data có thể thiếu, trễ hoặc không phản ánh hedge ở nơi khác. Không dùng output như lời khuyên đầu tư hay đảm bảo lợi nhuận.
