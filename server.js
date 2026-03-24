const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const QRCode = require('qrcode');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');

// Load .env khi chạy local
if (process.env.NODE_ENV !== 'production') {
  try { require('dotenv').config(); } catch {}
}

const { getDb } = require('./lib/db');

// === Cấu hình Auth ===
const JWT_SECRET   = process.env.JWT_SECRET   || 'vongquay-jwt-2025-secret';
const ADMIN_USER   = process.env.ADMIN_USER   || '0918100192';
const ADMIN_PASS   = process.env.ADMIN_PASS   || 'Tt17072021@@';

const app = express();

// Middleware
app.use(cors());
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// === Auth Middleware ===
function requireAuth(req, res, next) {
  const token = req.cookies?.admin_token;
  if (!token) {
    if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'Chưa đăng nhập' });
    return res.redirect('/login');
  }
  try {
    jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.clearCookie('admin_token');
    if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'Phiên đăng nhập hết hạn' });
    res.redirect('/login');
  }
}

// === Routes tĩnh ===

// Trang login (public)
app.get('/login', (req, res) => {
  const token = req.cookies?.admin_token;
  if (token) {
    try { jwt.verify(token, JWT_SECRET); return res.redirect('/'); } catch {}
  }
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Trang chủ admin (bảo vệ)
app.get('/', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Trang quay (PUBLIC - khách truy cập qua QR)
app.get('/spin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'spin.html'));
});

app.get('/admin/winners', requireAuth, (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'spin.html'));
});

// === Auth API ===

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    const token = jwt.sign({ admin: true }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie('admin_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 ngày
    });
    return res.json({ success: true });
  }
  res.status(401).json({ error: 'Sai tài khoản hoặc mật khẩu' });
});

app.post('/api/logout', (_req, res) => {
  res.clearCookie('admin_token');
  res.json({ success: true });
});

// === API (Protected) ===

// Lấy tất cả vòng quay
app.get('/api/wheels', requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    const wheels = await db.collection('wheels')
      .find({}, { projection: { history: 0, _id: 0 } })
      .toArray();
    res.json(wheels.map(w => ({ ...w, active: w.active !== false })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi đọc dữ liệu' });
  }
});

// Tạo vòng quay
app.post('/api/wheels', requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    const wheel = {
      id: uuidv4(),
      name: req.body.name || 'Vòng Quay May Mắn',
      description: req.body.description || '',
      logo: req.body.logo || '',
      items: req.body.items || [],
      settings: req.body.settings || {},
      createdAt: new Date().toISOString(),
      active: true,
      history: []
    };
    await db.collection('wheels').insertOne(wheel);
    const { _id, history, ...wheelData } = wheel;
    res.json({ success: true, wheel: wheelData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi tạo vòng quay' });
  }
});

// Lấy một vòng quay (PUBLIC - spin page cần)
app.get('/api/wheels/:id', async (req, res) => {
  try {
    const db = await getDb();
    const wheel = await db.collection('wheels').findOne(
      { id: req.params.id },
      { projection: { history: 0, _id: 0 } }
    );
    if (!wheel) return res.status(404).json({ error: 'Không tìm thấy vòng quay' });
    res.json(wheel);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi đọc dữ liệu' });
  }
});

// Cập nhật vòng quay
app.put('/api/wheels/:id', requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    const existing = await db.collection('wheels').findOne({ id: req.params.id });
    if (!existing) return res.status(404).json({ error: 'Không tìm thấy vòng quay' });

    const update = {
      name:        req.body.name        ?? existing.name,
      description: req.body.description ?? existing.description,
      logo:        req.body.logo        ?? existing.logo,
      items:       req.body.items       ?? existing.items,
      settings:    req.body.settings    ?? existing.settings,
      active:      req.body.active      ?? existing.active
    };
    await db.collection('wheels').updateOne({ id: req.params.id }, { $set: update });
    res.json({ success: true, wheel: { ...update, id: req.params.id } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi cập nhật' });
  }
});

// Xoá vòng quay
app.delete('/api/wheels/:id', requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    const result = await db.collection('wheels').deleteOne({ id: req.params.id });
    if (result.deletedCount === 0) return res.status(404).json({ error: 'Không tìm thấy vòng quay' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi xoá' });
  }
});

// Ghi kết quả quay (PUBLIC - spin page cần)
app.post('/api/spin-result', async (req, res) => {
  try {
    const { wheelId, result, timestamp, deviceId } = req.body;
    const db = await getDb();
    const r = await db.collection('wheels').updateOne(
      { id: wheelId },
      { $push: { history: {
        result,
        timestamp: timestamp || new Date().toISOString(),
        deviceId: deviceId || 'unknown'
      }}}
    );
    if (r.matchedCount === 0) return res.status(404).json({ error: 'Không tìm thấy vòng quay' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi ghi kết quả' });
  }
});

// Thống kê
app.get('/api/wheels/:id/stats', requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    const wheel = await db.collection('wheels').findOne({ id: req.params.id });
    if (!wheel) return res.status(404).json({ error: 'Không tìm thấy vòng quay' });

    const history = wheel.history || [];
    const totalSpins = history.length;
    const resultCounts = {};
    const deviceCounts = {};
    const today = new Date().toISOString().slice(0, 10);
    let todayCount = 0;

    history.forEach(h => {
      resultCounts[h.result] = (resultCounts[h.result] || 0) + 1;
      deviceCounts[h.deviceId] = (deviceCounts[h.deviceId] || 0) + 1;
      if (h.timestamp && h.timestamp.startsWith(today)) todayCount++;
    });

    res.json({
      totalSpins,
      resultCounts,
      uniqueDevices: Object.keys(deviceCounts).length,
      todayCount,
      firstSpin: history.length > 0 ? history[0].timestamp : null,
      lastSpin:  history.length > 0 ? history[history.length - 1].timestamp : null,
      history: history.slice(-100)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi đọc thống kê' });
  }
});

// Reset thống kê
app.post('/api/wheels/:id/reset-stats', requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    const result = await db.collection('wheels').updateOne(
      { id: req.params.id },
      { $set: { history: [] } }
    );
    if (result.matchedCount === 0) return res.status(404).json({ error: 'Không tìm thấy vòng quay' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi reset thống kê' });
  }
});

// Tạo QR Code (PUBLIC)
app.get('/api/qrcode/:id', async (req, res) => {
  try {
    const url = `${req.protocol}://${req.get('host')}/spin?id=${req.params.id}`;
    const qrDataUrl = await QRCode.toDataURL(url, {
      width: 256,
      margin: 2,
      color: { dark: '#1a1a2e', light: '#ffffff' }
    });
    res.json({ qr: qrDataUrl, url });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi tạo QR' });
  }
});

// Chạy local
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`🎰 Server chạy tại http://localhost:${PORT}`);
  });
}

module.exports = app;
