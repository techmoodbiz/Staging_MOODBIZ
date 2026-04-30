const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'rankings.db');

function initializeDatabase() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) { reject(err); return; }

      db.serialize(() => {
        db.run('PRAGMA journal_mode=WAL');

        // Sites
        db.run(`CREATE TABLE IF NOT EXISTS sites (
          id         INTEGER PRIMARY KEY AUTOINCREMENT,
          domain     TEXT UNIQUE NOT NULL,
          name       TEXT,
          gscUrl     TEXT,
          createdAt  DATETIME DEFAULT CURRENT_TIMESTAMP,
          lastChecked DATETIME
        )`);

        // Thêm cột gscUrl nếu chưa có (migration cho DB cũ)
        db.run(`ALTER TABLE sites ADD COLUMN gscUrl TEXT`, () => {});

        // Keywords
        db.run(`CREATE TABLE IF NOT EXISTS keywords (
          id        INTEGER PRIMARY KEY AUTOINCREMENT,
          siteId    INTEGER NOT NULL,
          keyword   TEXT NOT NULL,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(siteId) REFERENCES sites(id) ON DELETE CASCADE,
          UNIQUE(siteId, keyword)
        )`);

        // Rankings — có cả clicks, impressions, ctr từ GSC
        db.run(`CREATE TABLE IF NOT EXISTS rankings (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          keywordId   INTEGER NOT NULL,
          position    REAL,
          url         TEXT,
          clicks      INTEGER DEFAULT 0,
          impressions INTEGER DEFAULT 0,
          ctr         REAL DEFAULT 0,
          checkedAt   DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(keywordId) REFERENCES keywords(id) ON DELETE CASCADE
        )`);

        // Migration: thêm cột mới cho DB cũ
        db.run(`ALTER TABLE rankings ADD COLUMN clicks INTEGER DEFAULT 0`, () => {});
        db.run(`ALTER TABLE rankings ADD COLUMN impressions INTEGER DEFAULT 0`, () => {});
        db.run(`ALTER TABLE rankings ADD COLUMN ctr REAL DEFAULT 0`, () => {});
        db.run(`ALTER TABLE rankings ADD COLUMN url TEXT`, () => {});

        // Users — đăng nhập nội bộ
        db.run(`CREATE TABLE IF NOT EXISTS users (
          id            INTEGER PRIMARY KEY AUTOINCREMENT,
          email         TEXT UNIQUE NOT NULL,
          name          TEXT NOT NULL,
          password_hash TEXT NOT NULL,
          role          TEXT DEFAULT 'member',
          createdAt     DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (err) => {
          if (err) console.error('users table:', err);
          db.close();
          resolve();
        });
      });
    });
  });
}

function getDatabase() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) reject(err);
      else resolve(db);
    });
  });
}

module.exports = { initializeDatabase, getDatabase, DB_PATH };
