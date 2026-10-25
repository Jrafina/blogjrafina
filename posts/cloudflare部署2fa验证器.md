# cf部署2fa验证器

## 第一版

```js
// ===== Cloudflare Worker 入口 =====
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // 前端页面
    if (path === '/') {
      return new Response(getHTML(), {
        headers: { 'Content-Type': 'text/html;charset=UTF-8' },
      });
    }

    // API: 列出所有账户
    if (path === '/api/list') {
      const list = await env.KV.list();
      const items = [];
      for (const key of list.keys) {
        const raw = await env.KV.get(key.name);
        try {
          items.push({ id: key.name, ...JSON.parse(raw) });
        } catch {}
      }
      return json(items);
    }

    // API: 添加账户
    if (path === '/api/add' && request.method === 'POST') {
      try {
        const { secret, label, issuer } = await request.json();
        if (!secret || !label) return json({ error: '秘钥和名称不能为空' }, 400);
        // 简单检查 base32 字符
        if (!/^[A-Z2-7]+=*$/i.test(secret.replace(/\s/g, ''))) {
          return json({ error: '秘钥格式不正确（应为 Base32）' }, 400);
        }
        const id = crypto.randomUUID();
        await env.KV.put(id, JSON.stringify({
          secret: secret.replace(/\s/g, '').toUpperCase(),
          label,
          issuer: issuer || '',
        }));
        return json({ id });
      } catch (e) {
        return json({ error: e.message }, 500);
      }
    }

    // API: 删除账户
    if (path === '/api/delete' && request.method === 'DELETE') {
      const id = url.searchParams.get('id');
      if (!id) return json({ error: '缺少 id' }, 400);
      await env.KV.delete(id);
      return json({ ok: true });
    }

    return new Response('Not Found', { status: 404 });
  },
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ===== 前端页面 =====
function getHTML() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>自建 TOTP 验证器</title>
<style>
  :root { --bg: #1a1a2e; --card: #16213e; --accent: #0f3460; --text: #eee; --green: #00ff88; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { background:var(--bg); color:var(--text); font-family:system-ui; min-height:100vh; display:flex; justify-content:center; padding:20px; }
  .container { width:100%; max-width:520px; }
  h1 { text-align:center; margin-bottom:20px; font-weight:300; letter-spacing:1px; }
  .add-btn { background:var(--green); color:#000; border:none; padding:12px 24px; font-size:16px; border-radius:8px; cursor:pointer; width:100%; font-weight:bold; transition:0.2s; }
  .add-btn:hover { opacity:0.9; }
  .account { background:var(--card); border-radius:12px; padding:15px; margin:12px 0; display:flex; align-items:center; justify-content:space-between; box-shadow:0 4px 12px rgba(0,0,0,0.4); }
  .info { flex:1; }
  .issuer { font-size:14px; color:#aaa; }
  .label { font-size:18px; font-weight:500; margin:2px 0; word-break:break-all; }
  .code { font-size:32px; letter-spacing:4px; font-weight:bold; color:var(--green); margin-top:4px; }
  .timer { font-size:14px; color:#aaa; margin-top:2px; }
  .progress { height:4px; background:var(--accent); border-radius:2px; margin-top:6px; overflow:hidden; }
  .progress-bar { height:100%; background:var(--green); transition: width 1s linear; }
  .delete-btn { background:none; border:none; color:#f55; font-size:20px; cursor:pointer; margin-left:10px; }
  /* Modal */
  .modal { display:none; position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.7); align-items:center; justify-content:center; z-index:10; }
  .modal.active { display:flex; }
  .modal-content { background:var(--card); padding:20px; border-radius:12px; width:90%; max-width:400px; }
  .modal input, .modal select { width:100%; padding:10px; margin:6px 0 14px; border:1px solid #333; border-radius:6px; background:#0f0f1a; color:#fff; }
  .tabs { display:flex; margin-bottom:15px; }
  .tab { flex:1; text-align:center; padding:8px; cursor:pointer; border-bottom:2px solid transparent; }
  .tab.active { border-bottom-color:var(--green); font-weight:bold; }
  .hidden { display:none !important; }
  #qr-video { width:100%; border-radius:8px; }
  #qr-result { margin-top:8px; color:var(--green); font-size:14px; }
</style>
</head>
<body>
<div class="container">
  <h1>🔐 自建 TOTP</h1>
  <button class="add-btn" onclick="openModal()">＋ 添加账户</button>
  <div id="accounts"></div>
</div>

<!-- 添加账户弹窗 -->
<div class="modal" id="modal">
  <div class="modal-content">
    <div class="tabs">
      <div class="tab active" onclick="switchTab('scan')">📷 扫码</div>
      <div class="tab" onclick="switchTab('manual')">⌨️ 手动</div>
    </div>
    <!-- 扫码区域 -->
    <div id="scan-tab">
      <p style="color:#aaa; font-size:14px;">对准二维码，或上传截图</p>
      <video id="qr-video" autoplay playsinline class="hidden"></video>
      <canvas id="qr-canvas" class="hidden"></canvas>
      <input type="file" accept="image/*" id="qr-file" onchange="parseQRFile()">
      <div id="qr-result"></div>
    </div>
    <!-- 手动输入区域 -->
    <div id="manual-tab" class="hidden">
      <input type="text" id="man-label" placeholder="账户名（如 you@gmail.com）">
      <input type="text" id="man-issuer" placeholder="发行者（如 Google）">
      <input type="text" id="man-secret" placeholder="秘钥（Base32 字符串）">
      <p style="color:#aaa; font-size:12px; margin-top:-8px;">或粘贴 otpauth 链接</p>
      <input type="text" id="man-uri" placeholder="otpauth://totp/...">
    </div>
    <button class="add-btn" style="margin-top:10px;" onclick="addAccount()">保存</button>
    <button style="background:#444; border:none; color:#fff; padding:10px; border-radius:6px; width:100%; margin-top:6px;" onclick="closeModal()">取消</button>
  </div>
</div>

<!-- jsQR 库（仅扫码需要） -->
<script src="https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js"></script>
<script>
// ===== 全局状态 =====
let accounts = [];
let videoStream = null;

// ===== 页面加载 =====
async function loadAccounts() {
  const res = await fetch('/api/list');
  accounts = await res.json();
  render();
}
loadAccounts();

// ===== 渲染账户列表 =====
function render() {
  const container = document.getElementById('accounts');
  container.innerHTML = accounts.map(a => {
    const totp = generateTOTP(a.secret);
    return \`<div class="account" id="acc-\${a.id}">
      <div class="info">
        <div class="issuer">\${escapeHtml(a.issuer) || '未分类'}</div>
        <div class="label">\${escapeHtml(a.label)}</div>
        <div class="code" id="code-\${a.id}">\${totp.code}</div>
        <div class="timer">⏳ 剩余 <span id="remain-\${a.id}">\${totp.remain}</span> 秒</div>
        <div class="progress"><div class="progress-bar" id="bar-\${a.id}" style="width:\${(totp.remain/30)*100}%"></div></div>
      </div>
      <button class="delete-btn" onclick="deleteAccount('\${a.id}')">✕</button>
    </div>\`;
  }).join('');
  // 启动定时器
  scheduleUpdates();
}

let updateInterval;
function scheduleUpdates() {
  clearInterval(updateInterval);
  updateInterval = setInterval(() => {
    for (const a of accounts) {
      const totp = generateTOTP(a.secret);
      const codeEl = document.getElementById('code-' + a.id);
      const remainEl = document.getElementById('remain-' + a.id);
      const barEl = document.getElementById('bar-' + a.id);
      if (codeEl) codeEl.textContent = totp.code;
      if (remainEl) remainEl.textContent = totp.remain;
      if (barEl) barEl.style.width = (totp.remain / 30) * 100 + '%';
    }
  }, 1000);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[m]);
}

// ===== 删除账户 =====
async function deleteAccount(id) {
  if (!confirm('确定删除这个账户吗？')) return;
  await fetch('/api/delete?id=' + id, { method: 'DELETE' });
  accounts = accounts.filter(a => a.id !== id);
  render();
}

// ===== 模态框 =====
let currentTab = 'scan';
function openModal() { document.getElementById('modal').classList.add('active'); switchTab('scan'); stopCamera(); }
function closeModal() { document.getElementById('modal').classList.remove('active'); stopCamera(); }
function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.tab').forEach((el,i) => el.classList.toggle('active', (i===0&&tab==='scan')||(i===1&&tab==='manual')));
  document.getElementById('scan-tab').classList.toggle('hidden', tab!=='scan');
  document.getElementById('manual-tab').classList.toggle('hidden', tab!=='manual');
  if (tab === 'scan') startCamera();
  else stopCamera();
}

// ===== 摄像头扫码 =====
async function startCamera() {
  const video = document.getElementById('qr-video');
  const canvas = document.getElementById('qr-canvas');
  // 如果已经有流，先关闭
  if (videoStream) return;
  try {
    videoStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    video.srcObject = videoStream;
    video.classList.remove('hidden');
    canvas.classList.remove('hidden');
    video.play();
    scanLoop(video, canvas);
  } catch (e) {
    document.getElementById('qr-result').textContent = '无法打开摄像头：' + e.message;
  }
}

function stopCamera() {
  if (videoStream) {
    videoStream.getTracks().forEach(t => t.stop());
    videoStream = null;
  }
  document.getElementById('qr-video').classList.add('hidden');
  document.getElementById('qr-canvas').classList.add('hidden');
}

function scanLoop(video, canvas) {
  if (!videoStream) return;
  if (video.readyState === video.HAVE_ENOUGH_DATA) {
    const ctx = canvas.getContext('2d');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, canvas.width, canvas.height);
    if (code) {
      document.getElementById('qr-result').textContent = '✅ 识别成功：' + code.data;
      handleOTPUrl(code.data);
      stopCamera();
      return;
    }
  }
  requestAnimationFrame(() => scanLoop(video, canvas));
}

// 上传图片解析二维码
function parseQRFile() {
  const file = document.getElementById('qr-file').files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    const img = new Image();
    img.onload = function() {
      const canvas = document.getElementById('qr-canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, canvas.width, canvas.height);
      if (code) {
        document.getElementById('qr-result').textContent = '✅ 识别成功：' + code.data;
        handleOTPUrl(code.data);
      } else {
        document.getElementById('qr-result').textContent = '❌ 未识别到二维码';
      }
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

// ===== 处理 otpauth URL =====
function handleOTPUrl(uri) {
  try {
    const url = new URL(uri);
    if (url.protocol !== 'otpauth:') throw new Error('非 otpauth 协议');
    const params = new URLSearchParams(url.search);
    const secret = params.get('secret');
    if (!secret) throw new Error('缺少 secret');
    // label 可能是 "Issuer:Account"，例如 "Google:example@gmail.com"
    let label = decodeURIComponent(url.pathname.substring(url.pathname.indexOf(':') + 1));
    if (label.startsWith('/')) label = label.substring(1);
    const issuer = params.get('issuer') || url.hostname || '';
    // 自动填充到手动表单
    switchTab('manual');
    document.getElementById('man-label').value = label;
    document.getElementById('man-issuer').value = issuer;
    document.getElementById('man-secret').value = secret;
    closeModal();
    // 直接弹出确认
    if (confirm(\`自动填充完成，是否保存？\n\${issuer} - \${label}\`)) {
      addAccount();
    } else {
      openModal();
    }
  } catch (e) {
    alert('无法解析二维码内容：' + e.message);
  }
}

// ===== 添加账户 =====
async function addAccount() {
  let secret, label, issuer;
  if (currentTab === 'scan') {
    // 扫码模式通过 handleOTPUrl 已经跳转到手动模式，通常不会走到这里
    alert('请先扫描或上传二维码');
    return;
  } else {
    // 手动模式
    label = document.getElementById('man-label').value.trim();
    issuer = document.getElementById('man-issuer').value.trim();
    secret = document.getElementById('man-secret').value.trim();
    // 如果粘贴了 otpauth 链接，尝试解析
    const uri = document.getElementById('man-uri').value.trim();
    if (!secret && uri) {
      try {
        const url = new URL(uri);
        if (url.protocol === 'otpauth:') {
          const params = new URLSearchParams(url.search);
          secret = params.get('secret');
          if (!label) label = decodeURIComponent(url.pathname.split(':')[1] || '');
          if (!issuer) issuer = params.get('issuer') || '';
        }
      } catch {}
    }
    if (!secret || !label) {
      alert('请至少填写账户名和秘钥');
      return;
    }
  }
  // 规范 secret
  secret = secret.replace(/\s/g, '').toUpperCase();
  const res = await fetch('/api/add', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret, label, issuer })
  });
  if (res.ok) {
    closeModal();
    loadAccounts();
    // 清空
    document.getElementById('man-label').value = '';
    document.getElementById('man-issuer').value = '';
    document.getElementById('man-secret').value = '';
    document.getElementById('man-uri').value = '';
    document.getElementById('qr-result').textContent = '';
  } else {
    const err = await res.json();
    alert(err.error || '添加失败');
  }
}

// ===== TOTP 算法实现 =====
function base32ToBuffer(base32) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  base32 = base32.replace(/=+$/, '').toUpperCase();
  for (let i = 0; i < base32.length; i++) {
    const val = alphabet.indexOf(base32[i]);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.substring(i, i + 8), 2));
  }
  return new Uint8Array(bytes);
}

async function generateHOTP(keyBuffer, counter) {
  const counterBuffer = new ArrayBuffer(8);
  const dv = new DataView(counterBuffer);
  dv.setBigUint64(0, BigInt(counter), false); // 大端
  const cryptoKey = await crypto.subtle.importKey(
    'raw', keyBuffer,
    { name: 'HMAC', hash: 'SHA-1' },
    false, ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, counterBuffer);
  const hmac = new Uint8Array(signature);
  const offset = hmac[19] & 0xf;
  const binCode = ((hmac[offset] & 0x7f) << 24) |
                  (hmac[offset + 1] << 16) |
                  (hmac[offset + 2] << 8) |
                  hmac[offset + 3];
  return String(binCode % 1000000).padStart(6, '0');
}

function generateTOTP(secretBase32) {
  const keyBuffer = base32ToBuffer(secretBase32);
  const period = 30;
  const now = Math.floor(Date.now() / 1000);
  const counter = Math.floor(now / period);
  const remain = period - (now % period);
  // 注意：generateHOTP 是异步的，但为了同步渲染，我们需要缓存结果。
  // 这里采用一个小技巧：使用同步的伪代码？不，crypto.subtle 必须异步。
  // 为了在渲染中使用，我们提前生成并存储。
  // 实际逻辑：在渲染时调用该函数返回一个 pending 状态？更好的方案是在获取列表时一并预计算。
  // 但为了简单，我们在这里用一个全局 Map 存储已计算的 HOTP，然后由异步函数更新。
  // 但直接调用 generateHOTP 是异步的，在 generateTOTP 中无法直接返回同步结果。
  // 因此需要重构：我们将 TOTP 计算改为异步，并在获取列表后调用 setCode。
}
// 由于以上限制，修正方案：不在渲染函数中直接调用 generateTOTP，而是通过异步更新 DOM。
// 重写如下：
</script>
<script>
// 修改后的 TOTP 更新流程（放在后面以覆盖）
let totpCache = new Map(); // id -> {code, remain}

async function refreshTOTP(id, secret) {
  const keyBuffer = base32ToBuffer(secret);
  const now = Math.floor(Date.now() / 1000);
  const period = 30;
  const counter = Math.floor(now / period);
  const remain = period - (now % period);
  const code = await generateHOTP(keyBuffer, counter);
  totpCache.set(id, { code, remain });
}

async function render() {
  const container = document.getElementById('accounts');
  // 先为每个账户计算初始 TOTP
  await Promise.all(accounts.map(a => refreshTOTP(a.id, a.secret)));
  container.innerHTML = accounts.map(a => {
    const data = totpCache.get(a.id);
    return \`<div class="account" id="acc-\${a.id}">
      <div class="info">
        <div class="issuer">\${escapeHtml(a.issuer) || '未分类'}</div>
        <div class="label">\${escapeHtml(a.label)}</div>
        <div class="code" id="code-\${a.id}">\${data.code}</div>
        <div class="timer">⏳ 剩余 <span id="remain-\${a.id}">\${data.remain}</span> 秒</div>
        <div class="progress"><div class="progress-bar" id="bar-\${a.id}" style="width:\${(data.remain/30)*100}%"></div></div>
      </div>
      <button class="delete-btn" onclick="deleteAccount('\${a.id}')">✕</button>
    </div>\`;
  }).join('');
  scheduleUpdates();
}

// 定时更新
function scheduleUpdates() {
  clearInterval(updateInterval);
  updateInterval = setInterval(async () => {
    const now = Math.floor(Date.now() / 1000);
    const period = 30;
    const remain = period - (now % period);
    for (const a of accounts) {
      let data = totpCache.get(a.id);
      // 如果不存在或者剩余秒数需要新 code（0 秒时刷新）
      if (!data || remain === 30) {
        await refreshTOTP(a.id, a.secret);
        data = totpCache.get(a.id);
      } else {
        data.remain = remain;
      }
      const codeEl = document.getElementById('code-' + a.id);
      const remainEl = document.getElementById('remain-' + a.id);
      const barEl = document.getElementById('bar-' + a.id);
      if (codeEl) codeEl.textContent = data.code;
      if (remainEl) remainEl.textContent = data.remain;
      if (barEl) barEl.style.width = (data.remain / 30) * 100 + '%';
    }
  }, 1000);
}

// 删除账户重新渲染
async function deleteAccount(id) {
  if (!confirm('确定删除吗？')) return;
  await fetch('/api/delete?id=' + id, { method: 'DELETE' });
  accounts = accounts.filter(a => a.id !== id);
  render();
}

// 修改 loadAccounts
async function loadAccounts() {
  const res = await fetch('/api/list');
  accounts = await res.json();
  render();
}

// 覆盖之前的 generateTOTP 函数（不再需要）
</script>
</body>
</html>`;
}
```

1. KV变量名： KV

## 第二版---添加账号(多用户版)

```js
// ==================== Cloudflare Worker 入口 ====================
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // ----- 静态页面 -----
    if (path === '/') {
      return new Response(getHTML(), {
        headers: { 'Content-Type': 'text/html;charset=UTF-8' },
      });
    }

    // ----- 用户注册 -----
    if (path === '/api/register' && request.method === 'POST') {
      try {
        const { email, password } = await request.json();
        if (!email || !password) return json({ error: '邮箱和密码不能为空' }, 400);
        const emailLower = email.toLowerCase();
        const key = `user:${emailLower}`;
        const existing = await env.KV.get(key);
        if (existing) return json({ error: '该邮箱已注册' }, 409);
        const hash = await hashPassword(password, env);
        const userData = {
          passwordHash: hash,
          totps: [],
        };
        await env.KV.put(key, JSON.stringify(userData));
        return json({ ok: true });
      } catch (e) {
        return json({ error: e.message }, 500);
      }
    }

    // ----- 用户登录 -----
    if (path === '/api/login' && request.method === 'POST') {
      try {
        const { email, password } = await request.json();
        if (!email || !password) return json({ error: '邮箱和密码不能为空' }, 400);
        const emailLower = email.toLowerCase();
        const key = `user:${emailLower}`;
        const raw = await env.KV.get(key);
        if (!raw) return json({ error: '邮箱未注册' }, 401);
        const userData = JSON.parse(raw);
        const valid = await verifyPassword(password, userData.passwordHash, env);
        if (!valid) return json({ error: '密码错误' }, 401);
        const token = crypto.randomUUID();
        await env.KV.put(`session:${token}`, emailLower, { expirationTtl: 7 * 86400 });
        return json({ token }, 200, {
          'Set-Cookie': `token=${token}; HttpOnly; Path=/; Max-Age=604800; SameSite=Strict; Secure`,
        });
      } catch (e) {
        return json({ error: e.message }, 500);
      }
    }

    // ----- 用户登出 -----
    if (path === '/api/logout') {
      const token = getCookie(request, 'token');
      if (token) await env.KV.delete(`session:${token}`);
      return json({ ok: true }, 200, {
        'Set-Cookie': 'token=; HttpOnly; Path=/; Max-Age=0; SameSite=Strict; Secure',
      });
    }

    // ----- 获取当前用户信息 -----
    if (path === '/api/user') {
      const email = await authenticate(request, env);
      if (!email) return json({ error: '未登录' }, 401);
      return json({ email });
    }

    // ----- 获取当前用户的 TOTP 列表 -----
    if (path === '/api/list') {
      const email = await authenticate(request, env);
      if (!email) return json({ error: '未登录' }, 401);
      const key = `user:${email}`;
      const raw = await env.KV.get(key);
      if (!raw) {
        const token = getCookie(request, 'token');
        if (token) await env.KV.delete(`session:${token}`);
        return json({ error: '用户数据不存在，请重新注册' }, 401);
      }
      const userData = JSON.parse(raw);
      return json(userData.totps || []);
    }

    // ----- 添加 TOTP -----
    if (path === '/api/add' && request.method === 'POST') {
      const email = await authenticate(request, env);
      if (!email) return json({ error: '未登录' }, 401);
      try {
        const { secret, label, issuer } = await request.json();
        if (!secret || !label) return json({ error: '密钥和名称不能为空' }, 400);
        if (!/^[A-Z2-7]+=*$/i.test(secret.replace(/\s/g, ''))) {
          return json({ error: '密钥格式不正确（应为 Base32）' }, 400);
        }
        const userKey = `user:${email}`;
        const raw = await env.KV.get(userKey);
        if (!raw) return json({ error: '用户数据不存在，请重新登录' }, 401);
        const userData = JSON.parse(raw);
        const newItem = {
          id: crypto.randomUUID(),
          secret: secret.replace(/\s/g, '').toUpperCase(),
          label,
          issuer: issuer || '',
        };
        userData.totps.push(newItem);
        await env.KV.put(userKey, JSON.stringify(userData));
        return json({ id: newItem.id });
      } catch (e) {
        return json({ error: e.message }, 500);
      }
    }

    // ----- 删除 TOTP -----
    if (path === '/api/delete' && request.method === 'DELETE') {
      const email = await authenticate(request, env);
      if (!email) return json({ error: '未登录' }, 401);
      const id = url.searchParams.get('id');
      if (!id) return json({ error: '缺少 id' }, 400);
      const userKey = `user:${email}`;
      const raw = await env.KV.get(userKey);
      if (!raw) return json({ error: '用户数据不存在，请重新登录' }, 401);
      const userData = JSON.parse(raw);
      userData.totps = userData.totps.filter(item => item.id !== id);
      await env.KV.put(userKey, JSON.stringify(userData));
      return json({ ok: true });
    }

    return new Response('Not Found', { status: 404 });
  },
};

