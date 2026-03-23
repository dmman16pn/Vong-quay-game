// ========================================
// Vòng Quay May Mắn - Trang Quay
// ========================================

let wheelData = null;
let isSpinning = false;
let currentRotation = 0;
let audioCtx = null;
let deviceId = null;
let preloadedImages = {}; // Cache for product images

// === INIT ===
document.addEventListener('DOMContentLoaded', async () => {
  createParticles();
  initDeviceId();

  const params = new URLSearchParams(window.location.search);
  const wheelId = params.get('id');

  if (!wheelId) {
    showError();
    return;
  }

  try {
    const res = await fetch(`/api/wheels/${wheelId}`);
    if (!res.ok) throw new Error('Not found');
    wheelData = await res.json();
    if (wheelData.error) throw new Error(wheelData.error);

    initWheel();
  } catch (err) {
    showError();
  }
});

function showError() {
  document.querySelector('.spin-app').style.display = 'none';
  document.getElementById('errorState').style.display = 'flex';
}

function initDeviceId() {
  deviceId = localStorage.getItem('wheel_device_id');
  if (!deviceId) {
    deviceId = 'dev-' + crypto.randomUUID();
    localStorage.setItem('wheel_device_id', deviceId);
  }
}

// === INIT WHEEL ===
function initWheel() {
  document.title = wheelData.name + ' - Vòng Quay May Mắn';
  document.getElementById('spinTitle').textContent = wheelData.name;
  document.getElementById('spinDesc').textContent = wheelData.description || '';

  if (wheelData.logo) {
    const logoEl = document.getElementById('spinLogo');
    logoEl.src = wheelData.logo;
    logoEl.style.display = 'block';
    logoEl.onerror = () => { logoEl.style.display = 'none'; };
  }

  // Background
  if (wheelData.settings?.bgColor1) {
    document.body.style.background = `linear-gradient(135deg, ${wheelData.settings.bgColor1} 0%, ${wheelData.settings.bgColor2 || wheelData.settings.bgColor1} 100%)`;
  }

  // Countdown
  if (wheelData.settings?.endTime) {
    initCountdown(wheelData.settings.endTime);
  }

  updateSpinCounter();

  // Preload product images, then draw
  preloadProductImages(() => {
    drawWheel();
  });
}

// Preload all product images for smooth rendering
function preloadProductImages(callback) {
  const items = wheelData.items;
  let remaining = 0;

  items.forEach((item, i) => {
    if (item.image) {
      remaining++;
      const img = new Image();
      img.onload = () => {
        preloadedImages[i] = img;
        remaining--;
        if (remaining === 0) callback();
      };
      img.onerror = () => {
        remaining--;
        if (remaining === 0) callback();
      };
      img.src = item.image;
    }
  });

  if (remaining === 0) callback();
}

