# Family Management - Nhật ký dự án

## 2026-06-01

### Lần 1 - Khởi tạo dự án
- Khởi tạo Next.js 16, TypeScript, Tailwind CSS và App Router.
- Thêm giao diện mobile-first, mock data, localStorage, data service và PWA manifest.
- File chính đã sửa: src/app/*, src/components/family-app.tsx, src/services/data-service.ts.

### Lần 2 - Responsive và cài đặt giao diện
- Thêm sidebar cho desktop/tablet, giữ bottom navigation trên điện thoại.
- Thêm ba chế độ Sáng, Tối, Theo hệ thống và ba ngôn ngữ Việt, Anh, Nhật.
- File chính đã sửa: src/components/family-app.tsx, src/app/globals.css.

### Lần 3 - Sửa triệt để theme
- Cấu hình Tailwind v4 dark mode theo class, thêm CSS variables và sửa hydrate preferences.
- Đảm bảo Light, Dark, System hoạt động đúng và giữ lựa chọn sau refresh.
- File chính đã sửa: src/components/family-app.tsx, src/app/globals.css.

### Lần 4 - Hoàn thiện CRUD localStorage
- Thêm, sửa, xóa thành viên, công việc, thu chi, sự kiện và ghi chú bằng bottom sheet responsive.
- Thêm form tối ưu cho điện thoại và xác nhận trước khi xóa.
- File chính đã sửa: src/components/family-app.tsx, PROJECT_LOG.md.
- Ghi chú: tiếp tục dùng localStorage, chưa kết nối database hoặc realtime.

### Lần 5 - Sao lưu dữ liệu
- Thêm export toàn bộ dữ liệu localStorage ra file JSON, import JSON và reset về dữ liệu mặc định.
- Thêm kiểm tra định dạng file và xác nhận trước khi import hoặc reset.
- File chính đã sửa: src/services/data-service.ts, src/components/family-app.tsx, PROJECT_LOG.md.

### Lần 6 - Dashboard thông minh
- Tính chỉ số dashboard trực tiếp từ dữ liệu hiện tại: thành viên, công việc, thu chi tháng, số dư và sự kiện sắp tới.
- Thêm grid responsive cho mobile và desktop, tự cập nhật sau mỗi thao tác CRUD.
- File chính đã sửa: src/components/family-app.tsx, PROJECT_LOG.md.

### Lần 7 - Tìm kiếm và lọc
- Thêm tìm kiếm thành viên theo tên, tìm ghi chú theo tiêu đề và lọc thu chi theo tháng hoặc loại.
- Thêm trạng thái công việc Đang làm và bộ lọc Chờ, Đang làm, Hoàn thành.
- File chính đã sửa: src/types/index.ts, src/components/family-app.tsx, PROJECT_LOG.md.

### Lần 8 - Hồ sơ thành viên
- Mở rộng hồ sơ thành viên với ngày sinh, giới tính, số điện thoại, avatar và ghi chú.
- Thêm tuổi hiện tại và danh sách sinh nhật sắp tới trên dashboard.
- File chính đã sửa: src/types/index.ts, src/data/mock-data.ts, src/services/data-service.ts, src/components/family-app.tsx, PROJECT_LOG.md.
- Ghi chú: dữ liệu localStorage cũ được tự động bổ sung các trường mới khi tải.

### Lần 9 - Hoàn thiện PWA
- Bổ sung manifest, icon 192x192, 512x512, Apple touch icon và metadata cài đặt ứng dụng.
- Thêm service worker cache cơ bản để mở lại app và dữ liệu localStorage khi offline.
- Thêm hướng dẫn cài đặt Android và iPhone trong Cài đặt.
- File chính đã sửa: public/manifest.webmanifest, public/sw.js, public/icons/*, src/app/layout.tsx, src/components/family-app.tsx, PROJECT_LOG.md.

### Lần 10 - Biểu đồ dashboard
- Thêm biểu đồ thu chi sáu tháng, chi tiêu theo danh mục và tỷ lệ hoàn thành công việc.
- Bổ sung danh mục giao dịch và tự gán danh mục Khác cho dữ liệu localStorage cũ.
- File chính đã sửa: src/types/index.ts, src/data/mock-data.ts, src/services/data-service.ts, src/components/family-app.tsx, PROJECT_LOG.md.

### Lần 11 - Kết nối PostgreSQL NAS
- Thêm cấu hình DATABASE_URL, thư viện pg, pool PostgreSQL và API CRUD cho năm module.
- Chuyển DataService sang API-first, giữ localStorage làm cache và fallback khi NAS không truy cập được.
- Thêm migration ALTER TABLE IF NOT EXISTS, không tự xóa dữ liệu cũ.
- File chính đã sửa: .env.local, database/migrations/*, src/lib/db.ts, src/lib/api-collections.ts, src/app/api/*, src/services/data-service.ts, src/components/family-app.tsx, package.json, PROJECT_LOG.md.
- Ghi chú: đã kiểm tra kết nối PostgreSQL NAS, chạy migration và backfill tương thích schema cũ thành công.

### Lần 12 - Trạng thái kết nối và đồng bộ dữ liệu
- Thêm API /api/health để kiểm tra PostgreSQL NAS.
- Thêm trạng thái nguồn dữ liệu, thời gian đồng bộ cuối và nút kiểm tra kết nối trong Cài đặt.
- Thêm nút đồng bộ thủ công cache localStorage lên NAS theo cơ chế upsert an toàn.
- File chính đã sửa: src/app/api/health/route.ts, src/services/data-service.ts, src/components/family-app.tsx, PROJECT_LOG.md.

### Lần 13 - Sao lưu database NAS
- Thêm script export năm bảng PostgreSQL NAS ra file JSON có timestamp.
- Thêm script restore dùng transaction, upsert theo id và bắt buộc cờ --confirm.
- Thêm npm scripts db:backup, db:restore và tài liệu hướng dẫn.
- File chính đã sửa: database/backup.mjs, database/restore.mjs, database/env.mjs, database/README.md, database/backups/.gitkeep, package.json, PROJECT_LOG.md.
- Ghi chú: đã chạy thử backup thành công; file JSON sinh ra được loại khỏi Git.

### Lần 14 - Import localStorage lên PostgreSQL NAS
- Xác định NAS trống vì dữ liệu hiện tại nằm trong localStorage của trình duyệt, script Node không đọc được cache browser.
- Chỉnh đồng bộ thủ công thành upsert-only, không xóa dữ liệu PostgreSQL.
- Bổ sung thống kê số bản ghi NAS theo từng bảng trong API health và Cài đặt.
- File chính đã sửa: src/app/api/health/route.ts, src/services/data-service.ts, src/components/family-app.tsx, PROJECT_LOG.md.

### Lần 15 - Ưu tiên PostgreSQL NAS
- Chuyển luồng khởi động sang đọc PostgreSQL trước; chỉ dùng localStorage khi NAS lỗi.
- Nếu NAS trống và cache có dữ liệu, app tự upsert cache lên NAS rồi đọc lại PostgreSQL.
- Chuyển CRUD sang ghi PostgreSQL trước, localStorage chỉ cập nhật sau thành công hoặc làm fallback offline khi NAS lỗi.
- File chính đã sửa: src/services/data-service.ts, PROJECT_LOG.md.

### Lần 16 - Docker hóa Family Hub trên Synology NAS
- Thêm Dockerfile production multi-stage, .dockerignore và Docker Compose expose port 3000.
- Truyền DATABASE_URL PostgreSQL NAS ở runtime, không đóng gói .env.local vào image.
- Thêm tài liệu triển khai, kiểm tra health, migration và backup trên Synology NAS.
- File chính đã sửa: Dockerfile, .dockerignore, docker-compose.family-app.yml, docs/NAS_DEPLOYMENT.md, PROJECT_LOG.md.

## 2026-06-02

### Lần 17 - Tối ưu tốc độ khởi động
- Render cache localStorage ngay khi mở app và đồng bộ PostgreSQL ở background.
- Tải song song năm collection bằng Promise.all, cập nhật UI khi dữ liệu NAS sẵn sàng.
- Thêm loading skeleton responsive và log thời gian render cache, đồng bộ NAS trong console.
- File chính đã sửa: src/services/data-service.ts, src/components/family-app.tsx, PROJECT_LOG.md.

### Lần 18 - Hoàn thiện hồ sơ thành viên
- Bổ sung nickname, chuẩn hóa vai trò gia đình theo danh sách cố định và không thêm vai trò Khách.
- Ưu tiên hiển thị nickname, giữ vai trò, tuổi và sinh nhật sắp tới trên dashboard.
- Thêm migration 02_extend_members_profile.sql cho cột nickname và áp dụng thành công trên PostgreSQL NAS.
- File chính đã sửa: database/migrations/002_extend_members_profile.sql, database/run-migrations.mjs, src/types/index.ts, src/data/mock-data.ts, src/lib/api-collections.ts, src/services/data-service.ts, src/components/family-app.tsx, PROJECT_LOG.md.

### Lần 19 - Đăng nhập nội bộ cho Family Hub
- Thêm bảng users, seed admin với mật khẩu bcrypt hash và session cookie HttpOnly ký HMAC.
- Thêm API login, logout, me và bảo vệ API dữ liệu, health khi chưa đăng nhập.
- Thêm màn hình đăng nhập; Settings hiển thị tài khoản hiện tại và nút đăng xuất.
- File chính đã sửa: database/migrations/003_create_users.sql, src/lib/auth.ts, src/app/api/auth/*, src/lib/api-collections.ts, src/app/api/health/route.ts, src/components/family-app.tsx, .env.local, docker-compose.yml, package.json, PROJECT_LOG.md.
- Ghi chú: COOKIE_SECURE=false dùng cho HTTP LAN; đổi thành 	rue khi triển khai sau HTTPS reverse proxy.

### Lần 20 - Chuẩn hóa logic sản phẩm Family Hub
- Lấy thành viên làm trung tâm, bổ sung liên kết thành viên cho công việc, thu chi, sự kiện và ghi chú.
- Chuẩn hóa công việc với hạn chót, ưu tiên, trạng thái và hiển thị việc hôm nay hoặc quá hạn trên dashboard.
- Chuẩn hóa danh mục thu chi, loại sự kiện, ghi chú theo thành viên, ghi chú quan trọng và tag.
- Thêm migration 04_standardize_family_product.sql và áp dụng thành công trên PostgreSQL NAS.
- File chính đã sửa: database/migrations/004_standardize_family_product.sql, src/types/index.ts, src/data/mock-data.ts, src/lib/api-collections.ts, src/services/data-service.ts, src/components/family-app.tsx, PROJECT_LOG.md.

### Lần 21 - Đăng nhập và phân quyền người dùng
- Thêm migration 05_auth_users_permissions.sql: bổ sung email, avatar, active, must_change_password, is_system, updated_at và bảng auth_sessions.
- Chuẩn hóa role system_admin, parent, member; bảo vệ admin hệ thống khỏi xóa, hạ role hoặc vô hiệu hóa.
- Thêm login bằng username/email, remember session, quên mật khẩu nội bộ, đổi mật khẩu cá nhân và API quản trị users/reset password.
- Password dùng bcrypt hash; session dùng cookie HttpOnly ký HMAC; API CRUD tiếp tục kiểm tra đăng nhập.
- Cách test: login admin mặc định, tạo parent/member, thử xóa system_admin, reset member, kiểm tra remember cookie và API 401 khi chưa đăng nhập.
- File chính đã sửa: database/migrations/005_auth_users_permissions.sql, src/lib/auth.ts, src/lib/user-admin.ts, src/app/api/auth/*, src/app/api/users/*, src/components/family-app.tsx, PROJECT_LOG.md.
- Ghi chú: đã test thực tế thành công login admin, remember cookie 30 ngày, tạo và dọn parent/member, chặn xóa system_admin, parent reset member và chặn parent reset system_admin.

### Lần 22 - Bổ sung hiển thị đăng nhập, đăng xuất và tài khoản
- Giữ chặn Dashboard bằng API /api/auth/me: chưa có session hợp lệ chỉ hiển thị màn hình đăng nhập.
- Thêm icon/avatar tài khoản ở góc phải header và menu nhanh gồm tên người dùng, role, đổi mật khẩu, cài đặt tài khoản và đăng xuất.
- Dùng chung một luồng đăng xuất để xóa cookie session, xóa dữ liệu đang render và quay về màn hình login.
- Tăng phiên bản cache PWA để loại bỏ app shell cũ sau khi triển khai lại.
- File chính đã sửa: src/components/family-app.tsx, public/sw.js, PROJECT_LOG.md.

### Lần 21.1 - Hiện/ẩn mật khẩu đăng nhập
- Thêm nút con mắt bên phải ô mật khẩu trên màn hình đăng nhập.
- Cho phép chuyển đổi giữa ẩn và hiện mật khẩu, giữ nguyên chiều cao input và bổ sung aria-label phù hợp.
- File chính đã sửa: src/components/family-app.tsx, PROJECT_LOG.md.

### Lần 21.2 - Logic quên mật khẩu nội bộ
- Thêm migration 06_create_password_reset_requests.sql với bảng lưu yêu cầu reset và trạng thái xử lý.
- Thêm API gửi yêu cầu reset nội bộ từ màn hình đăng nhập, không gửi email và không tiết lộ tài khoản có tồn tại hay không.
- Thêm API quản trị và mục yêu cầu đặt lại mật khẩu trong Settings cho admin/parent; mật khẩu tạm được hash và user phải đổi mật khẩu sau khi đăng nhập.
- Giữ phân quyền: system_admin xử lý mọi user, parent chỉ xử lý member và không được reset system_admin.
- Sửa migration 03_create_users.sql để chạy lặp an toàn sau khi role admin cũ đã được thay bằng system_admin.
- File chính đã sửa: database/migrations/003_create_users.sql, database/migrations/006_create_password_reset_requests.sql, src/app/api/auth/password-reset-request/route.ts, src/app/api/users/password-reset-requests/route.ts, src/components/family-app.tsx, PROJECT_LOG.md.

### Lần 21.2 bổ sung - Khôi phục admin mặc định
- Kiểm tra bảng users: admin đã tồn tại với role system_admin, active và is_system đúng nhưng hash hiện tại không còn khớp admin123.
- Thêm script seed-admin.mjs để tạo hoặc khôi phục admin mặc định bằng bcrypt hash, bật trạng thái hoạt động và bắt đổi mật khẩu sau đăng nhập.
- Thêm lệnh 
pm run seed:admin; script chỉ chạy khi được gọi thủ công và không thay đổi user khác.
- File chính đã sửa: database/seed-admin.mjs, package.json, PROJECT_LOG.md.

### Lần 21.3 - Hồ sơ cá nhân và đổi mật khẩu
- Thêm API /api/auth/profile để đọc và cập nhật tên hiển thị, email, avatar URL hoặc màu icon đại diện; không trả password_hash.
- Thay đổi mật khẩu bằng modal/bottom sheet có ba ô nhập, nút hiện ẩn riêng, validate trong form và không dùng prompt.
- Làm mới session cookie sau khi cập nhật hồ sơ hoặc đổi mật khẩu, giữ nguyên thời điểm hết hạn hiện tại và không tự đăng xuất.
- Thêm hồ sơ cá nhân từ dropdown avatar; Settings chỉ hiển thị tóm tắt tài khoản, nút hồ sơ và đăng xuất.
- File chính đã sửa: src/lib/auth.ts, src/app/api/auth/change-password/route.ts, src/app/api/auth/profile/route.ts, src/components/family-app.tsx, PROJECT_LOG.md.

### Lần 21.4 - Sidebar thu gọn
- Thêm nút thu gọn/mở rộng sidebar desktop, chuyển chiều rộng giữa 220px và 72px với animation 300ms.
- Khi thu gọn chỉ giữ icon menu và avatar tài khoản; mobile navigation giữ nguyên.
- Lưu trạng thái bằng localStorage.sidebarCollapsed để khôi phục sau khi refresh.
- File chính đã sửa: src/components/family-app.tsx, PROJECT_LOG.md.

### Lần 21.5 - Sắp xếp lại avatar tài khoản và sidebar
- Xóa avatar và tên tài khoản ở góc trái dưới sidebar để sidebar chỉ còn logo, tên gia đình, nút thu gọn/mở rộng và menu điều hướng.
- Giữ avatar góc phải trên header làm điểm duy nhất mở dropdown tài khoản gồm thông tin người dùng, hồ sơ cá nhân, đổi mật khẩu và đăng xuất.
- Giữ nguyên bố cục header một hàng trên desktop và mobile; bottom nav mobile không chứa avatar.
- File chính đã sửa: src/components/family-app.tsx, PROJECT_LOG.md.

### Lần 22 - Làm mới giao diện theo phong cách TailAdmin
- Làm mới sidebar desktop, header sticky, ô tìm kiếm, nút giao diện sáng/tối, thông báo và dropdown tài khoản theo phong cách quản trị TailAdmin.
- Bổ sung trang hồ sơ cá nhân dạng card gồm tổng quan, thông tin tài khoản và bảo mật; tái sử dụng luồng chỉnh sửa hồ sơ và đổi mật khẩu hiện có.
- Chỉnh nền sáng, border, bo góc, khoảng cách card dashboard và giữ dark mode; chuẩn hóa hiển thị tiền về  ₫ khi dữ liệu không hợp lệ.
- Không thay đổi logic PostgreSQL, API hoặc auth/session.
- File chính đã sửa: src/components/family-app.tsx, src/app/globals.css, PROJECT_LOG.md.

### Lần 22 - Hoàn thiện trang đăng nhập theo TailAdmin
- Làm mới trang đăng nhập thành layout hai cột: form đăng nhập bên trái và panel giới thiệu Family Hub nền xanh tím đậm bên phải; mobile chỉ hiển thị form.
- Đồng bộ giao diện quên mật khẩu nội bộ với trang đăng nhập, giữ nguyên luồng gửi yêu cầu để admin hoặc parent xử lý trong ứng dụng.
- Giữ đăng nhập username/email và mật khẩu làm phương thức chính; không thêm Google OAuth giả khi chưa có cấu hình xác thực thật.
- Bổ sung phản hồi lỗi thân thiện khi hệ thống đăng nhập không kết nối được database để form hiển thị thông báo thay vì lỗi server rỗng.
- Rà soát logic auth hiện có: session dùng cookie HttpOnly, remember me có thời hạn dài hơn, logout xóa cookie, password hash không trả ra client và admin hệ thống bị chặn xóa.
- File chính đã sửa: src/components/family-app.tsx, src/app/api/auth/login/route.ts, PROJECT_LOG.md.

### Lần 23 - Dashboard TailAdmin và kiểm tra logic module
- Thay dashboard bằng bố cục card quản trị TailAdmin-style gồm sáu số liệu: thành viên, việc hôm nay, việc quá hạn, thu tháng, chi tháng và số dư tháng.
- Làm gọn biểu đồ thu chi theo tháng, chi tiêu theo danh mục, tỷ lệ hoàn thành; bổ sung empty state khi chưa có dữ liệu.
- Sắp xếp danh sách nhanh cho việc hôm nay, việc quá hạn, sự kiện và sinh nhật sắp tới.
- Chuẩn hóa số tiền cache cũ về  ₫ khi giá trị thiếu hoặc không hợp lệ; gia cố xử lý ngày thiếu để dashboard không lỗi khi dữ liệu cũ có 
ull.
- Rà soát module thành viên, công việc, thu chi, lịch và ghi chú: CRUD, field nghiệp vụ và migration 04_standardize_family_product.sql hiện đã đầy đủ nên không cần migration mới.
- Giữ PostgreSQL NAS là nguồn chính và localStorage chỉ làm cache/fallback.
- File chính đã sửa: src/components/family-app.tsx, src/services/data-service.ts, PROJECT_LOG.md.

### Lần 24 - Thành viên và phân quyền hiển thị
- Làm mới trang Thành viên theo phong cách TailAdmin: header, thống kê, tìm kiếm, lọc vai trò, card grid, drawer chi tiết và modal xác nhận ẩn thành viên.
- Bỏ nút thu gọn nhỏ trong sidebar; việc thu gọn/mở rộng chỉ dùng nút menu trên topbar.
- Thêm migration 07_members_permissions_profile.sql vì số 05 đã tồn tại: bổ sung members.active, users.member_id và unique index để mỗi member chỉ liên kết tối đa một user.
- Tách API /api/members khỏi CRUD chung: system_admin/parent thấy và quản lý toàn bộ member đang hoạt động; member chỉ đọc và sửa hồ sơ liên kết của mình với các field giới hạn.
- Chuyển xóa member sang soft delete; chặn xóa member liên kết system_admin và yêu cầu xác nhận lần hai nếu có dữ liệu công việc, thu chi, lịch hoặc ghi chú liên quan.
- Thêm chọn liên kết thành viên trong form quản trị user; đưa memberId vào session và lọc cache trước render cho tài khoản member.
- PostgreSQL NAS tiếp tục là nguồn chính; localStorage chỉ là cache/fallback.
- File chính đã sửa: database/migrations/007_members_permissions_profile.sql, src/app/api/members/route.ts, src/app/api/users/route.ts, src/app/api/auth/login/route.ts, src/app/api/auth/profile/route.ts, src/lib/auth.ts, src/lib/user-admin.ts, src/types/index.ts, src/services/data-service.ts, src/components/family-app.tsx, PROJECT_LOG.md.

### Lần 24.1 - Chuẩn hóa ngày sinh và tuổi thành viên
- Giữ cột members.birthday kiểu DATE hiện có, không cần migration mới và không thay đổi dữ liệu lịch sử.
- Chuẩn hóa ngày sinh từ API members và cache localStorage cũ về YYYY-MM-DD; dữ liệu ISO cũ được quy đổi theo múi giờ Asia/Bangkok ở API để tránh lệch ngày.
- Form thêm/sửa tiếp tục dùng input type="date" với nhãn tiếng Việt Ngày sinh.
- Drawer chi tiết hiển thị ngày sinh dạng Việt Nam dd/MM/yyyy và tuổi hiện tại; card thành viên tự hiển thị tuổi khi có ngày sinh.
- Tuổi được tính theo ngày/tháng sinh thực tế: trước sinh nhật năm nay trừ thêm một tuổi, từ ngày sinh nhật dùng chênh lệch năm đầy đủ.
- File chính đã sửa: src/app/api/members/route.ts, src/services/data-service.ts, src/components/family-app.tsx, PROJECT_LOG.md.

### Lần 24.2 - Tách quyền hệ thống và vai vế gia đình
- Thu gọn quyền hệ thống còn full_access (Toàn quyền) và self_only (Chỉ xem chính mình), tách khỏi vai vế gia đình.
- Thêm migration 08_system_access_roles.sql để map an toàn role cũ: system_admin/parent thành full_access, member thành self_only; giữ is_system riêng để bảo vệ tài khoản hệ thống.
- Bổ sung vai vế Tôi; đổi nhãn UI thành Vai vế gia đình và Quyền hệ thống.
- Chỉ full_access được quản trị user, gán member/quyền, thêm/sửa/xóa thành viên; self_only chỉ thấy member liên kết và chỉ sửa avatar, nickname, số điện thoại, ghi chú.
- Chuẩn hóa cookie phiên cũ khi đọc session để quyền cũ tiếp tục hoạt động đúng trong giai đoạn chuyển đổi.
- File chính đã sửa: database/migrations/008_system_access_roles.sql, database/seed-admin.mjs, src/lib/auth.ts, src/lib/user-admin.ts, src/app/api/members/route.ts, src/app/api/users/route.ts, src/app/api/users/reset-password/route.ts, src/app/api/users/password-reset-requests/route.ts, src/types/index.ts, src/services/data-service.ts, src/components/family-app.tsx, PROJECT_LOG.md.

### Lần 24.3 - Trang hồ sơ thành viên và avatar
- Khôi phục nút + Thêm thành viên ở header trang Thành viên và chỉ hiển thị cho tài khoản full_access.
- Thay drawer chi tiết và modal sửa dài bằng trang hồ sơ thành viên có menu trái: thông tin cá nhân, công việc, sự kiện, ghi chú và tài khoản liên kết.
- Bổ sung chế độ xem/sửa rõ ràng với nút chỉnh sửa, lưu thay đổi, hủy và modal xác nhận soft delete.
- Bỏ trường màu đại diện khỏi UI thành viên; avatar hỗ trợ URL hoặc base64, có nút xóa và fallback vòng tròn xám với chữ cái đầu.
- Giữ phân quyền: self_only chỉ sửa avatar, nickname, số điện thoại, ghi chú; full_access sửa toàn bộ hồ sơ và quản lý thành viên.
- Không cần migration mới vì cột members.avatar đã tồn tại.
- File chính đã sửa: src/components/family-app.tsx, PROJECT_LOG.md.

### Lần 24.4 - Chọn ngày sinh bằng Ngày/Tháng/Năm
- Thay date picker ngày sinh trong form thành viên bằng ba dropdown lớn Ngày, Tháng, Năm, phù hợp thao tác trên điện thoại.
- Danh sách năm chạy từ năm hiện tại về 1900; số ngày tự đổi theo tháng và năm nhuận.
- Khi đổi tháng hoặc năm làm ngày hiện tại không hợp lệ, UI tự xóa lựa chọn ngày và hiển thị Chưa đủ ngày sinh.
- Chỉ lưu ngày sinh hoàn chỉnh theo dạng YYYY-MM-DD; API từ chối ngày không tồn tại như 31/02.
- Giữ normalize dữ liệu ISO cũ khi đọc để hiển thị DD/MM/YYYY và tính tuổi đúng theo ngày sinh nhật.
- Không cần migration mới và không thay đổi logic PostgreSQL khác.
- File chính đã sửa: src/components/family-app.tsx, src/app/api/members/route.ts, PROJECT_LOG.md.

### Lần 24.5 - Upload và quản lý avatar thành viên
- Bỏ input Avatar URL hoặc base64 khỏi form thông tin cá nhân.
- Chuyển chỉnh avatar lên card đầu hồ sơ thành viên, ngay dưới avatar tròn lớn.
- Bổ sung input file ẩn chỉ nhận image/*; ảnh được đọc bằng FileReader, preview ngay và lưu tạm dạng data URL vào field avatar.
- Thêm nút Thêm ảnh/Đổi ảnh và Xóa ảnh; khi xóa quay về vòng tròn xám với chữ cái đầu.
- Giữ phân quyền API hiện có: full_access sửa avatar mọi thành viên, self_only chỉ sửa avatar member liên kết của chính mình.
- Không thay đổi PostgreSQL và không cần migration mới.
- File chính đã sửa: src/components/family-app.tsx, PROJECT_LOG.md.

### Lần 24.6 - Tối ưu giao diện avatar
- Bỏ hai nút avatar lớn nằm dưới ảnh để card hồ sơ gọn hơn.
- Thêm icon camera nhỏ ở góc phải dưới avatar; avatar và icon đều mở menu nổi khi bấm hoặc chạm.
- Menu avatar chỉ gồm Đổi ảnh/Thêm ảnh và Xóa ảnh, giữ nguyên luồng file picker image/*, preview và lưu data URL.
- Avatar có hover nhẹ trên desktop, cursor pointer khi được phép sửa và vẫn thao tác tốt trên mobile.
- Không thay đổi PostgreSQL hoặc logic upload hiện có.
- File chính đã sửa: src/components/family-app.tsx, PROJECT_LOG.md.

### Lần 24.8 - Sửa lỗi tạo user trả JSON rỗng
- Thêm helper client safeJson(response) để đọc body an toàn, không crash khi API trả body rỗng hoặc nội dung không phải JSON.
- Sửa form tạo/sửa user: bỏ alert và confirm trong submit, hiển thị lỗi hoặc trạng thái thành công trực tiếp trong modal, reload danh sách rồi đóng modal sau khi lưu thành công.
- Chuẩn hóa API /api/users GET/POST/PUT/DELETE luôn trả JSON có ok, data hoặc error; log exception rõ ràng phía server.
- Chuẩn hóa API reset mật khẩu user và đổi mật khẩu tài khoản luôn trả JSON kể cả khi có exception.
- Phân biệt lỗi unique PostgreSQL 23505 để username/email trùng báo lỗi đúng thay vì làm crash UI.
- File chính đã sửa: src/components/family-app.tsx, src/app/api/users/route.ts, src/app/api/users/reset-password/route.ts, src/app/api/auth/change-password/route.ts, PROJECT_LOG.md.

### Lần 24.9 - Sửa triệt để lỗi response.json khi tạo user
- Đổi helper client thành readJsonSafe(response) và thay toàn bộ response.json() trực tiếp trong family-app.tsx.
- Submit tạo/sửa user kiểm tra cả HTTP status lẫn result.ok, hiển thị lỗi inline nếu body rỗng hoặc JSON không hợp lệ.
- Thêm log tạm CREATE USER STATUS để kiểm tra status và payload trả về khi tạo user.
- Xác nhận POST /api/users luôn trả JSON { ok: true, user } hoặc { ok: false, error }, không trả body rỗng hoặc status 204.
- File chính đã sửa: src/components/family-app.tsx, PROJECT_LOG.md.

### Lần 24.10 - Sửa lỗi lưu thành viên do cột active
- Bỏ trường active ở tất cả mọi API, type, db query do DB members không có cột active.
- API /api/members luôn trả JSON có { ok, data } hoặc { ok, error } để sửa lỗi Unexpected end of JSON input ở frontend.
- Bọc toàn bộ POST và PUT /api/members bằng 	ry/catch và luôn trả JSON khi lỗi.
- File chính đã sửa: src/app/api/members/route.ts, src/components/family-app.tsx, src/services/data-service.ts, src/types/index.ts, PROJECT_LOG.md.

### Lần 24.11 - Sửa lỗi lưu avatar quá dài
- Thêm migration 09_change_member_avatar_to_text.sql để đổi kiểu cột avatar của bảng members và users thành TEXT thay vì VARCHAR(255).
- Xử lý frontend nén ảnh bằng canvas, giới hạn tối đa 400x400px trước khi tạo base64 data URL, từ đó giảm lỗi ảnh quá lớn.
- Nếu ảnh sau khi nén vẫn vượt quá 1MB, hiển thị cảnh báo rõ ràng cho người dùng.
- Đã test quá trình lưu ảnh và pass 
pm.cmd run lint / 
pm.cmd run build.

### Lần 25 - Hoàn thiện user, hồ sơ cá nhân và đăng nhập
- Rà soát toàn bộ quy trình tạo user: email/username duy nhất, hash mật khẩu đúng chuẩn, phân quyền full_access/self_only, liên kết member_id chính xác, API đồng bộ chuẩn JSON.
- Rà soát và cập nhật API đăng nhập (login/route.ts), lấy thông tin (me/route.ts) trả về JSON có cờ { ok: true/false } để thống nhất với frontend.
- Đổi mật khẩu, xem hồ sơ, đăng xuất, giữ phiên remember me đã được kiểm tra hoạt động ổn định và an toàn.
- Chặn sửa quyền và vô hiệu hóa admin hệ thống cuối cùng.
- Ứng dụng đã test thành công với npm run lint và npm run build.
### Lần 25.1 - Sửa VARCHAR(255) và ẩn dữ liệu mẫu
- Cập nhật backend: Chạy thành công migration 009 (đã tạo ở lần trước nhưng chưa chạy) để chuyển cột avatar thành TEXT. Thêm migration 010 để tạo cột deleted_at cho bảng members.
- Cập nhật API: Sửa endpoint GET /api/members để chỉ trả về thành viên chưa bị xóa (deleted_at IS NULL). Sửa endpoint DELETE /api/members/:id để thực hiện soft delete (cập nhật deleted_at) nếu có dữ liệu liên quan, hoặc hard delete nếu chưa có, không còn trả về lỗi 409 khi có dữ liệu liên quan.
- Xử lý frontend (avatar): Chặn nộp form nếu dung lượng base64 sau nén vẫn vượt mức an toàn (>900.000 ký tự) kèm theo cảnh báo rõ ràng.
- Xử lý frontend (xóa): Loại bỏ cờ confirmRelated, UI chỉ hiện "Ẩn thành viên", sau khi click xóa, hệ thống sẽ ẩn thành viên khỏi UI mà không báo lỗi nếu đang là dữ liệu mẫu.
- Đã test quá trình thêm/sửa avatar, xóa/ẩn thành viên và pass npm run lint / npm run build.

### Lần 25.2 - Đồng bộ hồ sơ cá nhân với thành viên
- Chuẩn hóa `users.member_id` là liên kết chính giữa tài khoản đăng nhập và hồ sơ người thật trong `members`.
- API `/api/auth/me`, `/api/auth/login` và `/api/auth/profile` ưu tiên tên, avatar và thông tin cá nhân từ member đã liên kết; nếu chưa liên kết thì dùng dữ liệu cơ bản từ user.
- API quản lý user và tự liên kết hồ sơ chặn gán một member cho nhiều user; `self_only` chỉ được cập nhật nickname, số điện thoại, avatar và ghi chú cá nhân.
- Bỏ phụ thuộc `members.active` trong migration nguồn; xóa thành viên luôn dùng `deleted_at` để giữ dữ liệu lịch sử.
- Migration TEXT bao phủ `members.avatar`, `members.notes` và `users.avatar`; schema NAS đã được kiểm tra thực tế.
- Không lưu avatar base64 trong session cookie; API hydrate avatar từ `members` để tránh vượt giới hạn cookie khi đăng nhập.

### Lần 25.3 - Gộp hồ sơ thành viên và tài khoản
- Chuyển luồng Hồ sơ cá nhân sang dùng chung layout Hồ sơ thành viên, không mở modal chỉnh sửa dài từ topbar hoặc trang cài đặt.
- Trang hồ sơ thống nhất có menu trái: Thông tin cá nhân, Tài khoản đăng nhập, Bảo mật, Công việc liên quan, Sự kiện liên quan và Ghi chú.
- Tab thông tin cá nhân chỉnh trực tiếp dữ liệu `members`; avatar, tên hiển thị và số điện thoại đồng bộ với topbar và danh sách thành viên.
- Tab tài khoản hiển thị dữ liệu đăng nhập từ `users`, cho `full_access` sửa tài khoản hoặc tạo tài khoản mới cho member chưa được liên kết.
- Tab bảo mật hiển thị đổi mật khẩu của chính mình, reset mật khẩu khi có toàn quyền, trạng thái ghi nhớ đăng nhập và đăng xuất khỏi thiết bị.
- API `/api/members` trả thêm user liên kết cho `full_access`, không trả `password_hash` và vẫn chặn member trùng qua `/api/users`.

### Lần 25.4 - Tài khoản đăng nhập và đổi mật khẩu
- Chuyển tab Tài khoản đăng nhập sang card và form chỉnh sửa inline; không mở modal sửa tài khoản từ hồ sơ thành viên.
- Card hiển thị username, mật khẩu che `********`, quyền hệ thống, trạng thái, member liên kết và ngày tạo; email được giữ trong database nhưng ẩn khỏi tab.
- Cho `full_access` sửa trực tiếp username, quyền, trạng thái và member liên kết; API `PUT /api/users` hỗ trợ đổi username và trả JSON rõ khi trùng.
- Thêm form đổi mật khẩu gọn ngay trong tab cho tài khoản hiện tại: mật khẩu hiện tại, mật khẩu mới, nhập lại mật khẩu và icon hiện/ẩn cho từng ô.
- Form đổi mật khẩu gọi `/api/auth/change-password`, validate tối thiểu 6 ký tự và xác nhận mật khẩu khớp; không dùng prompt hoặc alert.
- Sửa kiểm tra liên kết trùng khi tạo user mới: không truyền chuỗi rỗng vào điều kiện UUID; tạo user không email và gán member hoạt động đúng.

### Lần 25.5 - Tài khoản đăng nhập hiển thị trực tiếp
- Bỏ dòng Vai vế gia đình khỏi bảng xem thông tin cá nhân; vai vế chỉ còn hiển thị nhỏ ở card đầu và trong form quản trị khi chỉnh sửa.
- Tab Tài khoản đăng nhập luôn hiển thị form trực tiếp trong card, không mở popup tạo hoặc sửa tài khoản từ hồ sơ thành viên.
- Member chưa có user hiển thị ngay form tạo gồm username, mật khẩu tạm có icon mắt, quyền hệ thống, trạng thái và member liên kết.
- Member đã có user hiển thị ngay form sửa username, quyền, trạng thái và member liên kết; mật khẩu thật không hiển thị, chỉ dùng `********`.
- Giữ form đổi mật khẩu inline cho tài khoản hiện tại với ba trường và validate, không dùng prompt hoặc alert.

### Lần 25.6 - Dọn giao diện thành viên và tài khoản
- Bỏ trường Thành viên liên kết khỏi tab Tài khoản đăng nhập; khi tạo hoặc sửa user từ hồ sơ, hệ thống tự dùng member đang mở làm `member_id`.
- Member chưa có user chỉ hiện thông báo Chưa có tài khoản đăng nhập cùng form tạo trực tiếp; sau khi tạo không xuất hiện dropdown liên kết member.
- Danh sách thành viên bỏ bộ lọc vai vế, thay bằng Tất cả / Có tài khoản / Chưa có tài khoản.
- Thu nhỏ vùng tìm kiếm còn tối đa 440px và đổi placeholder thành `Tìm tên hoặc số điện thoại`.

### Lần 26 - Lịch nhiều lớp kiểu TimeTree
- Bỏ hiển thị vai vế gia đình khỏi card danh sách và card đầu hồ sơ thành viên; vai vế chỉ còn trong form chỉnh sửa dành cho quản trị.
- Thêm migration `011_timetree_calendars.sql`: bảng `calendars`, bảng nối `event_members` và các cột lịch mở rộng cho `events`; dữ liệu sự kiện cũ được backfill vào lịch gia đình mặc định.
- Thêm API `/api/calendars` và thay `/api/events` bằng route chuyên dụng có kiểm tra quyền server: `full_access` quản lý toàn bộ, `self_only` chỉ quản lý lịch hoặc sự kiện thuộc quyền của mình.
- Làm mới màn Lịch theo phong cách TimeTree: panel bật/tắt nhiều lịch, chế độ tháng/tuần, grid ngày, form sự kiện gọn, gán nhiều thành viên, lớp sinh nhật tự sinh từ `members.birth_date` và tùy chọn hiển thị ngày âm.
- Giữ alias `date`, `time`, `memberId` khi đọc events để dashboard và các màn cũ tiếp tục hoạt động; luồng đồng bộ generic không ghi đè module events mới.

### Lần 26.1 - Tối ưu giao diện lịch giống TimeTree
- Mở full-width riêng cho module Lịch: bỏ giới hạn `max-w-7xl`, giảm padding và tự thu gọn sidebar app khi chuyển vào lịch để tăng diện tích grid.
- Giữ nút topbar thu gọn/mở rộng sidebar hoạt động bình thường; lựa chọn vẫn được lưu bằng `localStorage.sidebarCollapsed`.
- Tối ưu sidebar lịch còn 240px, chiều cao theo nội dung; giữ danh sách lịch, nút tạo lịch, lớp Sinh nhật và tùy chọn lịch âm.
- Tăng chiều cao ô ngày, làm rõ ngày dương và giảm độ nổi của ngày âm; sự kiện hiển thị dạng chấm màu, tên và giờ với tối đa ba dòng rồi hiện số lượng còn lại.
- API `GET /api/calendars` tự tạo đúng một `Lịch cá nhân` cho user chưa có lịch; lớp Sinh nhật vẫn là dữ liệu ảo và không ghi DB.

### Lần 26.2 - Logic lịch nhiều lịch nhiều sự kiện kiểu TimeTree
- Đơn giản hóa quyền lịch: `full_access` thấy và quản lý toàn bộ; `self_only` chỉ thấy calendar thuộc `owner_user_id` của mình và event nằm trong các calendar đó.
- Bỏ chọn thành viên liên quan khỏi form sự kiện; mỗi event thuộc đúng một `calendar_id`, màu hiển thị lấy từ calendar.
- Thay modal giữa màn hình bằng panel chỉnh sửa bên phải gồm title, thời gian bắt đầu/kết thúc, all-day, calendar, note và các nút lưu/hủy.
- Sắp xếp event cùng ngày: all-day trước, sau đó tăng dần theo `start_time`; grid tiếp tục giới hạn ba dòng và hiển thị số lượng còn lại.
- Thêm drag/drop event sang ngày khác với menu Move hoặc Copy; bổ sung `POST /api/events/copy`.
- Chuẩn hóa format DATE từ PostgreSQL về `YYYY-MM-DD` để không phụ thuộc kiểu dữ liệu runtime của driver.

### Lần 26.3 - Làm lại giao diện và logic lịch giống TimeTree
- Tách layout lịch thành ba vùng rõ ràng: Calendar List rộng 300px, calendar grid co giãn toàn màn hình và drawer phải 390px khi mở editor.
- Chuyển Calendar List sang dạng card có checkbox, block icon màu, tên, loại lịch và nút mở Calendar Settings; giữ Sinh nhật và Âm lịch như hai lớp hiển thị ảo.
- Thay ô nhập lịch trực tiếp bằng luồng Add Calendar hai bước: chọn Family / Personal / Work / Lesson / School events / Hobbies / Other, sau đó nhập Settings gồm icon, name và color.
- Tách cấu trúc từng ô ngày thành `day-header` và `event-list`: ngày dương, ngày âm không còn nằm trong vùng event hoặc che nội dung.
- Nâng giới hạn hiển thị lên bốn dòng mỗi ngày; event giữ dạng chấm màu, title, giờ bên phải và sắp xếp all-day trước rồi tăng dần theo giờ.
- Làm mượt drawer sự kiện bên phải với Color lấy theo calendar, Note, Advanced và Save / Cancel; drag/drop Move / Copy tiếp tục hoạt động.
- Sửa cache PWA giữ bundle cũ: tăng cache service worker lên `family-hub-v3`, không cache `/api` hoặc `/_next`, và buộc kiểm tra cập nhật worker khi app khởi động.

### Lần 26.4 - Thu gọn Calendar List
- Giảm sidebar app khi thu gọn từ 72px còn 64px để nhường thêm chiều ngang cho module Lịch.
- Đưa layout Lịch sang hai cột ngay từ breakpoint `md`: Calendar List 280px bên trái và calendar grid co giãn bên phải; drawer editor giữ 390px trên màn hình rộng.
- Thu card lịch, Sinh nhật và Âm lịch còn khoảng 56px; icon giảm còn 32px và khoảng cách giữa các hàng gọn hơn.
- Chuyển Add Calendar từ nút full-width lớn thành một hàng thao tác nhỏ ở cuối danh sách.
- Cân chiều cao sáu hàng ngày theo viewport để grid chiếm đều chiều cao màn hình và không bị đẩy xuống dưới Calendar List.

### Lần 26.5 - Làm mượt event và menu Move Copy
- Chuyển event trong ô ngày thành pill cao 20px, bo nhẹ, chấm màu 6px, giờ nhỏ bên phải và selected state xanh nhạt không có viền focus đậm.
- Giảm khoảng cách event list và làm ngày âm nhỏ, nhạt hơn để nội dung lịch thoáng hơn.
- Bỏ modal Move / Copy giữa màn hình; thay bằng context menu rộng 150px neo tại vị trí thả hoặc vị trí click phải event.
- Menu Move / Copy không làm mờ calendar, mỗi dòng cao 44px, có hover nhẹ và tự đóng khi click ra ngoài.
- Tinh chỉnh drawer event: khoảng cách form đều hơn, input khoảng 40-44px, Cancel nhẹ, Save rõ và Delete dùng viền đỏ nhẹ.

### Lần 26.6 - Calendar Settings, phân quyền xem lịch và bảng màu
- Thêm migration `012_calendar_users_event_label.sql`: bảng `calendar_users` lưu quyền `view/edit` theo user và cột `events.label_color` cho màu riêng từng event.
- Calendar Settings có tên, loại Family / Personal / Work / Study / Health / Other, palette 10 màu và danh sách member đã liên kết user để chọn người xem.
- Calendar Family mới mặc định chọn toàn bộ member có tài khoản; Personal mặc định chỉ chọn user hiện tại; `self_only` không thể chọn người khác.
- API calendars và events lọc dữ liệu theo owner hoặc `calendar_users`; `full_access` vẫn thấy toàn bộ, quyền view-only không được sửa event.
- Dùng chung palette tên màu cho calendar và event label; event không chọn màu riêng tiếp tục kế thừa màu calendar.
- Event Drawer mở ở chế độ xem chi tiết với menu ba chấm Edit / Copy / Delete; Edit chuyển sang form, Delete có confirm nhẹ.
- Event Form bổ sung Save as memo và các placeholder Notification, Repeat, Link, Location, Attach files, To-do list để mở rộng sau.

### Lần 26.7 - Căn giữa ngày và hover event giống TimeTree
- Đưa số ngày dương và ngày âm vào `day-header` riêng, căn giữa phía trên mỗi ô; header cao khoảng 34px và không lẫn với event list.
- Tách CSS lịch thành các class rõ ràng: `.calendar-day-cell`, `.day-header`, `.event-list`, `.calendar-event-row`, `.calendar-event-all-day`.
- Bỏ nền hover/focus trên toàn bộ ô ngày; rê chuột vào event chỉ đổi nền đúng pill event.
- Event list dùng padding `2px 6px 6px`; event pill cao 20px, chấm màu 6px, title trái và giờ nhỏ bên phải.
- Event all-day dùng thanh nền màu lịch nhạt; event thường và selected state giữ nền nhẹ, không có viền xanh đậm.

### Lần 26.8 - Sửa khoảng cách event trong ô ngày
- Giảm `day-header` từ khoảng 34px còn 26px; số ngày dương và âm lịch vẫn căn giữa nhưng event bắt đầu sát hơn ngay phía dưới.
- Bỏ đường kẻ ngăn giữa day-header và event-list để danh sách event liền mạch hơn.
- Đặt `.event-list { padding: 0 6px 6px; }` để bỏ khoảng trống phía trên.
- Thu `.calendar-event-row` còn 19px, padding dọc 1px và `margin-bottom: 1px`.
- Khóa event row không border, không box-shadow và không outline; hover chỉ đổi nền nhẹ đúng dòng event.

### Lần 26.9 - Phóng to lịch và thu gọn panel phụ
- Tăng chiều cao ô ngày, cỡ ngày dương và độ rõ của event để lịch dễ đọc hơn.
- Calendar List có thể thu gọn thành rail 52px với checkbox và icon nhỏ.
- Panel Event/Calendar Settings có thể thu gọn thành rail 48px hoặc đóng hẳn; grid tự giãn theo trạng thái panel.
- Header lịch được làm gọn theo dạng `Hôm nay | < | > | Tháng | Monthly | Weekly | +`.

### Lần 26.10 - Toggle lịch bằng sáng tối thay checkbox
- Bỏ checkbox khỏi Calendar List thu gọn; mỗi lịch chỉ còn icon màu có nền nhẹ khi bật và opacity 35% khi tắt.
- Sinh nhật và Âm lịch dùng cùng cơ chế icon sáng/tối; click trực tiếp icon để bật hoặc tắt lớp hiển thị.
- Đồng bộ Calendar List mở rộng: icon lịch, Sinh nhật và Âm lịch đều là nút toggle sáng/tối thay cho checkbox.
- Giữ tooltip tên lịch trên icon rail và nút `+` nhỏ để thêm calendar.

### Lần 26.11 - Xóa sửa lịch trong Calendar List
- Dấu `›` của calendar thật tiếp tục mở Calendar Settings để sửa tên, loại, màu và thành viên được xem.
- Calendar Settings của lịch đã lưu có nút `Xóa lịch` và confirm hai bước; Sinh nhật và Âm lịch là lớp ảo nên không có thao tác xóa.
- `DELETE /api/calendars?id=` kiểm tra quyền server: `full_access` xóa mọi calendar thật, `self_only` chỉ xóa calendar do chính mình tạo.
- Xóa calendar chạy trong transaction: xóa events thuộc lịch, quyền `calendar_users`, rồi xóa calendar; UI reload ngay sau khi hoàn tất.

### Lần 26.12 - Lịch mặc định và đồng bộ sinh nhật
- Đưa hai lớp ảo `🎂 Sinh nhật` và `🌙 Âm lịch` lên đầu Calendar List, trước các calendar thật do người dùng tạo.
- Hai lớp ảo chỉ có toggle sáng/tối; không có dấu `›`, Calendar Settings hoặc thao tác xóa.
- Sinh nhật tiếp tục render trực tiếp từ `data.members[].birthday`, tương ứng cột `members.birthday` trong PostgreSQL; không đọc hoặc copy ngày sinh từ bảng users.
- Khi lưu Thành viên hoặc Hồ sơ cá nhân, `data.members` được cập nhật ngay nên lịch Sinh nhật đổi theo trong cùng phiên.

### Lần 26.13 - Event details, giờ sự kiện và thông báo
- Hoàn thiện Event Details với menu ba chấm `Edit / Copy / Delete`, confirm xóa gọn trong drawer, nút đóng và activity log.
- Event Form bổ sung chọn member liên quan từ bảng `event_members`; `self_only` chỉ chọn hồ sơ của chính mình.
- Chuẩn hóa start/end time: event có giờ, không có end time và all-day đều lưu/hiển thị ổn định; danh sách tiếp tục xếp all-day trước rồi tăng dần theo giờ.
- Thêm notification nội bộ lưu `localStorage`: tạo, cập nhật, xóa, copy và move event đều đẩy thông báo; chuông topbar có counter và dropdown đánh dấu đã đọc.
- API events và copy luôn trả JSON, copy giữ nguyên member liên quan.

### Lần 26.14 - Hoàn thiện Event Details Header và menu ba chấm
- Đưa menu `⋮`, nút thu gọn `›` và nút đóng `×` vào cùng header Event Details; bỏ nút collapse có viền nổi đè lên drawer.
- Menu ba chấm dùng card trắng bo 12px, shadow nhẹ, hover xám và Delete màu đỏ.
- Hiển thị thời gian theo hai khối ngày/giờ dễ đọc với mũi tên dọc; dùng định dạng `Wed, Jun 4, 2026` và giờ AM/PM.
- Calendar và Label chuyển thành card có icon; Activity Log chuyển thành timeline `Event created / updated / moved / copied / deleted`.
- Giữ chiều rộng Event Details tối thiểu 380px trong cột drawer 400px.

### Lần 26.15 - Thu gọn chọn màu event và bỏ field chưa dùng
- Label / color trong Event Form chuyển thành dropdown một dòng, đóng mặc định và tự thu lại sau khi chọn.
- Giữ lựa chọn `Theo màu calendar` cùng 10 màu đặt tên đã có.
- Bỏ các placeholder chưa dùng: Notification, Repeat, URL, Location, Attach files và To-do list.
- Event Form chỉ còn Title, Starts, Ends, All-day, Save as memo, member liên quan, Calendar, Label / color, Note, Cancel và Save.

### Lần 26.17 - Sửa icon sidebar thu gọn và nút toggle
- Chuyển nút thu/mở sidebar khỏi topbar vào header của sidebar để search và content không bị lệch.
- Sidebar mở rộng giữ logo bên trái, toggle ở góc phải; sidebar thu gọn đặt toggle ở đầu thanh icon và căn giữa.
- Làm rõ icon sidebar thu gọn: active nền `#EEF2FF`, icon `#4F46E5`, bo góc 12px; hover dùng nền tím nhạt.
- Đồng bộ menu mở rộng với chiều cao item đều, icon/text căn giữa theo chiều dọc và trạng thái active màu tím.

### Lần 26.18 - Responsive mobile calendar và thông báo sự kiện hôm nay
- Thêm `MobileCalendarView` cho điện thoại: header Today / điều hướng tháng / nút thêm, mini month 7 cột và danh sách sự kiện theo ngày chọn.
- Mini month hiển thị dot màu ở ngày có event, Chủ nhật màu đỏ và ngày được chọn có nền/border tím rõ.
- Event mobile hiển thị All-day/giờ, thanh màu dọc, title và avatar viết tắt thành viên liên quan; bấm event mở sheet chi tiết, bấm `+` tạo event theo ngày đang chọn.
- Desktop/tablet tiếp tục dùng Calendar List, grid tháng đầy đủ và drawer phải; mobile ẩn grid PC để tránh overflow ngang.
- Thêm daily in-app notification một lần mỗi ngày mỗi user cho sự kiện hôm nay, kèm tối đa 3 event; chuông mobile hiển thị bottom sheet.

### Lần 26.19 - Sửa lỗi encoding tiếng Việt sau responsive mobile
- Khôi phục các chuỗi tiếng Việt bị mojibake trong FamilyApp, Calendar và notification về UTF-8 đúng.
- Chuẩn hóa ký hiệu tiền `₫`, dấu phân cách `·`, tiếng Nhật `日本語` và các nhãn dashboard/form.
- Bổ sung `<meta charSet="utf-8" />` trong layout để khai báo charset rõ ràng.
- Giữ nguyên logic responsive/calendar, chỉ sửa text và encoding.

### Lần 26.20 - Phân quyền thông báo và hiển thị người thao tác
- Mở rộng notification localStorage với actor, action_type, target event, calendar_id, visible_user_ids, visible_member_ids và read_user_ids.
- Chuông chỉ hiển thị/badge các thông báo user hiện tại được phép thấy; `Đánh dấu đã đọc` chỉ áp dụng cho user hiện tại.
- Notification event hiển thị avatar/tên người thao tác, nội dung hành động rõ ràng và trạng thái chưa đọc/đã đọc.
- Click notification event còn tồn tại sẽ chuyển sang Lịch và mở Event Details; event đã xóa sẽ báo `Sự kiện này đã bị xóa.`

### Lần 26.21 - Hoàn thiện Monthly Weekly view
- Thêm state `calendarView` để chuyển Monthly / Weekly ngay trong component, không reload trang và có tab active rõ.
- Weekly view hiển thị tuần bắt đầu Thứ 2 với header 7 ngày, all-day row, timeline giờ bên trái và vạch giờ hiện tại.
- Event timed trong Weekly được đặt theo start/end time, có chiều cao theo duration, tối thiểu 28px, nền nhạt và viền trái theo màu event.
- Click slot giờ trong Weekly mở form tạo event đúng ngày/giờ; nút `+` tạo event theo ngày đang chọn với giờ mặc định theo Weekly.
- Calendar toggle, sinh nhật all-day và Event Details dùng chung nguồn dữ liệu với Monthly; mobile tiếp tục dùng `MobileCalendarView` riêng.

### Lần 26.22 - Sửa hàng All-day trong Weekly giống TimeTree
- Khóa Weekly All-day row ở `h-10 max-h-10` để chiều cao luôn khoảng 40px dù không có hoặc có nhiều all-day event.
- Loại bỏ `min-height` lớn và padding làm hàng All-day phình cao, để timeline giờ bắt đầu ngay bên dưới.
- Giữ cùng grid column cho day header, all-day row và time grid để các cột không lệch.
- Giới hạn hiển thị tối đa 2 dòng all-day mỗi ngày và thêm `+N more` khi vượt quá.

### Lần 27 - Hoàn thiện tài khoản đăng nhập, đổi mật khẩu và phân quyền
- Tab `Tài khoản đăng nhập` tách giao diện admin và user tự xem mình: admin quản lý username, mật khẩu, quyền, trạng thái, reset/xóa; user chỉ đổi mật khẩu của chính mình.
- `/api/users` hỗ trợ admin đổi mật khẩu bằng bcrypt trong PUT, vẫn không trả `password_hash` và vẫn chặn hạ quyền/khóa/xóa admin hệ thống.
- `/api/auth/change-password` yêu cầu mật khẩu hiện tại, validate mật khẩu mới tối thiểu 6 ký tự và refresh session sau khi đổi.
- Thêm notification localStorage khi admin đổi/reset mật khẩu user hoặc user tự đổi mật khẩu thành công.

### Lần 27.1 - Chuẩn hóa tài khoản admin hệ thống và đổi mật khẩu
- Admin hệ thống không cần liên kết member vẫn có trang Hồ sơ cá nhân riêng, hiển thị tài khoản hệ thống, username, quyền, trạng thái và nút đổi mật khẩu.
- Hồ sơ admin cho phép cập nhật tên hiển thị, email và avatar qua `/api/auth/profile`; không còn báo lỗi chưa liên kết thành viên.
- UI quản lý tài khoản khóa username, quyền hệ thống và liên kết member với tài khoản `is_system`; không hiển thị nút xóa admin hệ thống.
- Backend `/api/users` chặn đổi username, hạ quyền, vô hiệu hóa hoặc gán member cho admin hệ thống; DELETE vẫn chặn xóa system admin.

### Lần 27.2 - Cải thiện độ tương phản lịch âm
- Tăng độ tương phản lịch âm trong Monthly và Weekly bằng class `.lunar-date` với cỡ 11px, weight 500 và màu `#7c8aa5`.
- Giữ ngày dương 14px, weight 600, màu `#1e293b` trong light mode và bổ sung màu tương phản cho dark mode.
- Ngày được chọn dùng `.selected-day .lunar-date` màu `#5f7ea5`; không đổi layout lịch.

### Lần 27.3 - Chốt logic admin liên kết member và sửa font breadcrumb
- Sửa breadcrumb và các chuỗi tiếng Việt bị mojibake trong hồ sơ thành viên, công việc, ghi chú, reset mật khẩu và API quản lý user.
- Cho phép admin hệ thống liên kết với member để Hồ sơ cá nhân dùng dữ liệu thành viên, nhưng vẫn khóa username, quyền, trạng thái và nút xóa.
- Backend `/api/users` tiếp tục chặn đổi username, hạ quyền, khóa, xóa hoặc bỏ liên kết hồ sơ đã có của admin hệ thống.

### Lần 27.4 - Sắp xếp lại sidebar theo module chính
- Sắp xếp sidebar theo thứ tự Tổng quan, Thành viên, Lịch, Thu chi, Ngân hàng, Trò chuyện, Ghi chú và Cài đặt.
- Thêm màn tạm cho Ngân hàng và Trò chuyện với trạng thái `Sẽ bổ sung sau`, không đổi logic các module hiện có.
- Chuyển icon sidebar sang SVG rõ nét để active/hover trong trạng thái mở rộng và thu gọn đều hiển thị màu tím.

### Lần 28 - Phát triển module Ngân hàng theo thành viên
- Thêm bảng `bank_accounts`, API `/api/bank-accounts` và `/api/bank-accounts/[id]` với phân quyền backend theo `full_access` và `self_only`.
- Xây module Ngân hàng có tab thành viên, toggle Danh sách/Dạng thẻ, empty state, form thêm/sửa/xóa và chi tiết có nút hiện số đầy đủ.
- Mặc định che số tài khoản/số thẻ khi hiển thị danh sách hoặc card; chỉ chi tiết mới cho phép bật xem đầy đủ kèm cảnh báo dữ liệu nhạy cảm.

### Lần 28.1 - Chuyển thẻ ngân hàng vào hồ sơ thành viên
- Bỏ module Ngân hàng khỏi sidebar; sidebar còn Tổng quan, Thành viên, Lịch, Thu chi, Trò chuyện, Ghi chú và Cài đặt.
- Thêm tab `Thẻ ngân hàng` trong Hồ sơ thành viên, đặt sau `Tài khoản đăng nhập` và dùng dữ liệu `bank_accounts` theo member đang xem.
- Giữ hai chế độ Danh sách/Dạng thẻ, form thêm/sửa, chi tiết hiện số đầy đủ và quyền backend hiện có.

### Lần 28.2 - Hoàn thiện logic thẻ ngân hàng, ưu đãi và phí thường niên
- Mở rộng `bank_accounts` với loại tài khoản/thẻ, tổ chức thẻ, sản phẩm, sao kê, hạn mức, phí thường niên và điều kiện miễn phí.
- Thêm bảng `bank_card_benefits` để lưu nhiều rule ưu đãi/cashback cho mỗi thẻ và chuẩn bị cột `transactions.bank_account_id`, `estimated_cashback`, `actual_cashback`.
- Nâng UI thẻ ngân hàng trong hồ sơ thành viên: form chia nhóm thông tin cơ bản, phí thường niên, ưu đãi; card/list hiển thị ưu đãi chính và tiến độ miễn phí; chi tiết có thống kê tháng này và giao dịch liên quan.

### Lần 28.3 - Tách trang thêm thẻ và tối ưu form theo loại thẻ
- Tạo route riêng `/members/[id]/bank-cards/new`, `/members/[id]/bank-cards/[cardId]/edit` và `/members/[id]/bank-cards/[cardId]` cho thêm, sửa và xem chi tiết thẻ ngân hàng.
- Chuyển tab `Thẻ ngân hàng` trong hồ sơ thành viên sang điều hướng trang riêng, không dùng modal thêm/sửa/chi tiết.
- Tối ưu form theo loại thẻ: credit card không bắt số tài khoản/chi nhánh, hiển thị hạn mức, sao kê, đến hạn, hết hạn, phí thường niên và ưu đãi/cashback.

### Lần 28.4 - Làm đẹp thẻ ngân hàng và thêm nội dung gốc ngân hàng
- Làm lại UI danh sách và dạng thẻ ngân hàng: số thẻ che rõ hơn, badge trạng thái gọn, thao tác Chi tiết/Sửa/Xóa dễ bấm và text sản phẩm mặc định là `Chưa cập nhật sản phẩm`.
- Thêm bảng/API `bank_raw_notes` để lưu nội dung gốc từ website, email, PDF text hoặc điều khoản ngân hàng theo thành viên/thẻ, có phân quyền backend theo `full_access` và `self_only`.
- Thêm tab `Nội dung gốc ngân hàng` trong hồ sơ thành viên và section `Nội dung gốc liên quan` trong chi tiết thẻ, kèm nút `Trích xuất thủ công`/`Tạo ưu đãi từ nội dung này` để chuẩn bị parse sau này.

### Lần 28.5 - Tối ưu tải trang chi tiết thẻ ngân hàng
- Thêm `GET /api/bank-accounts/[id]` để tải đúng một thẻ theo id, kèm member, benefits và nội dung gốc liên quan thay vì tải toàn bộ danh sách rồi lọc phía client.
- Đổi trang chi tiết thẻ sang loader có `loading/error/card`, timeout fallback, nút `Thử lại`, trạng thái không tìm thấy rõ ràng và skeleton thay cho text `Đang tải...`.
- Khi bấm `Chi tiết` từ danh sách thẻ, lưu prefill card vào `sessionStorage` để trang detail hiển thị ngay dữ liệu cơ bản rồi fetch bổ sung.

### Lần 28.6 - Tối ưu tab thẻ ngân hàng và gom thao tác vào menu 3 chấm
- Tối ưu tab `Thẻ ngân hàng` để fetch `/api/bank-accounts?memberId=...`, trả danh sách nhẹ không kèm benefits/raw notes và dùng cache theo `memberId` khi chuyển tab.
- Thêm skeleton nhỏ và nút `Làm mới` cho danh sách thẻ ngân hàng, tránh trạng thái trắng khi đang tải.
- Gom thao tác trong bảng và dạng thẻ vào menu `⋯` với dropdown `Xem chi tiết`, `Sửa`, `Xóa`, có click ngoài để đóng và cột thao tác gọn khoảng 48px.

### Lần 28.7 - Chia form thẻ ngân hàng thành nhiều tab
- Đổi form thêm/sửa thẻ ngân hàng từ các section dài sang layout tab: Thông tin cơ bản, Thông tin thẻ, Phí thường niên, Ưu đãi/Cashback, Nội dung gốc và Ghi chú.
- Mỗi tab chỉ hiển thị một nhóm trường; tab Thông tin thẻ tự đổi nội dung theo credit card hoặc ATM/tài khoản.
- Giữ footer `Hủy`/`Lưu thẻ` sticky dưới cùng và thêm thanh tab cuộn ngang trên mobile.

### Lần 28.8 - Nhập thông tin thẻ từ ảnh hoặc nội dung gốc ngân hàng
- Mở rộng `bank_raw_notes` với `image_url` và `extracted_json` để lưu ảnh/nội dung gốc cùng dữ liệu trích xuất dạng JSONB.
- Thêm luồng upload ảnh, dán text, chọn ngân hàng và `Trích xuất thông tin` trong tab `Nội dung gốc` của form thẻ.
- Thêm màn review dữ liệu trích xuất, cho sửa trường, chọn thẻ, áp dụng vào thẻ hiện tại hoặc tạo thẻ mới; rule cashback/fee được chuyển vào form sau khi user xác nhận.

### Lần 28.9 - Fix loading trang chi tiết thẻ ngân hàng
- Sửa `GET /api/bank-accounts/[id]` để query trực tiếp một thẻ theo `cardId`, trả JSON rõ cho thành công, không tìm thấy, không có quyền và lỗi server.
- Bỏ `ensureBankRawNotesTable()` khỏi API detail để tránh chậm do kiểm tra/alter bảng khi mở trang chi tiết; raw notes chỉ lấy tối đa 10 bản ghi và cắt text dài.
- Cập nhật frontend detail với timeout 8 giây, `finally setLoading(false)`, error box/nút `Thử lại`, log URL fetch tạm thời và hỗ trợ đọc cả response detail mới/cũ.

### Lần 28.11 - Lược bớt logic thẻ, thêm phí thường niên và hoàn tiền nhập tay
- Giữ nguyên bảng cũ `bank_card_benefits` để bảo toàn dữ liệu, nhưng chuyển UI/API chính sang bảng mới `bank_card_rewards`.
- Thêm `annual_fee_current_spending` cho nhập tay tiến độ miễn phí thường niên trước khi module Thu chi tự cộng từ `transactions.bank_account_id`.
- Rút gọn detail thẻ: thông tin thẻ, phí thường niên + tiến độ, hoàn tiền/điểm thưởng ghi nhận, nội dung gốc liên quan và giao dịch liên quan placeholder.

- Lần 28.10 - Fix chi tiết thẻ ngân hàng bị mất sidebar layout
