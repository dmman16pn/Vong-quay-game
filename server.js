const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const QRCode = require('qrcode');

// Load .env khi chạy local
if (process.env.NODE_ENV !== 'production') {
  try { require('dotenv').config(); } catch {}
}

const { getDb } = require('./lib/db');

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// --- Routes tĩnh ---
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/spin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'spin.html'));
});

app.get('/admin/winners', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'spin.html'));
});

// --- API ---

// Lấy tất cả vòng quay
app.get('/api/wheels', async (req, res) => {
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
app.post('/api/wheels', async (req, res) => {
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

// Lấy một vòng quay
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
app.put('/api/wheels/:id', async (req, res) => {
  try {
    const db = await getDb();
    const existing = await db.collection('wheels').findOne({ id: req.params.id });
    if (!existing) return res.status(404).json({ error: 'Không tìm thấy vòng quay' });

    const update = {
      name: req.body.name ?? existing.name,
      description: req.body.description ?? existing.description,
      logo: req.body.logo ?? existing.logo,
      items: req.body.items ?? existing.items,
      settings: req.body.settings ?? existing.settings,
      active: req.body.active ?? existing.active
    };
    await db.collection('wheels').updateOne({ id: req.params.id }, { $set: update });
    res.json({ success: true, wheel: { ...update, id: req.params.id } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi cập nhật' });
  }
});

// Xoá vòng quay
app.delete('/api/wheels/:id', async (req, res) => {
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

// Ghi kết quả quay
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
app.get('/api/wheels/:id/stats', async (req, res) => {
  try {
    const db = await getDb();
    const wheel = await db.collection('wheels').findOne({ id: req.params.id });
    if (!wheel) return res.status(404).json({ error: 'Không tìm thấy vòng quay' });

    const history = wheel.history || [];
    const totalSpins = history.length;
    const resultCounts = {};
    const deviceCounts = {};
    history.forEach(h => {
      resultCounts[h.result] = (resultCounts[h.result] || 0) + 1;
      deviceCounts[h.deviceId] = (deviceCounts[h.deviceId] || 0) + 1;
    });
    res.json({
      totalSpins,
      resultCounts,
      uniqueDevices: Object.keys(deviceCounts).length,
      history: history.slice(-100)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi đọc thống kê' });
  }
});

// Tạo QR Code
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
