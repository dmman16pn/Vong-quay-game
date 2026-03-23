// ========================================
// Vòng Quay May Mắn - Trang Quản Lý
// ========================================

const API = '';
let currentStep = 1;
let editingWheelId = null;

const DEFAULT_COLORS = [
  '#ff3b30', '#ff9500', '#ffcc00', '#34c759',
  '#007aff', '#5856d6', '#af52de', '#ff2d55',
  '#5ac8fa', '#4cd964', '#ff6b6b', '#48dbfb'
];

// === INIT ===
document.addEventListener('DOMContentLoaded', () => {
  loadWheels();
});

// === LOAD WHEELS ===
async function loadWheels() {
  try {
    const res = await fetch(`${API}/api/wheels`);
    const wheels = await res.json();
    renderWheels(wheels);
  } catch (err) {
    console.error('Lỗi tải danh sách:', err);
  }
}

function renderWheels(wheels) {
  const grid = document.getElementById('wheelsGrid');
  const empty = document.getElementById('emptyState');

  if (wheels.length === 0) {
    grid.innerHTML = '';
    grid.appendChild(empty);
    empty.style.display = 'block';
    return;
  }

  empty.style.display = 'none';
  grid.innerHTML = wheels.map(w => {
    const date = new Date(w.createdAt).toLocaleDateString('vi-VN');
    const itemTags = w.items.slice(0, 5).map(i => {
      const thumb = i.image
        ? `<img src="${i.image}" class="tag-thumb">`
        : `<span class="color-dot" style="background:${i.color}"></span>`;
      return `<span class="item-tag">${thumb}${escHtml(i.name)}</span>`;
    }).join('');
    const moreTag = w.items.length > 5 ? `<span class="item-tag">+${w.items.length - 5}</span>` : '';

    return `
      <div class="wheel-card">
        <div class="card-header">
          <div class="card-title">${escHtml(w.name)}</div>
          <span class="card-status ${w.active ? 'active' : 'inactive'}">
            ${w.active ? '● Hoạt động' : '● Đã khoá'}
          </span>
        </div>
        <div class="card-meta">
          <span>🎁 ${w.items.length} phần thưởng</span>
          <span>📅 ${date}</span>
        </div>
        <div class="card-items">${itemTags}${moreTag}</div>
        <div class="card-actions">
          <button class="btn btn-sm btn-primary" onclick="openWheel('${w.id}')">▶ Mở</button>
          <button class="btn btn-sm btn-secondary" onclick="copyLink('${w.id}')">🔗 Copy</button>
          <button class="btn btn-sm btn-secondary" onclick="showQR('${w.id}')">📱 QR</button>
          <button class="btn btn-sm btn-secondary" onclick="editWheel('${w.id}')">✏️ Sửa</button>
          <button class="btn btn-sm btn-secondary" onclick="showStats('${w.id}')">📊</button>
          <button class="btn btn-sm btn-danger" onclick="deleteWheel('${w.id}','${escHtml(w.name)}')">🗑️</button>
        </div>
      </div>
    `;
  }).join('');
}

