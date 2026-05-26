const express = require('express');
const cors    = require('cors');
const path    = require('path');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
require('dotenv').config();

const { initializeDatabase } = require('./db/schema');
const db = require('./db/rankings');

const app        = express();
const PORT       = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'moodbiz-rank-checker-secret-change-in-production';
const JWT_EXPIRE = '30d';

app.use(cors());
app.use(express.json());

// ─── Auth Middleware ──────────────────────────────────────────────────────────
function authMiddleware(req, res, next) {
  const header = req.headers['authorization'] || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Chưa đăng nhập' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Token không hợp lệ hoặc đã hết hạn' });
  }
}

function adminOnly(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Chỉ admin mới được thực hiện' });
  next();
}

// Serve dashboard
app.use(express.static(path.join(__dirname, 'client')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'client', 'index.html')));

// Serve debug simulator
app.use('/test', express.static(path.join(__dirname, 'test')));
app.get('/test', (req, res) => res.redirect('/test/simulator.html'));

// Init database
let dbReady = false;
initializeDatabase().then(() => {
  dbReady = true;
  console.log('✅ Database khởi tạo xong');
}).catch(err => {
  console.error('❌ Lỗi database:', err);
  process.exit(1);
});

// ─── Auth Routes (public) ─────────────────────────────────────────────────────
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email và mật khẩu là bắt buộc' });

    const user = await db.getUserByEmail(email);
    if (!user) return res.status(401).json({ error: 'Email hoặc mật khẩu không đúng' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Email hoặc mật khẩu không đúng' });

    const token = jwt.sign({ id: user.id, email: user.email, name: user.name, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRE });
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const user = await db.getUserById(req.user.id);
    if (!user) return res.status(404).json({ error: 'Người dùng không tồn tại' });
    res.json(user);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Admin: quản lý users
app.get('/api/auth/users', authMiddleware, adminOnly, async (req, res) => {
  try { res.json(await db.getUsers()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/auth/users', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { email, name, password, role } = req.body;
    if (!email || !name || !password) return res.status(400).json({ error: 'email, name, password là bắt buộc' });
    const hash = await bcrypt.hash(password, 10);
    const user = await db.addUser(email, name, hash, role || 'member');
    res.status(201).json(user);
  } catch (err) {
    if (err.message?.includes('UNIQUE')) return res.status(409).json({ error: 'Email đã tồn tại' });
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/auth/users/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    if (parseInt(req.params.id) === req.user.id) return res.status(400).json({ error: 'Không thể xóa chính mình' });
    await db.deleteUser(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Bảo vệ tất cả /api/* còn lại bằng auth ─────────────────────────────────
// /api/health và /api/check-queue/status miễn auth (extension popup dùng khi chưa login)
app.use('/api', (req, res, next) => {
  const PUBLIC = ['/health', '/check-queue/status'];
  if (PUBLIC.some(p => req.path === p || req.path.startsWith(p))) return next();
  authMiddleware(req, res, next);
});

// ─── Sites ────────────────────────────────────────────────────────────────────
app.get('/api/sites', async (req, res) => {
  try { res.json(await db.getSites()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/sites', async (req, res) => {
  try {
    const { domain, name } = req.body;
    if (!domain) return res.status(400).json({ error: 'Domain là bắt buộc' });
    // Chuẩn hóa domain: bỏ protocol, www, trailing slash
    const cleanDomain = domain.toLowerCase()
      .replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '').trim();
    const id = await db.addSite(cleanDomain, name || cleanDomain, null);
    res.status(201).json({ id, domain: cleanDomain, name: name || cleanDomain });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/sites/:id', async (req, res) => {
  try {
    const site = await db.getSite(req.params.id);
    if (!site) return res.status(404).json({ error: 'Không tìm thấy site' });
    res.json(site);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/sites/:id', async (req, res) => {
  try { await db.deleteSite(req.params.id); res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Keywords ─────────────────────────────────────────────────────────────────
app.get('/api/keywords/:siteId', async (req, res) => {
  try { res.json(await db.getKeywords(req.params.siteId)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/keywords', async (req, res) => {
  try {
    const { siteId, keyword } = req.body;
    if (!siteId || !keyword) return res.status(400).json({ error: 'siteId và keyword là bắt buộc' });
    const id = await db.addKeyword(siteId, keyword.trim());
    res.status(201).json({ id, siteId, keyword: keyword.trim() });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Thêm nhiều keywords cùng lúc (paste danh sách)
app.post('/api/keywords/bulk', async (req, res) => {
  try {
    const { siteId, keywords } = req.body;
    if (!siteId || !keywords?.length) return res.status(400).json({ error: 'siteId và keywords[] là bắt buộc' });
    const added = [];
    for (const kw of keywords) {
      const clean = kw.trim();
      if (!clean) continue;
      try {
        const id = await db.addKeyword(siteId, clean);
        added.push({ id, keyword: clean });
      } catch (_) { /* bỏ qua duplicate */ }
    }
    res.status(201).json({ added: added.length, keywords: added });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/keywords/:id', async (req, res) => {
  try { await db.deleteKeyword(req.params.id); res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Rankings (read-only) ─────────────────────────────────────────────────────
app.get('/api/rankings/:siteId', async (req, res) => {
  try { res.json(await db.getLatestRankings(req.params.siteId)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/history/:keywordId', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 30;
    res.json(await db.getRankingHistory(req.params.keywordId, limit));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/best-rankings/:siteId', async (req, res) => {
  try { res.json(await db.getBestRankings(req.params.siteId)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Chrome Extension Check Queue ────────────────────────────────────────────
const checkJobs = new Map();

function generateJobId() {
  return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Dashboard tạo job → extension xử lý
app.post('/api/check-queue', async (req, res) => {
  try {
    const { siteId } = req.body;
    if (!siteId) return res.status(400).json({ error: 'siteId required' });

    const site = await db.getSite(siteId);
    if (!site) return res.status(404).json({ error: 'Không tìm thấy site' });

    const keywords = await db.getKeywords(siteId);
    if (!keywords.length) return res.json({ message: 'Chưa có keyword nào', jobId: null });

    const jobId = generateJobId();
    checkJobs.set(jobId, {
      jobId,
      siteId: parseInt(siteId),
      domain: site.domain,
      total: keywords.length,
      pending: [...keywords],
      completed: [],
      createdAt: new Date().toISOString(),
    });

    console.log(`\n📋 Job: ${jobId} | ${keywords.length} keywords | ${site.domain}`);
    res.json({ jobId, total: keywords.length, domain: site.domain });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Extension badge + popup: trạng thái queue
app.get('/api/check-queue/status', (req, res) => {
  const jobs = [];
  for (const [, job] of checkJobs) {
    if (job.pending.length > 0) {
      jobs.push({ jobId: job.jobId, domain: job.domain, total: job.total, pending: job.pending.length, completed: job.completed.length });
    }
  }
  res.json({ pendingJobs: jobs.length, jobs });
});

// Extension lấy keyword tiếp theo
app.get('/api/check-queue/next', (req, res) => {
  for (const [, job] of checkJobs) {
    if (job.pending.length > 0) {
      const item = job.pending.shift();
      return res.json({ jobId: job.jobId, keywordId: item.id, keyword: item.keyword, domain: job.domain, siteId: job.siteId, remaining: job.pending.length, total: job.total });
    }
  }
  res.json(null);
});

// Extension gửi kết quả
app.post('/api/check-results', async (req, res) => {
  try {
    const { jobId, keywordId, keyword, position, url, error } = req.body;

    const job = checkJobs.get(jobId);
    if (job) {
      job.completed.push({ keywordId, keyword, position: position ?? null, url: url || null, error: error || null, checkedAt: new Date().toISOString() });
      if (job.pending.length === 0) {
        await db.updateSiteLastChecked(job.siteId);
        console.log(`✅ Job ${jobId} xong: ${job.completed.length}/${job.total}`);
        setTimeout(() => checkJobs.delete(jobId), 600000);
      }
    }

    if (keywordId) {
      await db.addRanking(parseInt(keywordId), position ?? null, url || null, 0, 0, 0);
      console.log(`  [${keyword}] → ${position != null ? '#' + position : '—'}${url ? ' | ' + url : ''}`);
    }

    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Dashboard theo dõi tiến trình job
app.get('/api/check-status/:jobId', (req, res) => {
  const job = checkJobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json({ jobId: job.jobId, domain: job.domain, total: job.total, pending: job.pending.length, completed: job.completed.length, done: job.completed.length >= job.total, results: job.completed });
});

// Hủy job
app.delete('/api/check-queue/:jobId', (req, res) => {
  checkJobs.delete(req.params.jobId);
  res.json({ ok: true });
});

// Dọn job cũ mỗi 30 phút
setInterval(() => {
  const cutoff = Date.now() - 3600000;
  for (const [jobId, job] of checkJobs) {
    if (new Date(job.createdAt).getTime() < cutoff) checkJobs.delete(jobId);
  }
}, 1800000);

// ─── Health ───────────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', dbReady, method: 'Chrome Extension', pendingJobs: checkJobs.size });
});

app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`\n🚀 Rank Checker: http://localhost:${PORT}\n`);
});

module.exports = app;