// ==================== 辅助函数 ====================
function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  });
}

function getCookie(request, name) {
  const cookies = request.headers.get('Cookie') || '';
  const match = cookies.match(new RegExp(`(?:^|;)\\s*${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

async function authenticate(request, env) {
  const token = getCookie(request, 'token');
  if (!token) return null;
  const email = await env.KV.get(`session:${token}`);
  return email ? email.toLowerCase() : null;
}

async function hashPassword(password, env) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const saltHex = Array.from(salt, b => b.toString(16).padStart(2, '0')).join('');
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw', encoder.encode(password),
    { name: 'PBKDF2' }, false, ['deriveBits']
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: encoder.encode(saltHex),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );
  const hashHex = Array.from(new Uint8Array(derivedBits), b => b.toString(16).padStart(2, '0')).join('');
  return `${saltHex}:${hashHex}`;
}

async function verifyPassword(password, storedHash, env) {
  const [saltHex, originalHash] = storedHash.split(':');
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw', encoder.encode(password),
    { name: 'PBKDF2' }, false, ['deriveBits']
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: encoder.encode(saltHex),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );
  const hashHex = Array.from(new Uint8Array(derivedBits), b => b.toString(16).padStart(2, '0')).join('');
  return hashHex === originalHash;
}

// ==================== 前端页面 HTML（已美化版） ====================
function getHTML() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>自建 TOTP 验证器</title>
  <style>
    :root {
      --bg: #0f0f1a;
      --card: #1a1a2e;
      --accent: #2a2a4a;
      --text: #e0e0e0;
      --green: #00ff88;
      --red: #ff5555;
      --blue: #4a90ff;
      --gray: #888;
    }
    * { margin:0; padding:0; box-sizing:border-box; }
    body {
      background:var(--bg);
      color:var(--text);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      min-height:100vh;
      display:flex;
      justify-content:center;
      padding:30px 20px;
    }
    .container { width:100%; max-width:520px; }

    h1 {
      text-align:center;
      margin-bottom:30px;
      font-weight:400;
      letter-spacing:2px;
      font-size:1.8rem;
    }

    /* 登录/注册卡片 */
    .card {
      background:var(--card);
      border-radius:16px;
      padding:24px;
      margin-bottom:20px;
      box-shadow:0 8px 24px rgba(0,0,0,0.4);
    }
    .flex-row {
      display:flex;
      justify-content:space-between;
      align-items:center;
      margin-bottom:16px;
    }
    .flex-row span { font-size:1.2rem; font-weight:500; }
    a { color:var(--green); text-decoration:none; font-size:0.95rem; }
    a:hover { text-decoration:underline; }

    input {
      width:100%;
      padding:12px 14px;
      margin-bottom:14px;
      border:1px solid #333;
      border-radius:8px;
      background:#12121f;
      color:#fff;
      font-size:1rem;
      transition: border-color 0.2s;
    }
    input:focus { border-color:var(--green); outline:none; }

    button {
      width:100%;
      padding:12px;
      border:none;
      border-radius:8px;
      font-size:1rem;
      font-weight:600;
      cursor:pointer;
      transition: all 0.2s;
    }
    .btn-primary {
      background:var(--green);
      color:#000;
    }
    .btn-primary:hover { filter: brightness(1.1); }
    .btn-danger {
      background:var(--red);
      color:#fff;
    }
    .btn-danger:hover { filter: brightness(1.1); }
    .btn-small {
      width:auto;
      padding:6px 14px;
      font-size:0.9rem;
    }

    .hidden { display:none !important; }
    .error-msg { color:var(--red); font-size:0.9rem; margin-top:4px; }

    /* 已登录区域 */
    #main-box .flex-row { margin-bottom:20px; }
    #user-email { font-size:1rem; color:var(--gray); }

    /* 添加按钮 */
    .add-btn {
      background: var(--green);
      color: #000;
      font-weight:bold;
      margin-bottom:20px;
    }

    /* ----- 验证码卡片美化 ----- */
    .account {
      background: var(--card);
      border-radius:16px;
      padding:18px;
      margin-bottom:16px;
      box-shadow:0 4px 12px rgba(0,0,0,0.3);
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      transition: transform 0.2s;
    }
    .account:hover { transform: translateY(-2px); }

    .info {
      flex: 1;
      min-width: 0;
    }

    .issuer {
      font-size:0.85rem;
      color: var(--gray);
      text-transform: uppercase;
      letter-spacing:1px;
      margin-bottom:4px;
    }
    .label {
      font-size:1.2rem;
      font-weight:500;
      margin-bottom:6px;
      word-break: break-all;
      color: #fff;
    }
    .code-row {
      display: flex;
      align-items: center;
      gap: 10px;
      margin: 10px 0 6px;
    }
    .code {
      font-size: 2.4rem;
      font-weight: 700;
      letter-spacing: 6px;
      color: var(--green);
      font-family: 'Courier New', monospace;
      line-height: 1;
    }
    .copy-btn {
      width: auto;
      padding: 6px 12px;
      font-size: 1.1rem;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.15);
      border-radius: 8px;
      color: var(--gray);
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 44px;
    }
    .copy-btn:hover {
      background: rgba(255,255,255,0.12);
      color: #fff;
      border-color: var(--green);
    }
    .copy-btn.copied {
      background: rgba(0,255,136,0.15);
      color: var(--green);
      border-color: var(--green);
    }

    .timer {
      font-size:0.85rem;
      color: var(--gray);
      margin-top:4px;
    }
    .progress {
      height:4px;
      background: var(--accent);
      border-radius:2px;
      margin-top:8px;
      overflow:hidden;
    }
    .progress-bar {
      height:100%;
      background: var(--green);
      transition: width 1s linear;
      border-radius:2px;
    }

    .delete-btn {
      width: auto;
      padding: 6px 10px;
      background: none;
      border: none;
      color: #f55;
      font-size: 1.4rem;
      cursor: pointer;
      margin-left: 12px;
      opacity: 0.7;
    }
    .delete-btn:hover { opacity: 1; }

    /* 模态框 */
    .modal {
      display:none;
      position:fixed;
      top:0; left:0; right:0; bottom:0;
      background:rgba(0,0,0,0.7);
      align-items:center;
      justify-content:center;
      z-index:10;
    }
    .modal.active { display:flex; }
    .modal-content {
      background:var(--card);
      padding:24px;
      border-radius:16px;
      width:90%;
      max-width:420px;
    }
    .tabs {
      display:flex;
      margin-bottom:20px;
      border-bottom:1px solid #333;
    }
    .tab {
      flex:1;
      text-align:center;
      padding:10px;
      cursor:pointer;
      color:var(--gray);
      font-weight:500;
      transition:0.2s;
    }
    .tab.active {
      color:#fff;
      border-bottom:2px solid var(--green);
    }
    #qr-video { width:100%; border-radius:8px; }
    #qr-result { margin-top:8px; color:var(--green); font-size:0.9rem; }
  </style>
</head>
<body>
<div class="container">
  <h1>🔐 自建 TOTP</h1>

  <!-- 未登录区域 -->
  <div id="login-box" class="card hidden">
    <div class="flex-row">
      <span>登录</span>
      <a href="javascript:void(0)" onclick="showRegister()">注册新账号</a>
    </div>
    <input type="email" id="login-email" placeholder="邮箱" autocomplete="email">
    <input type="password" id="login-password" placeholder="密码" autocomplete="current-password">
    <button class="btn-primary" onclick="login()">登录</button>
    <div id="login-error" class="error-msg"></div>
  </div>

  <div id="register-box" class="card hidden">
    <div class="flex-row">
      <span>注册</span>
      <a href="javascript:void(0)" onclick="showLogin()">已有账号？登录</a>
    </div>
    <input type="email" id="reg-email" placeholder="邮箱" autocomplete="email">
    <input type="password" id="reg-password" placeholder="密码" autocomplete="new-password">
    <input type="password" id="reg-password2" placeholder="确认密码" autocomplete="new-password">
    <button class="btn-primary" onclick="register()">注册</button>
    <div id="reg-error" class="error-msg"></div>
  </div>

  <!-- 已登录区域 -->
  <div id="main-box" class="hidden">
    <div class="flex-row">
      <span id="user-email"></span>
      <button class="btn-small btn-danger" onclick="logout()">退出登录</button>
    </div>
    <button class="btn-primary add-btn" onclick="openModal()">＋ 添加账户</button>
    <div id="accounts"></div>
  </div>
</div>

<!-- 添加账户弹窗 -->
<div class="modal" id="modal">
  <div class="modal-content">
    <div class="tabs">
      <div class="tab active" onclick="switchTab('scan')">📷 扫码</div>
      <div class="tab" onclick="switchTab('manual')">⌨️ 手动</div>
    </div>
    <div id="scan-tab">
      <p style="color:var(--gray); font-size:0.9rem;">对准二维码，或上传截图</p>
      <video id="qr-video" autoplay playsinline class="hidden"></video>
      <canvas id="qr-canvas" class="hidden"></canvas>
      <input type="file" accept="image/*" id="qr-file" onchange="parseQRFile()" style="margin-top:10px;">
      <div id="qr-result"></div>
    </div>
    <div id="manual-tab" class="hidden">
      <input type="text" id="man-label" placeholder="账户名（如 you@gmail.com）">
      <input type="text" id="man-issuer" placeholder="发行者（如 Google）">
      <input type="text" id="man-secret" placeholder="密钥（Base32 字符串）">
      <p style="color:var(--gray); font-size:0.85rem; margin-top:-8px; margin-bottom:12px;">或粘贴 otpauth 链接</p>
      <input type="text" id="man-uri" placeholder="otpauth://totp/...">
    </div>
    <button class="btn-primary" style="margin-top:12px;" onclick="addAccount()">保存</button>
    <button style="background:#3a3a5a; border:none; color:#fff; padding:10px; border-radius:8px; width:100%; margin-top:8px;" onclick="closeModal()">取消</button>
  </div>
</div>

<script src="https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js"></script>
<script>
// ==================== 全局状态 ====================
let accounts = [];
let currentUser = null;
let videoStream = null;
let currentTab = 'scan';

// ==================== 初始化 ====================
async function init() {
  const res = await fetch('/api/user');
  if (res.ok) {
    currentUser = await res.json();
    document.getElementById('user-email').textContent = currentUser.email;
    document.getElementById('main-box').classList.remove('hidden');
    document.getElementById('login-box').classList.add('hidden');
    document.getElementById('register-box').classList.add('hidden');
    loadAccounts();
  } else {
    showLogin();
  }
}
init();

// ==================== 登录/注册 UI ====================
function showLogin() {
  document.getElementById('login-box').classList.remove('hidden');
  document.getElementById('register-box').classList.add('hidden');
  document.getElementById('main-box').classList.add('hidden');
  document.getElementById('login-error').textContent = '';
}
function showRegister() {
  document.getElementById('register-box').classList.remove('hidden');
  document.getElementById('login-box').classList.add('hidden');
  document.getElementById('main-box').classList.add('hidden');
  document.getElementById('reg-error').textContent = '';
}

async function login() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  if (!email || !password) {
    document.getElementById('login-error').textContent = '请填写邮箱和密码';
    return;
  }
  const res = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (res.ok) {
    document.getElementById('login-error').textContent = '';
    location.reload();
  } else {
    const err = await res.json();
    document.getElementById('login-error').textContent = err.error;
  }
}

async function register() {
  const email = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  const password2 = document.getElementById('reg-password2').value;
  if (!email || !password) {
    document.getElementById('reg-error').textContent = '请填写邮箱和密码';
    return;
  }
  if (password !== password2) {
    document.getElementById('reg-error').textContent = '两次密码不一致';
    return;
  }
  const res = await fetch('/api/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (res.ok) {
    document.getElementById('reg-error').textContent = '';
    await loginHelper(email, password);
  } else {
    const err = await res.json();
    document.getElementById('reg-error').textContent = err.error;
  }
}

async function loginHelper(email, password) {
  const res = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (res.ok) location.reload();
}

async function logout() {
  await fetch('/api/logout', { method: 'POST' });
  location.reload();
}

// ==================== TOTP 列表与渲染 ====================
async function loadAccounts() {
  const res = await fetch('/api/list');
  if (!res.ok) {
    alert('加载失败，可能登录已过期，请重新登录');
    location.reload();
    return;
  }
  accounts = await res.json();
  render();
}

let updateInterval;
let totpCache = new Map();

async function refreshTOTP(id, secret) {
  const keyBuffer = base32ToBuffer(secret);
  const now = Math.floor(Date.now() / 1000);
  const period = 30;
  const counter = Math.floor(now / period);
  const remain = period - (now % period);
  const code = await generateHOTP(keyBuffer, counter);
  totpCache.set(id, { code, remain });
}

async function render() {
  const container = document.getElementById('accounts');
  if (accounts.length === 0) {
    container.innerHTML = '<p style="color:var(--gray); text-align:center; padding:30px;">暂无账户，点击上方按钮添加</p>';
    return;
  }
  await Promise.all(accounts.map(a => refreshTOTP(a.id, a.secret)));
  container.innerHTML = accounts.map(a => {
    const data = totpCache.get(a.id);
    return \`
      <div class="account" id="acc-\${a.id}">
        <div class="info">
          <div class="issuer">\${escapeHtml(a.issuer) || '未分类'}</div>
          <div class="label">\${escapeHtml(a.label)}</div>
          <div class="code-row">
            <span class="code" id="code-\${a.id}">\${data.code}</span>
            <button class="copy-btn" data-code-id="code-\${a.id}" onclick="copyCode(this, 'code-\${a.id}')">📋</button>
          </div>
          <div class="timer">⏳ 剩余 <span id="remain-\${a.id}">\${data.remain}</span> 秒</div>
          <div class="progress"><div class="progress-bar" id="bar-\${a.id}" style="width:\${(data.remain/30)*100}%"></div></div>
        </div>
        <button class="delete-btn" onclick="deleteAccount('\${a.id}')" title="删除">✕</button>
      </div>
    \`;
  }).join('');
  scheduleUpdates();
}

// 复制验证码到剪贴板
async function copyCode(btn, codeId) {
  const codeEl = document.getElementById(codeId);
  if (!codeEl) return;
  const code = codeEl.textContent;
  try {
    await navigator.clipboard.writeText(code);
    // 视觉反馈
    btn.classList.add('copied');
    btn.textContent = '✅';
    setTimeout(() => {
      btn.classList.remove('copied');
      btn.textContent = '📋';
    }, 1500);
  } catch (err) {
    // 回退方式
    const textarea = document.createElement('textarea');
    textarea.value = code;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    alert('已复制到剪贴板');
  }
}

function scheduleUpdates() {
  clearInterval(updateInterval);
  updateInterval = setInterval(async () => {
    const now = Math.floor(Date.now() / 1000);
    const period = 30;
    const remain = period - (now % period);
    for (const a of accounts) {
      let data = totpCache.get(a.id);
      if (!data || remain === 30) {
        await refreshTOTP(a.id, a.secret);
        data = totpCache.get(a.id);
      } else {
        data.remain = remain;
      }
      const codeEl = document.getElementById('code-' + a.id);
      const remainEl = document.getElementById('remain-' + a.id);
      const barEl = document.getElementById('bar-' + a.id);
      if (codeEl) codeEl.textContent = data.code;
      if (remainEl) remainEl.textContent = data.remain;
      if (barEl) barEl.style.width = (data.remain / 30) * 100 + '%';
    }
  }, 1000);
}

async function deleteAccount(id) {
  if (!confirm('确定删除这个账户吗？')) return;
  await fetch(\`/api/delete?id=\${id}\`, { method: 'DELETE' });
  accounts = accounts.filter(a => a.id !== id);
  render();
}

// ==================== 添加账户（手动/扫码） ====================
function openModal() { document.getElementById('modal').classList.add('active'); switchTab('scan'); stopCamera(); }
function closeModal() { document.getElementById('modal').classList.remove('active'); stopCamera(); }

function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.tab').forEach((el,i) => el.classList.toggle('active', (i===0&&tab==='scan')||(i===1&&tab==='manual')));
  document.getElementById('scan-tab').classList.toggle('hidden', tab!=='scan');
  document.getElementById('manual-tab').classList.toggle('hidden', tab!=='manual');
  if (tab === 'scan') startCamera();
  else stopCamera();
}

async function startCamera() {
  const video = document.getElementById('qr-video');
  const canvas = document.getElementById('qr-canvas');
  if (videoStream) return;
  try {
    videoStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    video.srcObject = videoStream;
    video.classList.remove('hidden');
    canvas.classList.remove('hidden');
    video.play();
    scanLoop(video, canvas);
  } catch (e) {
    document.getElementById('qr-result').textContent = '摄像头错误：' + e.message;
  }
}

function stopCamera() {
  if (videoStream) {
    videoStream.getTracks().forEach(t => t.stop());
    videoStream = null;
  }
  document.getElementById('qr-video').classList.add('hidden');
  document.getElementById('qr-canvas').classList.add('hidden');
}

function scanLoop(video, canvas) {
  if (!videoStream) return;
  if (video.readyState === video.HAVE_ENOUGH_DATA) {
    const ctx = canvas.getContext('2d');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, canvas.width, canvas.height);
    if (code) {
      document.getElementById('qr-result').textContent = '✅ 识别成功';
      handleOTPUrl(code.data);
      stopCamera();
      return;
    }
  }
  requestAnimationFrame(() => scanLoop(video, canvas));
}

function parseQRFile() {
  const file = document.getElementById('qr-file').files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    const img = new Image();
    img.onload = function() {
      const canvas = document.getElementById('qr-canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, canvas.width, canvas.height);
      if (code) {
        document.getElementById('qr-result').textContent = '✅ 识别成功';
        handleOTPUrl(code.data);
      } else {
        document.getElementById('qr-result').textContent = '❌ 未识别二维码';
      }
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function handleOTPUrl(uri) {
  try {
    const url = new URL(uri);
    if (url.protocol !== 'otpauth:') throw new Error('非 otpauth 协议');
    const params = new URLSearchParams(url.search);
    const secret = params.get('secret');
    if (!secret) throw new Error('缺少 secret');
    let label = decodeURIComponent(url.pathname.substring(url.pathname.indexOf(':') + 1));
    if (label.startsWith('/')) label = label.substring(1);
    const issuer = params.get('issuer') || url.hostname || '';
    switchTab('manual');
    document.getElementById('man-label').value = label;
    document.getElementById('man-issuer').value = issuer;
    document.getElementById('man-secret').value = secret;
    closeModal();
    if (confirm(\`自动填充完成，是否保存？\n\${issuer} - \${label}\`)) {
      addAccount();
    } else {
      openModal();
    }
  } catch (e) {
    alert('二维码解析失败：' + e.message);
  }
}

async function addAccount() {
  let secret, label, issuer;
  if (currentTab === 'manual') {
    label = document.getElementById('man-label').value.trim();
    issuer = document.getElementById('man-issuer').value.trim();
    secret = document.getElementById('man-secret').value.trim();
    const uri = document.getElementById('man-uri').value.trim();
    if (!secret && uri) {
      try {
        const url = new URL(uri);
        if (url.protocol === 'otpauth:') {
          const params = new URLSearchParams(url.search);
          secret = params.get('secret');
          if (!label) label = decodeURIComponent(url.pathname.split(':')[1] || '');
          if (!issuer) issuer = params.get('issuer') || '';
        }
      } catch {}
    }
    if (!secret || !label) {
      alert('请至少填写账户名和密钥');
      return;
    }
  } else {
    alert('请先扫描二维码或手动输入');
    return;
  }
  secret = secret.replace(/\s/g, '').toUpperCase();
  const res = await fetch('/api/add', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret, label, issuer })
  });
  if (res.ok) {
    closeModal();
    loadAccounts();
    ['man-label','man-issuer','man-secret','man-uri'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('qr-result').textContent = '';
  } else {
    const err = await res.json();
    alert(err.error || '添加失败');
  }
}

// ==================== TOTP 算法 ====================
function base32ToBuffer(base32) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  base32 = base32.replace(/=+$/, '').toUpperCase();
  for (let i = 0; i < base32.length; i++) {
    const val = alphabet.indexOf(base32[i]);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.substring(i, i + 8), 2));
  }
  return new Uint8Array(bytes);
}

async function generateHOTP(keyBuffer, counter) {
  const counterBuffer = new ArrayBuffer(8);
  const dv = new DataView(counterBuffer);
  dv.setBigUint64(0, BigInt(counter), false);
  const cryptoKey = await crypto.subtle.importKey(
    'raw', keyBuffer,
    { name: 'HMAC', hash: 'SHA-1' },
    false, ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, counterBuffer);
  const hmac = new Uint8Array(signature);
  const offset = hmac[19] & 0xf;
  const binCode = ((hmac[offset] & 0x7f) << 24) |
                  (hmac[offset + 1] << 16) |
                  (hmac[offset + 2] << 8) |
                  hmac[offset + 3];
  return String(binCode % 1000000).padStart(6, '0');
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[m]);
}
</script>
</body>
</html>`;
}
```

1. KV变量名： KV
2. 在turnstile里面添加好主机名 即 worker域名，然后选择托管模式，然后点击部署，生成站点秘钥和密钥，分别对应两个worker变量：TURNSTILE_SITE_KEY（明文） 和 TURNSTILE_SECRET（密钥）

## 第三版（一人多用）

1. worker变量

- `ADD_PATH`：自定义管理页面路径，默认 `/add`。
- `CHECK_PATH`：自定义验证页面路径，默认 `/check`。
- `ADMIN_PASSWORD`：如果需要简单密码保护，可设置一个密码（明文）。代码中已预留逻辑，如果不设置则无密码。

```js
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    const addPath = env.ADD_PATH || '/add';
    const checkPath = env.CHECK_PATH || '/check';

    if (path === '/') {
      return Response.redirect(addPath, 302);
    }

    // 管理页面
    if (path === addPath) {
      const adminPass = env.ADMIN_PASSWORD;
      if (adminPass) {
        const auth = request.headers.get('Authorization');
        if (!auth || auth !== `Bearer ${adminPass}`) {
          return new Response('请输入管理员密码', {
            status: 401,
            headers: { 'WWW-Authenticate': 'Bearer' },
          });
        }
      }
      return new Response(getAddPageHTML(), {
        headers: { 'Content-Type': 'text/html;charset=UTF-8' },
      });
    }

    // 验证页面
    if (path === checkPath) {
      return new Response(getCheckPageHTML(), {
        headers: { 'Content-Type': 'text/html;charset=UTF-8' },
      });
    }

    // API: 获取所有记录（不含 secret）
    if (path === '/api/records' && request.method === 'GET') {
      const list = await env.KV.list({ prefix: 'rec:' });
      const records = [];
      for (const key of list.keys) {
        const raw = await env.KV.get(key.name);
        try {
          const item = JSON.parse(raw);
          records.push({ id: item.id, label: item.label, issuer: item.issuer });
        } catch {}
      }
      return json(records);
    }

    // API: 添加记录
    if (path === '/api/add' && request.method === 'POST') {
      try {
        const { secret, label, issuer } = await request.json();
        if (!secret || !label) return json({ error: '密钥和账户名不能为空' }, 400);
        if (!/^[A-Z2-7]+=*$/i.test(secret.replace(/\s/g, ''))) {
          return json({ error: '密钥格式不正确（Base32）' }, 400);
        }
        const id = crypto.randomUUID();
        const record = {
          id,
          secret: secret.replace(/\s/g, '').toUpperCase(),
          label,
          issuer: issuer || '',
        };
        await env.KV.put(`rec:${id}`, JSON.stringify(record));
        return json(record);
      } catch (e) {
        return json({ error: e.message }, 500);
      }
    }

    // API: 删除记录
    if (path === '/api/delete' && request.method === 'DELETE') {
      const id = url.searchParams.get('id');
      if (!id) return json({ error: '缺少 id' }, 400);
      await env.KV.delete(`rec:${id}`);
      return json({ ok: true });
    }

    // API: 获取单个记录（含 secret，用于 /check 和验证显示）
    if (path === '/api/record' && request.method === 'GET') {
      const id = url.searchParams.get('id');
      if (!id) return json({ error: '缺少 id' }, 400);
      const raw = await env.KV.get(`rec:${id}`);
      if (!raw) return json({ error: '记录不存在' }, 404);
      const record = JSON.parse(raw);
      return json(record);
    }

    return new Response('Not Found', { status: 404 });
  },
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ==================== HTML 管理页面 ====================
function getAddPageHTML() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>管理面板 - 自建 TOTP</title>
  <style>
    :root { --bg: #0f0f1a; --card: #1a1a2e; --accent: #2a2a4a; --text: #e0e0e0; --green: #00ff88; --red: #ff5555; --gray: #888; }
    * { margin:0; padding:0; box-sizing:border-box; }
    body { background:var(--bg); color:var(--text); font-family: system-ui; min-height:100vh; display:flex; justify-content:center; padding:20px; }
    .container { width:100%; max-width:600px; }
    h1 { text-align:center; margin-bottom:20px; }
    .card { background:var(--card); border-radius:12px; padding:20px; margin-bottom:16px; }
    .flex-row { display:flex; justify-content:space-between; align-items:center; }
    input { width:100%; padding:10px; margin:8px 0 14px; border:1px solid #333; border-radius:6px; background:#12121f; color:#fff; }
    button { width:100%; padding:10px; border:none; border-radius:6px; font-weight:bold; cursor:pointer; background:var(--green); color:#000; }
    button:hover { filter: brightness(1.1); }
    .btn-small { width:auto; padding:4px 10px; background:var(--red); color:#fff; font-size:0.9rem; margin-left:8px; }
    .btn-copy { background:var(--accent); color:var(--text); border:1px solid #555; width:auto; padding:4px 10px; font-size:0.9rem; }
    .record { display:flex; align-items:center; justify-content:space-between; padding:10px 0; border-bottom:1px solid var(--accent); flex-wrap:wrap; }
    .record:last-child { border-bottom:none; }
    .record-info { flex:1; min-width:200px; }
    .record-id { font-family:monospace; font-size:0.85rem; color:var(--gray); word-break:break-all; margin-right:10px; }
    .modal { display:none; position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.7); align-items:center; justify-content:center; z-index:10; }
    .modal.active { display:flex; }
    .modal-content { background:var(--card); padding:20px; border-radius:12px; width:90%; max-width:450px; max-height:90vh; overflow-y:auto; }
    .tabs { display:flex; margin-bottom:15px; }
    .tab { flex:1; text-align:center; padding:8px; cursor:pointer; color:var(--gray); }
    .tab.active { border-bottom:2px solid var(--green); font-weight:bold; color:#fff; }
    .hidden { display:none !important; }
    #qr-video { width:100%; border-radius:8px; }
    .code-block { background:#0f0f1a; border:1px solid #333; padding:10px; border-radius:6px; font-family:monospace; word-break:break-all; margin:8px 0; }
    .modal button { margin-top:8px; }
  </style>
</head>
<body>
<div class="container">
  <h1>🔐 TOTP 管理面板</h1>
  <button onclick="openAddModal()" style="margin-bottom:20px;">＋ 添加新记录</button>
  <div id="records"></div>
</div>

<!-- 添加记录弹窗 -->
<div class="modal" id="add-modal">
  <div class="modal-content">
    <div class="tabs">
      <div class="tab active" onclick="switchTab('scan')">📷 扫码</div>
      <div class="tab" onclick="switchTab('manual')">⌨️ 手动</div>
    </div>
    <div id="scan-tab">
      <p style="color:var(--gray);">对准二维码或上传截图</p>
      <video id="qr-video" autoplay playsinline class="hidden"></video>
      <canvas id="qr-canvas" class="hidden"></canvas>
      <input type="file" accept="image/*" id="qr-file" onchange="parseQRFile()">
      <div id="qr-result" style="margin-top:8px; color:var(--green);"></div>
    </div>
    <div id="manual-tab" class="hidden">
      <input type="text" id="man-label" placeholder="账户名 (如 example@gmail.com)">
      <input type="text" id="man-issuer" placeholder="发行者 (如 Google)">
      <input type="text" id="man-secret" placeholder="Base32 密钥">
      <p style="color:var(--gray); font-size:0.85rem;">或粘贴 otpauth 链接</p>
      <input type="text" id="man-uri" placeholder="otpauth://totp/...">
    </div>
    <button onclick="addRecord()">保存</button>
    <button style="background:#444; color:#fff; margin-top:6px;" onclick="closeAddModal()">取消</button>
  </div>
</div>

<!-- 添加成功弹窗 -->
<div class="modal" id="success-modal">
  <div class="modal-content">
    <h3>✅ 记录已保存</h3>
    <p style="margin:12px 0 4px;">36 位查询码（用于 /check 查询）：</p>
    <div class="code-block" id="success-id"></div>
    <button class="btn-copy" style="width:100%;" onclick="copyById('success-id')">📋 复制 36 位码</button>
    <p style="margin:16px 0 4px;">Base32 密钥（请妥善保管，切勿泄露）：</p>
    <div class="code-block" id="success-secret"></div>
    <button class="btn-copy" style="width:100%;" onclick="copyById('success-secret')">📋 复制密钥</button>
    <button style="background:var(--green); margin-top:16px;" onclick="closeSuccessModal()">关闭</button>
  </div>
</div>

<script src="https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js"></script>
<script>
let videoStream = null, currentTab = 'scan';

// -------------------- 加载记录列表 --------------------
async function loadRecords() {
  const res = await fetch('/api/records');
  const records = await res.json();
  const container = document.getElementById('records');
  container.innerHTML = records.length
    ? records.map(r => \`
      <div class="record">
        <div class="record-info">
          <div><strong>\${escapeHtml(r.issuer || '未分类')}</strong> - \${escapeHtml(r.label)}</div>
          <div class="record-id">\${r.id}</div>
        </div>
        <div style="display:flex; align-items:center; gap:6px;">
          <button class="btn-copy" onclick="copyQueryCode('\${r.id}', this)">📋 复制查询码</button>
          <button class="btn-small" onclick="deleteRecord('\${r.id}')">删除</button>
        </div>
      </div>\`).join('')
    : '<p style="color:var(--gray);">暂无记录</p>';
}
loadRecords();

// -------------------- 通用复制函数 --------------------
function copyText(text, btn) {
  const fallback = () => {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      if (btn) {
        btn.textContent = '✅ 已复制';
        setTimeout(() => btn.textContent = btn.dataset.original || '复制查询码', 1500);
      }
    }).catch(() => {
      fallback();
      if (btn) {
        btn.textContent = '✅ 已复制';
        setTimeout(() => btn.textContent = btn.dataset.original || '复制查询码', 1500);
      }
    });
  } else {
    fallback();
    if (btn) {
      btn.textContent = '✅ 已复制';
      setTimeout(() => btn.textContent = btn.dataset.original || '复制查询码', 1500);
    }
  }
}

// 复制查询码（36位UUID）
function copyQueryCode(id, btn) {
  btn.dataset.original = btn.textContent;
  copyText(id, btn);
}

// 弹窗中复制（根据元素id获取文本）
function copyById(elementId) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const text = el.textContent.trim();
  const btn = event && event.target;
  if (btn) btn.dataset.original = btn.textContent;
  copyText(text, btn);
}

// -------------------- 删除记录 --------------------
async function deleteRecord(id) {
  if (!confirm('删除后该36位码将永久失效，确定？')) return;
  await fetch('/api/delete?id=' + id, { method: 'DELETE' });
  loadRecords();
}

// -------------------- 添加弹窗逻辑 --------------------
function openAddModal() { document.getElementById('add-modal').classList.add('active'); switchTab('scan'); stopCamera(); }
function closeAddModal() { document.getElementById('add-modal').classList.remove('active'); stopCamera(); }

function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('#add-modal .tab').forEach((el,i) => el.classList.toggle('active', (i===0&&tab==='scan')||(i===1&&tab==='manual')));
  document.getElementById('scan-tab').classList.toggle('hidden', tab!=='scan');
  document.getElementById('manual-tab').classList.toggle('hidden', tab!=='manual');
  if (tab === 'scan') startCamera(); else stopCamera();
}

async function startCamera() {
  const video = document.getElementById('qr-video');
  const canvas = document.getElementById('qr-canvas');
  if (videoStream) return;
  try {
    videoStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    video.srcObject = videoStream;
    video.classList.remove('hidden');
    canvas.classList.remove('hidden');
    video.play();
    scanLoop(video, canvas);
  } catch (e) {
    document.getElementById('qr-result').textContent = '摄像头错误：' + e.message;
  }
}
function stopCamera() {
  if (videoStream) { videoStream.getTracks().forEach(t => t.stop()); videoStream = null; }
  document.getElementById('qr-video').classList.add('hidden');
  document.getElementById('qr-canvas').classList.add('hidden');
}
function scanLoop(video, canvas) {
  if (!videoStream) return;
  if (video.readyState === video.HAVE_ENOUGH_DATA) {
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(data.data, canvas.width, canvas.height);
    if (code) { document.getElementById('qr-result').textContent = '✅ 识别成功'; handleOTPUrl(code.data); stopCamera(); return; }
  }
  requestAnimationFrame(() => scanLoop(video, canvas));
}
function parseQRFile() {
  const file = document.getElementById('qr-file').files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.getElementById('qr-canvas');
      canvas.width = img.width; canvas.height = img.height;
      const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, canvas.width, canvas.height);
      if (code) { document.getElementById('qr-result').textContent = '✅ 识别成功'; handleOTPUrl(code.data); }
      else document.getElementById('qr-result').textContent = '❌ 未识别';
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}
function handleOTPUrl(uri) {
  try {
    const url = new URL(uri);
    if (url.protocol !== 'otpauth:') throw new Error('非 otpauth');
    const params = new URLSearchParams(url.search);
    const secret = params.get('secret');
    if (!secret) throw new Error('缺少 secret');
    let label = decodeURIComponent(url.pathname.split(':')[1] || '');
    const issuer = params.get('issuer') || '';
    switchTab('manual');
    document.getElementById('man-label').value = label;
    document.getElementById('man-issuer').value = issuer;
    document.getElementById('man-secret').value = secret;
    closeAddModal();
    if (confirm(\`自动填充完成，是否保存？\n\${issuer} - \${label}\`)) addRecord();
    else openAddModal();
  } catch (err) { alert('二维码解析失败：' + err.message); }
}

async function addRecord() {
  let secret, label, issuer;
  if (currentTab === 'manual') {
    label = document.getElementById('man-label').value.trim();
    issuer = document.getElementById('man-issuer').value.trim();
    secret = document.getElementById('man-secret').value.trim();
    const uri = document.getElementById('man-uri').value.trim();
    if (!secret && uri) {
      try {
        const u = new URL(uri);
        if (u.protocol === 'otpauth:') {
          const p = new URLSearchParams(u.search);
          secret = p.get('secret');
          if (!label) label = decodeURIComponent(u.pathname.split(':')[1] || '');
          if (!issuer) issuer = p.get('issuer') || '';
        }
      } catch {}
    }
    if (!secret || !label) return alert('请填写完整');
  } else {
    return alert('请先扫描或手动输入');
  }
  secret = secret.replace(/\s/g, '').toUpperCase();
  const res = await fetch('/api/add', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret, label, issuer })
  });
  if (res.ok) {
    const record = await res.json();
    closeAddModal();
    document.getElementById('success-id').textContent = record.id;
    document.getElementById('success-secret').textContent = record.secret;
    document.getElementById('success-modal').classList.add('active');
    loadRecords();
  } else {
    const err = await res.json();
    alert(err.error || '添加失败');
  }
}

function closeSuccessModal() {
  document.getElementById('success-modal').classList.remove('active');
}

function escapeHtml(s) { return String(s).replace(/[&<>"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[m]); }
</script>
</body>
</html>`;
}

// ==================== HTML 验证页面 ====================
function getCheckPageHTML() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>验证器</title>
  <style>
    :root { --bg: #0f0f1a; --card: #1a1a2e; --text: #e0e0e0; --green: #00ff88; --red: #ff5555; --gray: #888; }
    body { background:var(--bg); color:var(--text); font-family:system-ui; display:flex; justify-content:center; padding:30px; }
    .container { width:100%; max-width:400px; }
    h1 { text-align:center; }
    .card { background:var(--card); border-radius:12px; padding:20px; margin:16px 0; }
    input { width:100%; padding:10px; margin:8px 0; border:1px solid #333; border-radius:6px; background:#12121f; color:#fff; }
    button { width:100%; padding:10px; border:none; border-radius:6px; font-weight:bold; background:var(--green); color:#000; cursor:pointer; }
    .code { font-size:2.4rem; font-weight:700; letter-spacing:6px; color:var(--green); font-family:monospace; }
    .copy-btn { background:none; border:1px solid #333; color:var(--gray); border-radius:6px; padding:4px 10px; margin-left:8px; cursor:pointer; }
    .timer { color:var(--gray); }
    .progress { height:4px; background:var(--accent, #2a2a4a); border-radius:2px; margin-top:6px; }
    .progress-bar { height:100%; background:var(--green); transition: width 1s linear; border-radius:2px; }
    .hidden { display:none; }
  </style>
</head>
<body>
<div class="container">
  <h1>🔐 验证码查询</h1>
  <input type="text" id="code-input" placeholder="输入 36 位代码">
  <button onclick="loadCode()">查询</button>
  <div id="result" class="hidden card">
    <div id="issuer"></div>
    <div id="label" style="font-weight:500;"></div>
    <div style="display:flex; align-items:center; margin:10px 0;">
      <span class="code" id="code"></span>
      <button class="copy-btn" onclick="copyCode()">📋</button>
    </div>
    <div class="timer">⏳ 剩余 <span id="remain"></span> 秒</div>
    <div class="progress"><div class="progress-bar" id="bar"></div></div>
  </div>
  <div id="error" style="color:var(--red); margin-top:10px;"></div>
</div>
<script>
let currentCode = '', interval = null, secret = '';

async function loadCode() {
  const id = document.getElementById('code-input').value.trim();
  if (!id) return;
  const res = await fetch('/api/record?id=' + id);
  if (!res.ok) {
    document.getElementById('error').textContent = '记录不存在';
    document.getElementById('result').classList.add('hidden');
    return;
  }
  const record = await res.json();
  secret = record.secret;
  document.getElementById('issuer').textContent = record.issuer || '未分类';
  document.getElementById('label').textContent = record.label;
  document.getElementById('result').classList.remove('hidden');
  document.getElementById('error').textContent = '';
  updateCode();
  clearInterval(interval);
  interval = setInterval(updateCode, 1000);
}

async function updateCode() {
  const keyBuffer = base32ToBuffer(secret);
  const now = Math.floor(Date.now()/1000);
  const counter = Math.floor(now/30);
  const remain = 30 - (now % 30);
  const code = await generateHOTP(keyBuffer, counter);
  currentCode = code;
  document.getElementById('code').textContent = code;
  document.getElementById('remain').textContent = remain;
  document.getElementById('bar').style.width = (remain/30)*100 + '%';
}

function copyCode() {
  const text = currentCode;
  const btn = document.querySelector('.copy-btn');
  if (!text) return;

  const fallback = () => {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  };

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      btn.textContent = '✅';
      setTimeout(() => btn.textContent = '📋', 1500);
    }).catch(() => {
      fallback();
      btn.textContent = '✅';
      setTimeout(() => btn.textContent = '📋', 1500);
    });
  } else {
    fallback();
    btn.textContent = '✅';
    setTimeout(() => btn.textContent = '📋', 1500);
  }
}

function base32ToBuffer(b32) {
  const alph = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  b32 = b32.replace(/=+$/,'').toUpperCase();
  for(let c of b32) { const v = alph.indexOf(c); if(v>=0) bits += v.toString(2).padStart(5,'0'); }
  const bytes = [];
  for(let i=0; i+8<=bits.length; i+=8) bytes.push(parseInt(bits.substr(i,8),2));
  return new Uint8Array(bytes);
}
async function generateHOTP(key, counter) {
  const cb = new ArrayBuffer(8); new DataView(cb).setBigUint64(0, BigInt(counter), false);
  const ck = await crypto.subtle.importKey('raw', key, {name:'HMAC', hash:'SHA-1'}, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', ck, cb);
  const hmac = new Uint8Array(sig);
  const off = hmac[19] & 0xf;
  const bin = ((hmac[off] & 0x7f) << 24) | (hmac[off+1] << 16) | (hmac[off+2] << 8) | hmac[off+3];
  return String(bin % 1000000).padStart(6, '0');
}
</script>
</body>
</html>`;
}
```

2. KV变量名： KV