// === DRAW WHEEL ===
function drawWheel(rotation = 0) {
  const canvas = document.getElementById('wheelCanvas');
  const ctx = canvas.getContext('2d');
  const items = wheelData.items;
  const n = items.length;

  // Responsive size
  const containerWidth = Math.min(window.innerWidth - 40, 500);
  const size = containerWidth;
  canvas.width = size;
  canvas.height = size;
  canvas.style.width = size + 'px';
  canvas.style.height = size + 'px';

  const cx = size / 2;
  const cy = size / 2;
  const outerRadius = size / 2 - 12;
  const sliceAngle = (2 * Math.PI) / n;

  ctx.clearRect(0, 0, size, size);

  // Outer decorative ring
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, outerRadius + 8, 0, Math.PI * 2);
  const ringGrad = ctx.createLinearGradient(0, 0, size, size);
  ringGrad.addColorStop(0, '#ffd700');
  ringGrad.addColorStop(0.5, '#ffaa00');
  ringGrad.addColorStop(1, '#ffd700');
  ctx.strokeStyle = ringGrad;
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.restore();

  // Decorative bulbs on outer ring
  const bulbCount = Math.max(n * 4, 24);
  for (let i = 0; i < bulbCount; i++) {
    const angle = (i / bulbCount) * Math.PI * 2 - Math.PI / 2;
    const bx = cx + Math.cos(angle) * (outerRadius + 8);
    const by = cy + Math.sin(angle) * (outerRadius + 8);
    ctx.beginPath();
    ctx.arc(bx, by, 3.5, 0, Math.PI * 2);

    // Alternating colors with glow effect
    if (i % 3 === 0) {
      ctx.fillStyle = '#ffd700';
      ctx.shadowColor = '#ffd700';
    } else if (i % 3 === 1) {
      ctx.fillStyle = '#fff';
      ctx.shadowColor = '#fff';
    } else {
      ctx.fillStyle = '#ff6b6b';
      ctx.shadowColor = '#ff6b6b';
    }
    ctx.shadowBlur = 6;
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotation);

  // Draw slices
  items.forEach((item, i) => {
    const startAngle = i * sliceAngle - Math.PI / 2;
    const endAngle = startAngle + sliceAngle;

    // Slice fill with slight gradient
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, outerRadius, startAngle, endAngle);
    ctx.closePath();

    // Create radial gradient for each slice
    const midAngle = startAngle + sliceAngle / 2;
    const gx = Math.cos(midAngle) * outerRadius * 0.5;
    const gy = Math.sin(midAngle) * outerRadius * 0.5;
    const sliceGrad = ctx.createRadialGradient(0, 0, outerRadius * 0.1, gx, gy, outerRadius);
    sliceGrad.addColorStop(0, lightenColor(item.color, 20));
    sliceGrad.addColorStop(1, item.color);
    ctx.fillStyle = sliceGrad;
    ctx.fill();

    // Slice border
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Inner shadow line for depth
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(startAngle) * outerRadius, Math.sin(startAngle) * outerRadius);
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // === TEXT & IMAGE RENDERING ===
    ctx.save();
    ctx.rotate(startAngle + sliceAngle / 2);

    // Font sizing based on number of items
    let fontSize;
    if (n <= 4) fontSize = Math.min(17, outerRadius * 0.085);
    else if (n <= 6) fontSize = Math.min(15, outerRadius * 0.07);
    else if (n <= 8) fontSize = Math.min(13, outerRadius * 0.06);
    else fontSize = Math.min(11, outerRadius * 0.05);
    fontSize = Math.max(10, fontSize);

    const hasImage = preloadedImages[i];
    const imgSize = n <= 4 ? 42 : n <= 6 ? 36 : n <= 8 ? 30 : 24;

    if (hasImage) {
      // Draw product image (circular, with white border)
      const imgCenterX = outerRadius * 0.38;
      const imgCenterY = 0;
      const imgR = imgSize / 2;

      // White circle background
      ctx.beginPath();
      ctx.arc(imgCenterX, imgCenterY, imgR + 2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.shadowColor = 'rgba(0,0,0,0.3)';
      ctx.shadowBlur = 4;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Clip and draw image
      ctx.save();
      ctx.beginPath();
      ctx.arc(imgCenterX, imgCenterY, imgR, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(hasImage, imgCenterX - imgR, imgCenterY - imgR, imgSize, imgSize);
      ctx.restore();

      // Draw text below/after image
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `700 ${fontSize}px "Be Vietnam Pro", "Segoe UI", sans-serif`;

      const textX = outerRadius * 0.7;
      let displayText = item.name;
      const maxW = outerRadius * 0.35;
      while (ctx.measureText(displayText).width > maxW && displayText.length > 1) {
        displayText = displayText.slice(0, -1);
      }
      if (displayText !== item.name) displayText += '…';
      ctx.fillText(displayText, textX, 0);
    } else {
      // No image - draw text only (centered in slice)
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `700 ${fontSize}px "Be Vietnam Pro", "Segoe UI", sans-serif`;

      const textX = outerRadius * 0.58;
      let displayText = item.name;
      const maxW = outerRadius * 0.55;
      while (ctx.measureText(displayText).width > maxW && displayText.length > 1) {
        displayText = displayText.slice(0, -1);
      }
      if (displayText !== item.name) displayText += '…';
      ctx.fillText(displayText, textX, 0);
    }

    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.restore();
  });

  // Outer ring on top of slices
  ctx.beginPath();
  ctx.arc(0, 0, outerRadius, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Center circle - larger and more decorative
  const centerR = Math.max(28, outerRadius * 0.14);

  // Center shadow
  ctx.beginPath();
  ctx.arc(0, 0, centerR + 4, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fill();

  // Center gradient
  ctx.beginPath();
  ctx.arc(0, 0, centerR, 0, Math.PI * 2);
  const cGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, centerR);
  cGrad.addColorStop(0, '#3a3a5a');
  cGrad.addColorStop(0.7, '#2a2a4a');
  cGrad.addColorStop(1, '#1a1a2e');
  ctx.fillStyle = cGrad;
  ctx.fill();

  // Center ring
  ctx.beginPath();
  ctx.arc(0, 0, centerR, 0, Math.PI * 2);
  const centerRingGrad = ctx.createLinearGradient(-centerR, -centerR, centerR, centerR);
  centerRingGrad.addColorStop(0, '#ffd700');
  centerRingGrad.addColorStop(0.5, '#ffaa00');
  centerRingGrad.addColorStop(1, '#ffd700');
  ctx.strokeStyle = centerRingGrad;
  ctx.lineWidth = 3;
  ctx.stroke();

  // Inner ring
  ctx.beginPath();
  ctx.arc(0, 0, centerR - 5, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,215,0,0.3)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Center icon
  ctx.font = `${centerR * 0.9}px "Segoe UI Emoji", "Apple Color Emoji", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(255,215,0,0.5)';
  ctx.shadowBlur = 10;
  ctx.fillText('🎁', 0, 2);
  ctx.shadowBlur = 0;

  ctx.restore();
}

// Helper: lighten a hex color
function lightenColor(hex, percent) {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.min(255, (num >> 16) + amt);
  const G = Math.min(255, ((num >> 8) & 0x00FF) + amt);
  const B = Math.min(255, (num & 0x0000FF) + amt);
  return `rgb(${R},${G},${B})`;
}

// === SPIN LOGIC ===
function spinWheel(items) {
  const random = Math.random() * 100;
  let cumulative = 0;
  for (const item of items) {
    cumulative += item.percentage;
    if (random <= cumulative) return item;
  }
  return items[items.length - 1];
}

function startSpin() {
  if (isSpinning) return;

  // Check spins remaining
  const maxSpins = wheelData.settings?.maxSpins || 0;
  if (maxSpins > 0) {
    const spinData = getSpinData();
    if (spinData.spinsUsed >= maxSpins) {
      showNoSpinsPopup();
      return;
    }
  }

  isSpinning = true;
  const btn = document.getElementById('spinBtn');
  btn.disabled = true;
  btn.querySelector('.spin-btn-text').textContent = 'ĐANG QUAY...';
  btn.querySelector('.spin-btn-icon').textContent = '⏳';

  const container = document.getElementById('wheelContainer');
  const glow = document.getElementById('outerGlow');
  container.classList.add('spinning');
  glow.classList.add('spinning');

  // Determine result
  const result = spinWheel(wheelData.items);
  const resultIndex = wheelData.items.indexOf(result);

  // Calculate target angle
  const n = wheelData.items.length;
  const sliceAngle = 360 / n;
  const targetSliceCenter = resultIndex * sliceAngle + sliceAngle / 2;
  const stopAngle = 360 - targetSliceCenter;

  const fullRotations = (5 + Math.floor(Math.random() * 4)) * 360;
  const totalRotation = currentRotation + fullRotations + (stopAngle - (currentRotation % 360) + 360) % 360;

  const duration = (wheelData.settings?.spinDuration || 8) * 1000;

  // Sound
  if (wheelData.settings?.enableSound !== false) {
    startTickSound(duration);
  }

  // Animate
  const startTime = performance.now();
  const startRotation = currentRotation;
  const rotationDelta = totalRotation - startRotation;

  function animate(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // Improved easing - exponential ease out for more dramatic slowdown
    const eased = 1 - Math.pow(1 - progress, 4);

    currentRotation = startRotation + rotationDelta * eased;
    drawWheel(currentRotation * Math.PI / 180);

    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      // Spin complete
      currentRotation = totalRotation;
      isSpinning = false;
      btn.disabled = false;
      btn.querySelector('.spin-btn-text').textContent = 'QUAY NGAY!';
      btn.querySelector('.spin-btn-icon').textContent = '🎰';
      container.classList.remove('spinning');
      glow.classList.remove('spinning');

      // Record spin
      recordSpin(result);
      updateSpinCounter();

      // Show result with slight delay for dramatic effect
      setTimeout(() => showWinPopup(result), 400);
    }
  }

  requestAnimationFrame(animate);
}

// === SPIN DATA (localStorage) ===
function getSpinData() {
  const key = `wheel_spins_${wheelData.id}`;
  const raw = localStorage.getItem(key);
  if (raw) {
    try {
      const data = JSON.parse(raw);
      const today = new Date().toISOString().slice(0, 10);
      if (data.date === today) return data;
    } catch {}
  }
  return { spinsUsed: 0, date: new Date().toISOString().slice(0, 10) };
}

function saveSpinData(data) {
  const key = `wheel_spins_${wheelData.id}`;
  localStorage.setItem(key, JSON.stringify(data));
}

function updateSpinCounter() {
  const maxSpins = wheelData.settings?.maxSpins || 0;
  const counter = document.getElementById('spinCounter');
  const btn = document.getElementById('spinBtn');

  if (maxSpins > 0) {
    const data = getSpinData();
    const left = Math.max(0, maxSpins - data.spinsUsed);
    document.getElementById('spinsLeft').textContent = left;
    document.getElementById('spinsTotal').textContent = maxSpins;
    counter.style.display = 'block';

    if (left <= 0) {
      btn.disabled = true;
      btn.querySelector('.spin-btn-text').textContent = 'HẾT LƯỢT';
      btn.querySelector('.spin-btn-icon').textContent = '😔';
    }
  } else {
    counter.style.display = 'none';
  }
}

async function recordSpin(result) {
  const maxSpins = wheelData.settings?.maxSpins || 0;
  if (maxSpins > 0) {
    const data = getSpinData();
    data.spinsUsed++;
    saveSpinData(data);
  }

  try {
    await fetch('/api/spin-result', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        wheelId: wheelData.id,
        result: result.name,
        timestamp: new Date().toISOString(),
        deviceId
      })
    });
  } catch (err) {
    console.warn('Failed to record spin:', err);
  }
}

// === WIN POPUP ===
function showWinPopup(result) {
  const popup = document.getElementById('winPopup');

  // Reset title in case it was changed by showNoSpinsPopup
  document.getElementById('popupTitle').textContent = '🎉 CHÚC MỪNG! 🎉';

  // Show prize with image if available
  const prizeEl = document.getElementById('popupPrize');
  if (result.image) {
    prizeEl.innerHTML = `<img src="${result.image}" class="prize-image"><div class="prize-name">${escHtml(result.name)}</div>`;
  } else {
    prizeEl.innerHTML = `<div class="prize-name">🎁 ${escHtml(result.name)}</div>`;
  }
  document.getElementById('popupMessage').textContent = wheelData.settings?.winMessage || '🎉 Chúc mừng bạn đã trúng!';

  // Show claim guide
  document.querySelector('.claim-guide').style.display = 'block';

  const respinBtn = document.getElementById('respinBtn');
  const noSpinsMsg = document.getElementById('noSpinsMsg');
  const maxSpins = wheelData.settings?.maxSpins || 0;

  let canRespin = wheelData.settings?.allowRespin !== false;
  if (maxSpins > 0) {
    const data = getSpinData();
    if (data.spinsUsed >= maxSpins) {
      canRespin = false;
      noSpinsMsg.style.display = 'block';
    } else {
      noSpinsMsg.style.display = 'none';
    }
  } else {
    noSpinsMsg.style.display = 'none';
  }

  respinBtn.style.display = canRespin ? 'inline-flex' : 'none';

  popup.classList.add('show');

  // Confetti
  createConfetti();

  // Win sound
  if (wheelData.settings?.enableSound !== false) {
    playWinSound();
  }

  popup.dataset.result = result.name;
}

function closePopup() {
  document.getElementById('winPopup').classList.remove('show');
}

function closePopupAndRespin() {
  closePopup();
  updateSpinCounter();
  setTimeout(() => {
    const btn = document.getElementById('spinBtn');
    if (!btn.disabled) startSpin();
  }, 400);
}

function showNoSpinsPopup() {
  const popup = document.getElementById('winPopup');
  document.getElementById('popupTitle').textContent = '😔 Hết lượt!';
  document.getElementById('popupPrize').textContent = 'Bạn đã hết lượt quay hôm nay';
  document.getElementById('popupMessage').textContent = 'Hãy quay lại vào ngày mai nhé!';
  document.getElementById('respinBtn').style.display = 'none';
  document.getElementById('noSpinsMsg').style.display = 'none';
  document.querySelector('.claim-guide').style.display = 'none';
  popup.classList.add('show');
}

// === CONFETTI ===
function createConfetti() {
  const container = document.getElementById('confettiContainer');
  container.innerHTML = '';
  const colors = ['#ff3b30', '#ff9500', '#ffcc00', '#34c759', '#007aff', '#5856d6', '#ff2d55', '#ffd700', '#fff'];

  for (let i = 0; i < 80; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.left = Math.random() * 100 + '%';
    piece.style.background = colors[Math.floor(Math.random() * colors.length)];

    const size = Math.random() * 8 + 4;
    piece.style.width = size + 'px';

    // Various shapes
    const shapeRoll = Math.random();
    if (shapeRoll < 0.33) {
      piece.style.height = size + 'px';
      piece.style.borderRadius = '50%';
    } else if (shapeRoll < 0.66) {
      piece.style.height = (size * 0.6) + 'px';
      piece.style.borderRadius = '2px';
    } else {
      piece.style.height = (size * 1.5) + 'px';
      piece.style.borderRadius = '1px';
    }

    piece.style.animationDuration = (Math.random() * 2.5 + 1.5) + 's';
    piece.style.animationDelay = (Math.random() * 0.8) + 's';
    piece.style.opacity = Math.random() * 0.4 + 0.6;
    container.appendChild(piece);
  }

  setTimeout(() => { container.innerHTML = ''; }, 5000);
}

// === AUDIO (Web Audio API) ===
function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

function playTick() {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 600 + Math.random() * 600;
    osc.type = 'triangle';
    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.04);
  } catch {}
}

function startTickSound(duration) {
  const startTime = performance.now();
  let lastTick = 0;

  function tick(now) {
    const elapsed = now - startTime;
    if (elapsed >= duration) return;

    const progress = elapsed / duration;
    const interval = 40 + progress * progress * 600;

    if (now - lastTick >= interval) {
      playTick();
      lastTick = now;
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function playWinSound() {
  try {
    const ctx = getAudioContext();
    // Fanfare-like sound
    const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      const t = ctx.currentTime + i * 0.12;
      gain.gain.setValueAtTime(0.12, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
      osc.start(t);
      osc.stop(t + 0.5);
    });

    // Add a shimmer
    const shimmer = ctx.createOscillator();
    const shimmerGain = ctx.createGain();
    shimmer.connect(shimmerGain);
    shimmerGain.connect(ctx.destination);
    shimmer.frequency.value = 2093;
    shimmer.type = 'sine';
    const st = ctx.currentTime + 0.5;
    shimmerGain.gain.setValueAtTime(0.05, st);
    shimmerGain.gain.exponentialRampToValueAtTime(0.001, st + 0.8);
    shimmer.start(st);
    shimmer.stop(st + 0.8);
  } catch {}
}

// === COUNTDOWN ===
function initCountdown(endTimeStr) {
  const endTime = new Date(endTimeStr);
  if (isNaN(endTime.getTime())) return;

  const bar = document.getElementById('countdownBar');
  const timerEl = document.getElementById('countdownTimer');

  function update() {
    const now = new Date();
    const diff = endTime - now;
    if (diff <= 0) {
      bar.style.display = 'block';
      timerEl.textContent = 'Đã kết thúc!';
      document.getElementById('spinBtn').disabled = true;
      document.getElementById('spinBtn').querySelector('.spin-btn-text').textContent = 'ĐÃ KẾT THÚC';
      document.getElementById('spinBtn').querySelector('.spin-btn-icon').textContent = '⏰';
      return;
    }

    bar.style.display = 'block';
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);

    let str = '';
    if (d > 0) str += d + ' ngày ';
    str += String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    timerEl.textContent = str;
  }

  update();
  setInterval(update, 1000);
}

// === PARTICLES ===
function createParticles() {
  const container = document.getElementById('particles');
  for (let i = 0; i < 40; i++) {
    const p = document.createElement('div');
    p.className = 'particle' + (Math.random() > 0.5 ? ' star' : '');
    p.style.left = Math.random() * 100 + '%';
    p.style.animationDuration = (Math.random() * 12 + 6) + 's';
    p.style.animationDelay = (Math.random() * 12) + 's';
    const size = Math.random() * 4 + 2;
    p.style.width = size + 'px';
    p.style.height = size + 'px';
    p.style.opacity = Math.random() * 0.5 + 0.15;
    container.appendChild(p);
  }
}

// === UTILS ===
function escHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

// === RESPONSIVE RESIZE ===
window.addEventListener('resize', () => {
  if (wheelData && !isSpinning) {
    drawWheel(currentRotation * Math.PI / 180);
  }
});