// === WIZARD ===
function openWizard(data = null) {
  editingWheelId = data ? data.id : null;
  document.getElementById('wizardModal').classList.add('show');
  currentStep = 1;
  updateStep(1);

  if (data) {
    document.getElementById('wheelName').value = data.name || '';
    document.getElementById('wheelDesc').value = data.description || '';
    document.getElementById('wheelLogo').value = data.logo || '';

    const list = document.getElementById('itemsList');
    list.innerHTML = '';
    data.items.forEach(item => addItem(item));

    if (data.settings) {
      const s = data.settings;
      document.getElementById('maxSpins').value = s.maxSpins || '';
      document.getElementById('spinDuration').value = s.spinDuration || '8';
      document.getElementById('allowRespin').checked = s.allowRespin !== false;
      document.getElementById('enableSound').checked = s.enableSound !== false;
      document.getElementById('bgColor1').value = s.bgColor1 || '#1a1a2e';
      document.getElementById('bgColor2').value = s.bgColor2 || '#16213e';
      document.getElementById('winMessage').value = s.winMessage || '🎉 Chúc mừng bạn đã trúng!';
      document.getElementById('endTime').value = s.endTime || '';
    }

    document.getElementById('createBtn').textContent = '💾 CẬP NHẬT';
  } else {
    // Reset form
    document.getElementById('wheelName').value = '';
    document.getElementById('wheelDesc').value = '';
    document.getElementById('wheelLogo').value = '';
    document.getElementById('itemsList').innerHTML = '';
    document.getElementById('maxSpins').value = '';
    document.getElementById('spinDuration').value = '8';
    document.getElementById('allowRespin').checked = true;
    document.getElementById('enableSound').checked = true;
    document.getElementById('bgColor1').value = '#1a1a2e';
    document.getElementById('bgColor2').value = '#16213e';
    document.getElementById('winMessage').value = '🎉 Chúc mừng bạn đã trúng!';
    document.getElementById('endTime').value = '';
    document.getElementById('createBtn').textContent = '✨ TẠO VÒNG QUAY';

    // Add 2 default items
    addItem({ name: '', percentage: 50, color: DEFAULT_COLORS[0], image: '' });
    addItem({ name: '', percentage: 50, color: DEFAULT_COLORS[1], image: '' });
  }
  updatePercentage();
}

function closeWizard() {
  document.getElementById('wizardModal').classList.remove('show');
  editingWheelId = null;
}

function updateStep(step) {
  currentStep = step;
  document.querySelectorAll('.wizard-step').forEach(s => s.classList.remove('active'));
  document.getElementById(`step${step}`).classList.add('active');

  document.querySelectorAll('.step-dot').forEach(d => {
    const s = parseInt(d.dataset.step);
    d.classList.remove('active', 'done');
    if (s === step) d.classList.add('active');
    else if (s < step) d.classList.add('done');
  });

  document.getElementById('progressFill').style.width = `${step * 25}%`;

  if (step === 4) renderPreview();
}

function nextStep(step) {
  if (currentStep === 1) {
    const name = document.getElementById('wheelName').value.trim();
    if (!name) {
      document.getElementById('wheelName').focus();
      showToast('⚠️ Vui lòng nhập tên chương trình!', '#ff9500');
      return;
    }
  }
  if (currentStep === 2) {
    const items = getItems();
    if (items.length < 2) {
      showToast('⚠️ Cần ít nhất 2 phần thưởng!', '#ff9500');
      return;
    }
    const empty = items.find(i => !i.name.trim());
    if (empty) {
      showToast('⚠️ Vui lòng nhập tên cho tất cả phần thưởng!', '#ff9500');
      return;
    }
  }
  updateStep(step);
}

function prevStep(step) {
  updateStep(step);
}

// === ITEMS MANAGEMENT ===
let itemCounter = 0;

