# Sao lưu PostgreSQL NAS

Các script tự đọc `DATABASE_URL` từ `.env.local`.

## Tạo backup

```powershell
npm.cmd run db:backup
```

File JSON có timestamp được tạo trong `database/backups`.

## Restore

Restore không tự chạy nếu thiếu file hoặc thiếu cờ `--confirm`.

```powershell
npm.cmd run db:restore -- database/backups/family-management-YYYY-MM-DDTHH-MM-SS-sssZ.json --confirm
```

Script restore dùng transaction và upsert theo `id`. Script không tự xóa các bản ghi NAS không có trong file backup.
