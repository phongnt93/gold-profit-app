# Gold Profit App SQLite

App web cho 1 người dùng, lưu dữ liệu giao dịch vàng bằng SQLite.

## Database nằm ở đâu?

- Trong container: `/app/data/gold.db`
- Trên máy host khi dùng docker compose: `./data/gold.db`

## Chạy app

```bash
docker compose up --build -d
```

Mở trình duyệt tại:

- http://localhost:8080

## Dừng app

```bash
docker compose down
```

## Xem file database

```bash
ls -lh data/
```

## Mở SQLite shell trong container

```bash
docker exec -it gold-profit-app sh
```

Sau đó có thể cài sqlite client nếu cần, hoặc copy file DB ra ngoài để mở bằng DB Browser for SQLite.