function addItem(data = null) {
  const list = document.getElementById('itemsList');
  const items = list.querySelectorAll('.item-row');
  if (items.length >= 12) {
    showToast('⚠️ Tối đa 12 phần thưởng!', '#ff9500');
    return;
  }

  // Add header if first item
  if (items.length === 0) {
    const header = document.createElement('div');
    header.className = 'items-header';
    header.id = 'itemsHeader';
    header.innerHTML = '<span>Tên sản phẩm</span><span>Tỉ lệ %</span><span>Màu</span><span>Ảnh SP</span><span></span>';
    list.appendChild(header);
  }

  const idx = itemCounter++;
  const color = data?.color || DEFAULT_COLORS[items.length % DEFAULT_COLORS.length];
  const existingImage = data?.image || '';

  const row = document.createElement('div');
  row.className = 'item-row';
  row.id = `item-${idx}`;
  row.innerHTML = `
    <input type="text" placeholder="Tên phần thưởng" value="${escHtml(data?.name || '')}" data-field="name" oninput="updatePercentage()">
    <input type="number" min="0" max="100" step="1" value="${data?.percentage ?? 0}" data-field="percentage" oninput="updatePercentage()">
    <input type="color" value="${color}" data-field="color">
    <div class="image-upload-cell">
      <input type="file" accept="image/*" id="imgInput-${idx}" style="display:none" onchange="handleImageUpload(${idx}, this)">
      <input type="hidden" data-field="image" value="${escHtml(existingImage)}">
      <button type="button" class="btn-upload ${existingImage ? 'has-image' : ''}" onclick="document.getElementById('imgInput-${idx}').click()" id="uploadBtn-${idx}">
        ${existingImage ? `<img src="${existingImage}" class="img-thumb">` : '<span class="upload-icon">📷</span>'}
      </button>
      ${existingImage ? `<button type="button" class="btn-remove-img" onclick="removeImage(${idx})" title="Xoá ảnh">✕</button>` : ''}
    </div>
    <button class="btn-remove" onclick="removeItem(${idx})">🗑️</button>
  `;
  list.appendChild(row);
  updatePercentage();
}

