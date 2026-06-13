# Madison Performance Review

Web app đánh giá hiệu suất nội bộ cho Madison Technologies — vanilla HTML/CSS/JS (không build step, không backend server), dữ liệu trên **Firebase Realtime Database**, đăng nhập **Microsoft** qua **Firebase Authentication**.

## Tính năng

- **Đăng nhập Microsoft** (Azure AD) qua Firebase Auth.
- **Phân quyền 3 role** (ưu tiên Manager > Leader > Reviewer):
  - **Manager** — hardcode email trong DB (node `managers`). Thấy tất cả nhân viên + review, import Excel (câu hỏi & nhân viên), phân công reviewer (chọn từ toàn bộ nhân viên, có search), chỉnh sửa điểm final từng câu. Nếu được assign thì cũng làm Reviewer được.
  - **Leader** — hardcode email trong DB (node `leaders`, value = tên phòng ban). Ngoài việc làm Reviewer như nhân viên khác, Leader **xem được kết quả review của tất cả nhân viên trong phòng ban mình** (chỉ xem — không sửa điểm final, không phân công, không import). Xem [seed/README.md](seed/README.md) để thêm Leader.
  - **Reviewer** — tự xác định qua việc được assign cho nhân viên khác. Thấy danh sách được phân công, điền đánh giá (thang 1–5 + nhận xét optional), lưu nháp, nộp → **khóa không sửa được** (khóa cả ở security rules).
- **Điểm final tự động** = trung bình điểm các reviewer đã nộp cho từng câu; Manager có thể override thủ công (ô xanh) và đặt lại về trung bình. Khi Manager chỉnh sửa, điểm được **ép về số nguyên 1–5**.
- **Cảnh báo điểm lẻ** — điểm final cuối cùng phải là số nguyên (1–5). Khi điểm trung bình tự tính bị lẻ (vd. 4.5), hệ thống highlight màu cam: banner trên Dashboard (Manager), icon cảnh báo ở danh sách nhân viên, banner và ô Final trong bảng điểm chi tiết. Manager xem lại và làm tròn; Leader cũng thấy cảnh báo (chỉ để nắm thông tin, việc làm tròn do Manager thực hiện).
- **Import Excel** (SheetJS): kéo-thả, preview, file mẫu tải về.
  - Câu hỏi: `ID (tùy chọn) | Nhóm | Câu hỏi | Gợi ý`
  - Nhân viên: `Tên | Email | Vị trí | Phòng ban | Email Reviewer (cách nhau dấu ;)`

## Cấu trúc

```
index.html              entry — load CSS + app
css/styles.css          design tokens (Blueprint) + component styles
js/firebase-config.js   ⚠️ điền config Firebase của bạn vào đây
js/firebase.js          Firebase Auth (Microsoft) + RTDB backend
js/demo-store.js        backend giả lập (localStorage) cho chế độ demo
js/store.js             state + tính toán điểm + write helpers
js/auth.js              mã hóa email key + xác định role
js/router.js            hash router + guard theo role
js/ui.js                UI kit (icon, avatar, button, modal, rating…)
js/views/*.js           các màn hình
database.rules.json     security rules cho Realtime Database
seed/                   dữ liệu khởi tạo + hướng dẫn thêm manager
```

## Setup

### 1. Firebase project

