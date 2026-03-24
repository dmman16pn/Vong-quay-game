// Tự điền thông tin đã lưu (Credential Management API)
document.addEventListener('DOMContentLoaded', async () => {
  if (window.PasswordCredential && navigator.credentials) {
    try {
      const cred = await navigator.credentials.get({
        password: true,
        mediation: 'optional'
      });
      if (cred) {
        document.getElementById('username').value = cred.id;
        document.getElementById('password').value = cred.password;
      }
    } catch {}
  }
  document.getElementById('username').focus();
});

async function handleLogin(event) {
  event.preventDefault();

  const btn     = document.getElementById('loginBtn');
  const btnText = document.getElementById('loginBtnText');
  const btnIcon = document.getElementById('loginBtnIcon');
  const errorEl = document.getElementById('loginError');
  const username   = document.getElementById('username').value.trim();
  const password   = document.getElementById('password').value;
  const rememberMe = document.getElementById('rememberMe').checked;

  btn.disabled = true;
  btnText.textContent = 'Đang đăng nhập...';
  btnIcon.innerHTML = '<span class="spinner"></span>';
  errorEl.textContent = '';

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, rememberMe })
    });

    const data = await res.json();

    if (res.ok && data.success) {
      // Lưu mật khẩu vào trình duyệt (nếu hỗ trợ)
      if (window.PasswordCredential) {
        try {
          const cred = new PasswordCredential({ id: username, password });
          await navigator.credentials.store(cred);
        } catch {}
      }
      btnText.textContent = '✓ Thành công!';
      btnIcon.textContent = '';
      setTimeout(() => { window.location.href = '/'; }, 400);
    } else {
      showError(data.error || 'Sai tài khoản hoặc mật khẩu');
      resetBtn();
    }
  } catch {
    showError('Lỗi kết nối, vui lòng thử lại');
    resetBtn();
  }
}

function showError(msg) {
  const el = document.getElementById('loginError');
  el.textContent = msg;
  el.style.animation = 'none';
  el.offsetHeight;
  el.style.animation = '';
}

function resetBtn() {
  const btn     = document.getElementById('loginBtn');
  const btnText = document.getElementById('loginBtnText');
  const btnIcon = document.getElementById('loginBtnIcon');
  btn.disabled = false;
  btnText.textContent = 'Đăng nhập';
  btnIcon.textContent = '→';
}

function togglePw() {
  const input     = document.getElementById('password');
  const eyeOpen   = document.getElementById('eyeOpen');
  const eyeClosed = document.getElementById('eyeClosed');

  if (input.type === 'password') {
    input.type = 'text';
    eyeOpen.style.display   = 'none';
    eyeClosed.style.display = 'block';
  } else {
    input.type = 'password';
    eyeOpen.style.display   = 'block';
    eyeClosed.style.display = 'none';
  }
  input.focus();
}