function handleImageUpload(idx, input) {
  const file = input.files[0];
  if (!file) return;

  // Validate file size (max 2MB)
  if (file.size > 2 * 1024 * 1024) {
    showToast('⚠️ Ảnh quá lớn! Tối đa 2MB.', '#ff9500');
    input.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    // Resize image to max 200x200 for performance
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const maxSize = 200;
      let w = img.width;
      let h = img.height;

      if (w > maxSize || h > maxSize) {
        if (w > h) {
          h = (h / w) * maxSize;
          w = maxSize;
        } else {
          w = (w / h) * maxSize;
          h = maxSize;
        }
      }

      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      const row = document.getElementById(`item-${idx}`);
      if (!row) return;

      row.querySelector('[data-field="image"]').value = dataUrl;

      // Update button to show thumbnail
      const uploadBtn = document.getElementById(`uploadBtn-${idx}`);
      uploadBtn.classList.add('has-image');
      uploadBtn.innerHTML = `<img src="${dataUrl}" class="img-thumb">`;

      // Add remove button if not exists
      const cell = row.querySelector('.image-upload-cell');
      if (!cell.querySelector('.btn-remove-img')) {
        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'btn-remove-img';
        removeBtn.title = 'Xoá ảnh';
        removeBtn.textContent = '✕';
        removeBtn.onclick = () => removeImage(idx);
        cell.appendChild(removeBtn);
      }
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function removeImage(idx) {
  const row = document.getElementById(`item-${idx}`);
  if (!row) return;

  row.querySelector('[data-field="image"]').value = '';

  const uploadBtn = document.getElementById(`uploadBtn-${idx}`);
  uploadBtn.classList.remove('has-image');
  uploadBtn.innerHTML = '<span class="upload-icon">📷</span>';

  const cell = row.querySelector('.image-upload-cell');
  const removeBtn = cell.querySelector('.btn-remove-img');
  if (removeBtn) removeBtn.remove();

  // Clear file input
  const fileInput = document.getElementById(`imgInput-${idx}`);
  if (fileInput) fileInput.value = '';
}

function removeItem(idx) {
  const row = document.getElementById(`item-${idx}`);
  if (row) {
    row.remove();
    const remaining = document.querySelectorAll('#itemsList .item-row');
    if (remaining.length === 0) {
      const header = document.getElementById('itemsHeader');
      if (header) header.remove();
    }
  }
  updatePercentage();
}

function getItems() {
  const rows = document.querySelectorAll('#itemsList .item-row');
  return Array.from(rows).map(row => ({
    name: row.querySelector('[data-field="name"]').value.trim(),
    percentage: parseFloat(row.querySelector('[data-field="percentage"]').value) || 0,
    color: row.querySelector('[data-field="color"]').value,
    image: row.querySelector('[data-field="image"]').value || ''
  }));
}

function updatePercentage() {
  const items = getItems();
  const total = items.reduce((s, i) => s + i.percentage, 0);
  const el = document.getElementById('totalPercent');
  const counter = document.getElementById('percentCounter');

  el.textContent = total.toFixed(1);
  counter.classList.remove('warning', 'error', 'perfect');

  if (Math.abs(total - 100) < 0.01) {
    counter.classList.add('perfect');
  } else if (total > 100) {
    counter.classList.add('error');
  } else if (total > 0) {
    counter.classList.add('warning');
  }
}

// === PREVIEW ===
function renderPreview() {
  const items = getItems().filter(i => i.name);
  const canvas = document.getElementById('previewCanvas');
  const ctx = canvas.getContext('2d');
  const size = 300;
  const cx = size / 2;
  const cy = size / 2;
  const radius = 130;

  canvas.width = size;
  canvas.height = size;
  ctx.clearRect(0, 0, size, size);

  if (items.length < 2) {
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '14px "Be Vietnam Pro"';
    ctx.textAlign = 'center';
    ctx.fillText('Cần ít nhất 2 phần thưởng', cx, cy);
    return;
  }

  const sliceAngle = (2 * Math.PI) / items.length;

  // Draw slices first
  items.forEach((item, i) => {
    const startAngle = i * sliceAngle - Math.PI / 2;
    const endAngle = startAngle + sliceAngle;

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, startAngle, endAngle);
    ctx.closePath();
    ctx.fillStyle = item.color;
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Text
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(startAngle + sliceAngle / 2);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px "Be Vietnam Pro"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 2;

    const textRadius = radius * 0.65;
    const label = item.name.length > 10 ? item.name.slice(0, 9) + '…' : item.name;
    ctx.fillText(label, textRadius, 0);
    ctx.shadowBlur = 0;
    ctx.restore();
  });

  // Draw images on top of slices
  let imagesLoaded = 0;
  const totalImages = items.filter(i => i.image).length;

  items.forEach((item, i) => {
    if (!item.image) return;

    const img = new Image();
    img.onload = () => {
      const startAngle = i * sliceAngle - Math.PI / 2;
      const midAngle = startAngle + sliceAngle / 2;
      const imgR = radius * 0.38;
      const imgX = cx + Math.cos(midAngle) * imgR;
      const imgY = cy + Math.sin(midAngle) * imgR;
      const imgSize = Math.min(32, radius * 0.2);

      ctx.save();
      ctx.beginPath();
      ctx.arc(imgX, imgY, imgSize / 2 + 2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(imgX, imgY, imgSize / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(img, imgX - imgSize / 2, imgY - imgSize / 2, imgSize, imgSize);
      ctx.restore();

      imagesLoaded++;
      if (imagesLoaded === totalImages) drawPreviewCenter();
    };
    img.src = item.image;
  });

  // Center circle (draw immediately if no images)
  if (totalImages === 0) drawPreviewCenter();

  function drawPreviewCenter() {
    ctx.beginPath();
    ctx.arc(cx, cy, 28, 0, Math.PI * 2);
    ctx.fillStyle = '#1a1a2e';
    ctx.fill();
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.font = '20px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🎁', cx, cy);
  }

  // Preview info
  const info = document.getElementById('previewInfo');
  const name = document.getElementById('wheelName').value.trim();
  info.innerHTML = `<strong>${escHtml(name)}</strong> — ${items.length} phần thưởng`;
}

// === CREATE / UPDATE WHEEL ===
async function createWheel() {
  const items = getItems().filter(i => i.name);
  if (items.length < 2) {
    showToast('⚠️ Cần ít nhất 2 phần thưởng!', '#ff9500');
    return;
  }

  const name = document.getElementById('wheelName').value.trim();
  if (!name) {
    showToast('⚠️ Vui lòng nhập tên chương trình!', '#ff9500');
    return;
  }

  // Auto-normalize percentages if total != 100
  const total = items.reduce((s, i) => s + i.percentage, 0);
  if (total !== 100 && total > 0) {
    items.forEach(i => i.percentage = (i.percentage / total) * 100);
  } else if (total === 0) {
    const each = 100 / items.length;
    items.forEach(i => i.percentage = each);
  }

  const data = {
    name,
    description: document.getElementById('wheelDesc').value.trim(),
    logo: document.getElementById('wheelLogo').value.trim(),
    items,
    settings: {
      maxSpins: parseInt(document.getElementById('maxSpins').value) || 0,
      spinDuration: parseInt(document.getElementById('spinDuration').value) || 8,
      allowRespin: document.getElementById('allowRespin').checked,
      enableSound: document.getElementById('enableSound').checked,
      bgColor1: document.getElementById('bgColor1').value,
      bgColor2: document.getElementById('bgColor2').value,
      winMessage: document.getElementById('winMessage').value.trim() || '🎉 Chúc mừng bạn đã trúng!',
      endTime: document.getElementById('endTime').value || ''
    }
  };

  try {
    let res;
    if (editingWheelId) {
      res = await fetch(`${API}/api/wheels/${editingWheelId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
    } else {
      res = await fetch(`${API}/api/wheels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
    }

    const result = await res.json();
    if (result.success) {
      closeWizard();
      loadWheels();
      showToast(editingWheelId ? '✅ Đã cập nhật vòng quay!' : '✅ Đã tạo vòng quay thành công!');
    } else {
      showToast('❌ Lỗi: ' + (result.error || 'Không xác định'), '#ff3b30');
    }
  } catch (err) {
    showToast('❌ Lỗi kết nối server!', '#ff3b30');
  }
}

// === ACTIONS ===
function openWheel(id) {
  window.open(`/spin?id=${id}`, '_blank');
}

function copyLink(id) {
  const url = `${window.location.origin}/spin?id=${id}`;
  navigator.clipboard.writeText(url).then(() => {
    showToast('✅ Đã copy link!');
  }).catch(() => {
    prompt('Copy link:', url);
  });
}

async function editWheel(id) {
  try {
    const res = await fetch(`${API}/api/wheels/${id}`);
    const wheel = await res.json();
    if (wheel.error) {
      showToast('❌ Không tìm thấy vòng quay!', '#ff3b30');
      return;
    }
    openWizard(wheel);
  } catch (err) {
    showToast('❌ Lỗi tải dữ liệu!', '#ff3b30');
  }
}

async function deleteWheel(id, name) {
  if (!confirm(`Bạn có chắc muốn xoá "${name}"?`)) return;
  try {
    const res = await fetch(`${API}/api/wheels/${id}`, { method: 'DELETE' });
    const result = await res.json();
    if (result.success) {
      loadWheels();
      showToast('✅ Đã xoá vòng quay!');
    }
  } catch (err) {
    showToast('❌ Lỗi xoá!', '#ff3b30');
  }
}

async function showStats(id) {
  try {
    const res = await fetch(`${API}/api/wheels/${id}/stats`);
    const stats = await res.json();

    const content = document.getElementById('statsContent');
    const total = stats.totalSpins;

    let chartHtml = '';
    if (total > 0) {
      const sorted = Object.entries(stats.resultCounts).sort((a, b) => b[1] - a[1]);
      chartHtml = sorted.map(([name, count]) => {
        const pct = ((count / total) * 100).toFixed(1);
        return `
          <div class="chart-bar-row">
            <span class="chart-bar-label">${escHtml(name)}</span>
            <div class="chart-bar-track">
              <div class="chart-bar-fill" style="width:${pct}%">${count}</div>
            </div>
          </div>`;
      }).join('');
    }

    let historyHtml = '';
    if (stats.history && stats.history.length > 0) {
      const rows = stats.history.slice().reverse().slice(0, 50).map(h => {
        const t = new Date(h.timestamp).toLocaleString('vi-VN');
        return `<tr><td>${t}</td><td>${escHtml(h.result)}</td><td>${h.deviceId?.slice(0, 8) || '?'}…</td></tr>`;
      }).join('');
      historyHtml = `
        <div class="stats-history">
          <h3 style="margin-bottom:8px; color:rgba(255,255,255,0.6); font-size:0.9rem;">Lịch sử gần đây</h3>
          <table>
            <thead><tr><th>Thời gian</th><th>Kết quả</th><th>Thiết bị</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`;
    }

    content.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${total}</div>
          <div class="stat-label">Tổng lượt quay</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${stats.uniqueDevices}</div>
          <div class="stat-label">Thiết bị</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${Object.keys(stats.resultCounts).length}</div>
          <div class="stat-label">Loại giải</div>
        </div>
      </div>
      <div class="stats-chart">${chartHtml || '<p style="text-align:center;opacity:0.5">Chưa có dữ liệu quay</p>'}</div>
      ${historyHtml}
    `;

    document.getElementById('statsModal').classList.add('show');
  } catch (err) {
    showToast('❌ Lỗi tải thống kê!', '#ff3b30');
  }
}

function closeStats() {
  document.getElementById('statsModal').classList.remove('show');
}

async function showQR(id) {
  try {
    const res = await fetch(`${API}/api/qrcode/${id}`);
    const data = await res.json();
    const content = document.getElementById('qrContent');
    content.innerHTML = `
      <img src="${data.qr}" alt="QR Code">
      <div class="qr-url">${data.url}</div>
    `;
    document.getElementById('qrModal').classList.add('show');
  } catch (err) {
    showToast('❌ Lỗi tạo QR Code!', '#ff3b30');
  }
}

function closeQR() {
  document.getElementById('qrModal').classList.remove('show');
}

// === DEMO ===
async function createDemo() {
  const demoData = {
    name: '🎄 Vòng Quay Tết 2025',
    description: 'Quay và nhận quà siêu hấp dẫn từ chương trình khuyến mãi Tết!',
    logo: '',
    items: [
      { name: 'iPhone 16 Pro', percentage: 1, color: '#ff3b30', image: '' },
      { name: 'AirPods Pro', percentage: 5, color: '#ff9500', image: '' },
      { name: 'Voucher 500K', percentage: 10, color: '#ffcc00', image: '' },
      { name: 'Voucher 100K', percentage: 20, color: '#34c759', image: '' },
      { name: 'Balo thời trang', percentage: 14, color: '#007aff', image: '' },
      { name: 'Ly giữ nhiệt', percentage: 20, color: '#5856d6', image: '' },
      { name: 'Móc khoá', percentage: 15, color: '#af52de', image: '' },
      { name: 'Chúc may mắn', percentage: 15, color: '#ff2d55', image: '' }
    ],
    settings: {
      maxSpins: 3,
      spinDuration: 8,
      allowRespin: true,
      enableSound: true,
      bgColor1: '#1a1a2e',
      bgColor2: '#16213e',
      winMessage: '🎉 Chúc mừng bạn đã trúng thưởng! Liên hệ quầy lễ tân để nhận quà.',
      endTime: ''
    }
  };

  try {
    const res = await fetch(`${API}/api/wheels`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(demoData)
    });
    const result = await res.json();
    if (result.success) {
      loadWheels();
      showToast('✅ Đã tạo vòng quay demo!');
      openWheel(result.wheel.id);
    }
  } catch (err) {
    showToast('❌ Lỗi tạo demo!', '#ff3b30');
  }
}

// === UTILS ===
function escHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

function showToast(msg, color = '#34c759') {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.style.background = color;
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// Close modals on overlay click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.classList.remove('show');
    }
  });
});

// Keyboard shortcut
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.show').forEach(m => m.classList.remove('show'));
  }
});
