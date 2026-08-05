# BigBoy — Smart Money Token Finder

BigBoy là dự án tìm **token ứng viên đang được nhiều Smart Money entity độc lập cùng mua**.

## Mục tiêu V1

V1 chỉ thực hiện từ bước thu thập ví đến bước phát hiện token:

1. Tìm ví Smart Money đang hoạt động.
2. Chấm điểm chất lượng ví theo PnL 90D/180D.
3. Loại exchange, bridge, router, market maker và gom nhiều ví cùng chủ thành một entity.
4. Theo dõi DEX trades của cohort.
5. Gom các entity cùng mua và xuất `WATCH / CANDIDATE / STRONG`.

V1 **không**:

- xác nhận breakout/retest;
- tạo buy signal;
- đặt lệnh;
- quản lý vị thế;
- hứa hẹn lợi nhuận.

Đầu ra cuối cùng là:

```text
SMART_MONEY_TOKEN_CANDIDATE
```

không phải:

```text
BUY_SIGNAL
```

## Kiến trúc V1

```text
Nansen Free API
    ├── Smart Money discovery
    └── PnL 90D/180D có chọn lọc
             │
             ▼
Google Sheets + Apps Script
    ├── Wallet inbox
    ├── Provisional pool
    ├── Verified cohort
    ├── Entity mapping
    ├── Raw trades
    ├── Normalized token events
    └── Token candidates
             │
             ▼
Dune Free
    ├── DEX trades
    ├── Labels
    └── Token transfers fallback
             │
             ▼
Arkham Web UI
    └── Xác minh thủ công các entity khó
```

## Nguyên tắc thiết kế

- **Miễn phí trước, trả phí sau.** Nansen chỉ dùng ở nơi tạo giá trị cao nhất: discovery và scoring ví.
- **Không đếm địa chỉ, đếm entity.** Nhiều ví cùng chủ chỉ được tính là một entity.
- **Không chỉ join `tx_from`.** Attribution ưu tiên `taker`, sau đó mới dùng fallback có kiểm soát.
- **Một nguồn chân lý cho status.** Pipeline luôn chạy theo thứ tự `GATE → SCORE → STATUS`.
- **Lưu dữ liệu để audit.** Mỗi candidate phải truy ngược được về ví, transaction, attribution method và công thức điểm.
- **Không để cohort hẹp làm hệ thống mù.** Dùng song song `PROVISIONAL_POOL` và `VERIFIED_COHORT`.

## Kế hoạch chi tiết

Xem [docs/BUILD_PLAN_V1.md](docs/BUILD_PLAN_V1.md).

## Trạng thái

- [x] Chốt phạm vi V1
- [x] Chốt kiến trúc Google Sheets + Apps Script + Dune
- [x] Sửa thiết kế cohort bottleneck
- [x] Sửa attribution `taker / tx_from / transfers`
- [x] Hợp nhất Gate và Candidate Score
- [ ] Khởi tạo Google Sheet template
- [ ] Khởi tạo Apps Script project
- [ ] Tạo Dune queries
- [ ] Tích hợp Nansen
- [ ] Kiểm thử end-to-end

## Cảnh báo

Dữ liệu Smart Money và on-chain chỉ dùng để tạo danh sách nghiên cứu. Whale có thể hedge ở nơi khác, chuyển tài sản nội bộ hoặc thay đổi hành vi. Mọi kết quả phải được xem là dữ liệu hỗ trợ, không phải lời khuyên đầu tư.
