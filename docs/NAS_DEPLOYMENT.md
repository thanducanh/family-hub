# Triển khai Family Hub trên Synology NAS

## Yêu cầu

- Synology Container Manager đã được cài đặt.
- PostgreSQL NAS đang chạy tại `192.168.1.109:5433`.
- Database `family_management` và user `family_user` đã tồn tại.

## Chuẩn bị

Đưa toàn bộ mã nguồn Family Hub lên NAS, ví dụ:

```text
/volume1/docker/family-hub
```

Mở Terminal trên NAS hoặc dùng SSH:

```sh
cd /volume1/docker/family-hub
```

## Build và chạy container

```sh
docker compose -f docker-compose.family-app.yml up -d --build
```

Compose build image production bằng:

```sh
npm run build
npm run start
```

Ứng dụng được expose tại:

```text
http://<IP-NAS>:3000
```

Trong mạng nội bộ hiện tại:

```text
http://192.168.1.109:3000
```

## Kiểm tra

Kiểm tra health PostgreSQL:

```sh
curl http://192.168.1.109:3000/api/health
```

Xem log container:

```sh
docker compose -f docker-compose.family-app.yml logs -f family-hub
```

Khởi động lại:

```sh
docker compose -f docker-compose.family-app.yml restart family-hub
```

## Migration và backup

Chạy migration trước lần triển khai đầu nếu schema NAS chưa được cập nhật:

```sh
docker compose -f docker-compose.family-app.yml exec family-hub node database/run-migrations.mjs
```

Tạo backup JSON:

```sh
docker compose -f docker-compose.family-app.yml exec family-hub npm run db:backup
```

## Lưu ý bảo mật

- `DATABASE_URL` được truyền lúc container chạy, không được copy từ `.env.local` vào image.
- Nếu NAS được mở ra internet, đổi password database và đặt Family Hub sau reverse proxy HTTPS.
