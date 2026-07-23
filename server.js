const express = require('express');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 8080;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'gold.db');

// đảm bảo thư mục data tồn tại
fs.mkdirSync(DATA_DIR, { recursive: true });

// mở SQLite database
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Không mở được SQLite DB:', err);
  } else {
    console.log('SQLite DB mở tại', DB_PATH);
  }
});

// tạo bảng trades nếu chưa có
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS trades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trade_date TEXT NOT NULL,
      trade_type TEXT NOT NULL CHECK(trade_type IN ('Mua','Bán')),
      gold_type TEXT NOT NULL,
      unit TEXT NOT NULL CHECK(unit IN ('chỉ','lượng')),
      quantity REAL NOT NULL CHECK(quantity > 0),
      unit_price REAL NOT NULL CHECK(unit_price > 0),
      note TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// health endpoint cho k8s readiness/liveness
app.get('/api/health', (req, res) => {
  res.json({ ok: true, port: PORT, dbPath: DB_PATH });
});

// lấy danh sách giao dịch
app.get('/api/trades', (req, res) => {
  db.all(
    'SELECT * FROM trades ORDER BY trade_date DESC, id DESC',
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

// thêm giao dịch mới
app.post('/api/trades', (req, res) => {
  const { trade_date, trade_type, gold_type, unit, quantity, unit_price, note } = req.body;

  if (!trade_date || !trade_type || !gold_type || !unit || !quantity || !unit_price) {
    return res.status(400).json({ error: 'Thiếu dữ liệu bắt buộc.' });
  }

  const sql = `
    INSERT INTO trades (trade_date, trade_type, gold_type, unit, quantity, unit_price, note)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;
  const params = [
    trade_date,
    trade_type,
    gold_type.trim(),
    unit,
    Number(quantity),
    Number(unit_price),
    (note || '').trim()
  ];

  db.run(sql, params, function (err) {
    if (err) return res.status(500).json({ error: err.message });

    db.get('SELECT * FROM trades WHERE id = ?', [this.lastID], (err2, row) => {
      if (err2) return res.status(500).json({ error: err2.message });
      res.status(201).json(row);
    });
  });
});

// xóa 1 giao dịch theo id
app.delete('/api/trades/:id', (req, res) => {
  const id = Number(req.params.id);

  db.run('DELETE FROM trades WHERE id = ?', [id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (!this.changes) return res.status(404).json({ error: 'Không tìm thấy giao dịch.' });
    res.json({ ok: true });
  });
});

// xóa toàn bộ giao dịch
app.delete('/api/trades', (req, res) => {
  db.run('DELETE FROM trades', [], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ ok: true });
  });
});

// start server
app.listen(PORT, () => {
  console.log(`Gold Profit App running on http://localhost:${PORT}`);
  console.log(`SQLite DB: ${DB_PATH}`);
});