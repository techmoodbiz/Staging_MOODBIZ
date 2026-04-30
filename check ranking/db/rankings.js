const { getDatabase } = require('./schema');

// Sites operations
async function addSite(domain, name, gscUrl = null) {
  const db = await getDatabase();
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO sites (domain, name, gscUrl) VALUES (?, ?, ?)',
      [domain, name, gscUrl],
      function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
        db.close();
      }
    );
  });
}

async function getSites() {
  const db = await getDatabase();
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM sites ORDER BY createdAt DESC', (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
      db.close();
    });
  });
}

async function getSite(siteId) {
  const db = await getDatabase();
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM sites WHERE id = ?', [siteId], (err, row) => {
      if (err) reject(err);
      else resolve(row);
      db.close();
    });
  });
}

async function deleteSite(siteId) {
  const db = await getDatabase();
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM sites WHERE id = ?', [siteId], function(err) {
      if (err) reject(err);
      else resolve(this.changes);
      db.close();
    });
  });
}

// Keywords operations
async function addKeyword(siteId, keyword) {
  const db = await getDatabase();
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO keywords (siteId, keyword) VALUES (?, ?)',
      [siteId, keyword],
      function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
        db.close();
      }
    );
  });
}

async function getKeywords(siteId) {
  const db = await getDatabase();
  return new Promise((resolve, reject) => {
    db.all(
      'SELECT * FROM keywords WHERE siteId = ? ORDER BY createdAt DESC',
      [siteId],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
        db.close();
      }
    );
  });
}

async function deleteKeyword(keywordId) {
  const db = await getDatabase();
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM keywords WHERE id = ?', [keywordId], function(err) {
      if (err) reject(err);
      else resolve(this.changes);
      db.close();
    });
  });
}

// Rankings operations
async function addRanking(keywordId, position, url = null, clicks = 0, impressions = 0, ctr = 0) {
  const db = await getDatabase();
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO rankings (keywordId, position, url, clicks, impressions, ctr) VALUES (?, ?, ?, ?, ?, ?)',
      [keywordId, position, url, clicks, impressions, ctr],
      function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
        db.close();
      }
    );
  });
}

async function getLatestRankings(siteId) {
  const db = await getDatabase();
  return new Promise((resolve, reject) => {
    // Lấy ranking mới nhất của mỗi keyword
    const query = `
      SELECT k.id, k.keyword, s.domain, s.gscUrl,
             r.position, r.url, r.clicks, r.impressions, r.ctr, r.checkedAt
      FROM keywords k
      JOIN sites s ON k.siteId = s.id
      LEFT JOIN rankings r ON k.id = r.keywordId
        AND r.checkedAt = (
          SELECT MAX(r2.checkedAt) FROM rankings r2 WHERE r2.keywordId = k.id
        )
      WHERE s.id = ?
      ORDER BY
        CASE WHEN r.position IS NULL THEN 9999 ELSE r.position END ASC,
        k.keyword ASC
    `;
    db.all(query, [siteId], (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
      db.close();
    });
  });
}

async function getBestRankings(siteId) {
  const db = await getDatabase();
  return new Promise((resolve, reject) => {
    // Chỉ lấy bestPosition (MIN) — không dùng aggregate trong subquery WHERE (SQLite không hỗ trợ)
    const query = `
      SELECT k.id, k.keyword, MIN(r.position) AS bestPosition
      FROM keywords k
      LEFT JOIN rankings r ON k.id = r.keywordId AND r.position IS NOT NULL
      WHERE k.siteId = ?
      GROUP BY k.id, k.keyword
    `;
    db.all(query, [siteId], (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
      db.close();
    });
  });
}

async function getRankingHistory(keywordId, limit = 30) {
  const db = await getDatabase();
  return new Promise((resolve, reject) => {
    db.all(
      'SELECT * FROM rankings WHERE keywordId = ? ORDER BY checkedAt DESC LIMIT ?',
      [keywordId, limit],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
        db.close();
      }
    );
  });
}

async function updateSiteLastChecked(siteId) {
  const db = await getDatabase();
  return new Promise((resolve, reject) => {
    db.run(
      'UPDATE sites SET lastChecked = CURRENT_TIMESTAMP WHERE id = ?',
      [siteId],
      function(err) {
        if (err) reject(err);
        else resolve(this.changes);
        db.close();
      }
    );
  });
}

// ─── Users operations ─────────────────────────────────────────────────────────
async function addUser(email, name, passwordHash, role = 'member') {
  const db = await getDatabase();
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO users (email, name, password_hash, role) VALUES (?, ?, ?, ?)',
      [email.toLowerCase().trim(), name.trim(), passwordHash, role],
      function(err) {
        if (err) { reject(err); db.close(); return; }
        const newId = this.lastID;
        db.get('SELECT id, email, name, role, createdAt FROM users WHERE id = ?', [newId], (err2, row) => {
          db.close();
          if (err2) reject(err2);
          else resolve(row);
        });
      }
    );
  });
}

async function getUserByEmail(email) {
  const db = await getDatabase();
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT * FROM users WHERE email = ?',
      [email.toLowerCase().trim()],
      (err, row) => {
        if (err) reject(err);
        else resolve(row || null);
        db.close();
      }
    );
  });
}

async function getUserById(id) {
  const db = await getDatabase();
  return new Promise((resolve, reject) => {
    db.get('SELECT id, email, name, role, createdAt FROM users WHERE id = ?', [id], (err, row) => {
      if (err) reject(err);
      else resolve(row || null);
      db.close();
    });
  });
}

async function getUsers() {
  const db = await getDatabase();
  return new Promise((resolve, reject) => {
    db.all('SELECT id, email, name, role, createdAt FROM users ORDER BY createdAt ASC', (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
      db.close();
    });
  });
}

async function deleteUser(userId) {
  const db = await getDatabase();
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM users WHERE id = ?', [userId], function(err) {
      if (err) reject(err);
      else resolve(this.changes);
      db.close();
    });
  });
}

module.exports = {
  addSite,
  getSites,
  getSite,
  deleteSite,
  addKeyword,
  getKeywords,
  deleteKeyword,
  addRanking,
  getLatestRankings,
  getBestRankings,
  getRankingHistory,
  updateSiteLastChecked,
  addUser,
  getUserByEmail,
  getUserById,
  getUsers,
  deleteUser,
};