1. [Firebase Console](https://console.firebase.google.com) → tạo (hoặc mở) project → **Build → Realtime Database → Create database**.
2. **Project settings → General → Your apps → Add app (Web)** → copy object `firebaseConfig`.
3. Dán các giá trị vào [js/firebase-config.js](js/firebase-config.js) (`apiKey`, `authDomain`, `databaseURL`, …). Chú ý `databaseURL` đúng region.

### 2. Đăng nhập Microsoft (Azure AD)

1. [Azure Portal](https://portal.azure.com) → **Microsoft Entra ID → App registrations → New registration**.
   - Supported account types: chọn theo nhu cầu (single tenant nếu chỉ cho công ty).
   - **Redirect URI** (Web): `https://<PROJECT_ID>.firebaseapp.com/__/auth/handler`
2. Trong app registration: **Certificates & secrets → New client secret** → copy value.
3. Firebase Console → **Authentication → Sign-in method → Add new provider → Microsoft** → bật, dán **Application (client) ID** + **client secret** từ Azure.
4. Nếu muốn giới hạn theo tenant công ty: đặt `MS_TENANT` trong `js/firebase-config.js` = Directory (tenant) ID; mặc định `common`.
5. **Authentication → Settings → Authorized domains**: thêm domain bạn host app (localhost đã có sẵn).

### 3. Security rules

Firebase Console → **Realtime Database → Rules** → dán nội dung [database.rules.json](database.rules.json) → Publish.
(Hoặc dùng Firebase CLI: `firebase deploy --only database`.)

> ⚠️ Project này **dùng chung cho nhiều tool**. File [database.rules.json](database.rules.json) chứa **toàn bộ ruleset chung** (đã gồm sẵn rules của các tool khác như `sprint-pulse`, `solution-way` cùng rules của tool này dưới `tools/performance-review`). Vì Publish sẽ **thay thế toàn bộ rules** của project, hãy đảm bảo file này luôn là bản đầy đủ nhất — nếu một tool khác thêm/đổi rule, cập nhật vào đây trước khi Publish.

Rules đảm bảo (trong phạm vi `tools/performance-review`):
- Mặc định toàn project khóa đọc/ghi (`.read`/`.write` = false ở gốc); chỉ những node được khai báo mới mở.
- Chỉ user đã đăng nhập đọc được dữ liệu của tool.
- Chỉ Manager (email có trong `tools/performance-review/managers`) ghi được `groups` / `employees` / `finals` / `managers` / `leaders`.
- Reviewer chỉ ghi được đúng bản review của mình, cho nhân viên mình được assign, và **không ghi được nữa sau khi đã nộp** (`status = submitted`).
- Leader không có quyền ghi gì thêm (chỉ ghi review của mình như Reviewer); phạm vi *xem theo phòng ban* được giới hạn ở tầng UI — rules cho phép mọi user đã đăng nhập đọc dữ liệu (giới hạn đọc theo phòng ban không khả thi với cấu trúc node hiện tại của Realtime DB; chấp nhận được với tool nội bộ).

### 4. Seed dữ liệu

Import [seed/seed.json](seed/seed.json) vào node **`tools/performance-review`** (KHÔNG import ở node gốc — sẽ xóa các tool khác dùng chung project). Xem hướng dẫn chi tiết và cách thêm manager khác tại [seed/README.md](seed/README.md). Manager đầu tiên đã seed: `thap.nguyen@madison.dev`.

### 5. Chạy

App dùng ES modules nên **không mở trực tiếp bằng `file://`** — cần một static server bất kỳ:

```
npx serve .
# hoặc
python -m http.server 8080
```

Mở `http://localhost:3000` (hoặc port tương ứng).

> **Lưu ý popup đăng nhập:** đăng nhập Microsoft dùng popup của Firebase — chạy trên `localhost` hoặc domain đã thêm vào Authorized domains.

### Chế độ demo (không cần Firebase)

Mở **`http://localhost:3000/?demo=1`** — chạy bằng dữ liệu giả lập trên localStorage, có 3 tài khoản mẫu (1 Manager + 1 Leader + 1 Reviewer) để xem toàn bộ giao diện và luồng nghiệp vụ. Xóa localStorage của trang để reset dữ liệu demo.

## Checklist test sau khi nối Firebase thật

1. Đăng nhập bằng email manager đã seed → vào Dashboard Manager.
2. **Bộ câu hỏi → Import câu hỏi** → tải file mẫu → import lại file đó.
3. **Nhân viên → Import Excel** → import danh sách nhân viên (có cột Email Reviewer).
4. Mở 1 nhân viên → **Phân công** → search + chọn reviewer → Lưu.
5. Đăng nhập bằng tài khoản reviewer được assign → thấy nhân viên trong "Đánh giá của tôi" → chấm điểm → **Lưu nháp** → reload (nháp còn nguyên) → **Nộp & khóa**.
6. Thử sửa lại sau khi nộp → form bị khóa (và rules chặn ghi nếu gọi tay).
7. Quay lại manager → xem bảng điểm: cột điểm từng reviewer + TB + Final; sửa 1 ô Final (chuyển nền xanh) → "Đặt lại tất cả về trung bình".
8. Khi có điểm trung bình lẻ (2 reviewer chấm 4 và 5) → Dashboard hiện banner cam, danh sách nhân viên có icon ⚠, ô Final tô cam → Manager sửa về số nguyên thì cảnh báo biến mất.
9. Thêm email vào node `leaders` (value = tên phòng ban) → đăng nhập bằng email đó → chỉ thấy "Phòng ban của tôi" với nhân viên đúng phòng ban, bảng điểm chỉ xem (không có nút sửa Final/Phân công).

## Data model (Realtime Database)

Project Firebase dùng chung cho nhiều tool — toàn bộ dữ liệu của tool này nằm dưới node `tools/performance-review/`:

```
tools/performance-review/
  managers/{emailKey}: true            # emailKey = email thường, thay '.' bằng ','
  leaders/{emailKey}: "<Tên phòng ban>" # leader xem (read-only) review của phòng ban này
  groups: [ { id, name, items: [ { id, text, hint } ] } ]
  employees/{empId}: { name, email, title, dept, order, reviewerIds: { <reviewerEmpId>: true } }
  reviews/{empId}/{reviewerEmpId}: { status: draft|submitted, answers: { qid: { score, comment } }, updatedAt, submittedAt }
  finals/{empId}/{qid}: { score, edited: true }   # chỉ chứa override của Manager
```

Điểm final hiển thị = override của Manager (nếu có) ?? trung bình tự tính từ các review đã nộp — vì vậy điểm luôn cập nhật ngay khi reviewer nộp, không cần ghi thêm.
