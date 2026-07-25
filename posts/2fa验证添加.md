# 2fa验证添加项目

## worker代码

```js
/**
 * 纯 JS 实现 TOTP 验证，不依赖任何外部模块
 * 兼容 Cloudflare Workers 的 Web Crypto API
 */

// 将 Base32 字符串转为字节数组（TOTP 密钥通常是 Base32）
function base32ToBytes(base32) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  let bytes = [];
  base32 = base32.replace(/=+$/, '').toUpperCase();
  for (let i = 0; i < base32.length; i++) {
    const val = alphabet.indexOf(base32[i]);
    if (val === -1) throw new Error('Invalid base32 character');
    bits += val.toString(2).padStart(5, '0');
  }
  for (let i = 0; i + 7 < bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return new Uint8Array(bytes);
}

// 数字转为大端字节数组（固定长度）
function intToBigEndian(num, bytes) {
  const arr = new Uint8Array(bytes);
  for (let i = bytes - 1; i >= 0; i--) {
    arr[i] = num & 0xff;
    num >>= 8;
  }
  return arr;
}

// 使用 Web Crypto API 计算 HMAC-SHA1
async function hmacSha1(keyBytes, messageBytes) {
  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, messageBytes);
  return new Uint8Array(signature);
}

// 验证 TOTP token
async function verifyTOTP(secret, token, window = 1) {
  const keyBytes = base32ToBytes(secret);
  const now = Math.floor(Date.now() / 1000);
  const timeStep = 30;
  const counter = Math.floor(now / timeStep);

  for (let offset = -window; offset <= window; offset++) {
    const counterBytes = intToBigEndian(counter + offset, 8);
    const hmacResult = await hmacSha1(keyBytes, counterBytes);
    const offsetIdx = hmacResult[19] & 0xf;
    const binaryCode =
      ((hmacResult[offsetIdx] & 0x7f) << 24) |
      ((hmacResult[offsetIdx + 1] & 0xff) << 16) |
      ((hmacResult[offsetIdx + 2] & 0xff) << 8) |
      (hmacResult[offsetIdx + 3] & 0xff);
    const code = (binaryCode % 1000000).toString().padStart(6, '0');
    if (code === token) return true;
  }
  return false;
}

// ========== 主 Worker 逻辑 ==========
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 处理验证码提交
    if (request.method === 'POST' && url.pathname === '/__2fa_login') {
      return handleLogin(request, env);
    }

    // 检查认证 Cookie
    if (await isAuthenticated(request, env)) {
      return fetchOrigin(request, env);
    } else {
      return loginPage();
    }
  }
};

async function handleLogin(request, env) {
  const formData = await request.formData();
  const token = formData.get('token');

  // 使用自定义 verifyTOTP 替换原来的 TOTP.verify
  const valid = await verifyTOTP(env.TOTP_SECRET, token, 2);

  if (valid) {
    const cookie = await generateCookie(env.COOKIE_SECRET);
    return new Response('', {
      status: 302,
      headers: {
        'Location': '/',
        'Set-Cookie': cookie,
      },
    });
  } else {
    return loginPage('验证码错误，请重新输入。');
  }
}

async function isAuthenticated(request, env) {
  const cookieHeader = request.headers.get('Cookie') || '';
  const cookies = parseCookies(cookieHeader);
  const authToken = cookies['auth_token'];
  if (!authToken) return false;

  const [payload, signature] = authToken.split('.');
  if (!payload || !signature) return false;

  // 验证签名
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(env.COOKIE_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );
  const sigValid = await crypto.subtle.verify(
    'HMAC',
    key,
    hexToArrayBuffer(signature),
    new TextEncoder().encode(payload)
  );
  if (!sigValid) return false;

  const decoded = JSON.parse(atob(payload));
  return decoded.exp > Date.now() / 1000;
}

async function generateCookie(secret) {
  const exp = Math.floor(Date.now() / 1000) + 8 * 3600;
  const payload = btoa(JSON.stringify({ exp }));

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(payload)
  );
  const sigHex = bufferToHex(signature);
  const token = `${payload}.${sigHex}`;
  return `auth_token=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${8 * 3600}`;
}

async function fetchOrigin(request, env) {
  const url = new URL(request.url);
  url.hostname = 'example.com'; // 🔁 替换成你的需要添加2fa验证的域名

  const modifiedRequest = new Request(url.toString(), request);
  modifiedRequest.headers.set('X-Origin-Auth', env.AUTH_HEADER_SECRET);
  return fetch(modifiedRequest);
}

function loginPage(errorMsg = '') {
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>博客 - 两步验证</title>
    <style>
        :root {
            --bg-start: #e8ecf2;
            --bg-mid: #dfe4ed;
            --bg-end: #d5dbe6;
            --card-bg: #ffffff;
            --text-primary: #1a1d23;
            --text-secondary: #5c6370;
            --text-muted: #8b919d;
            --border: #dde1e8;
            --border-focus: #3b6df0;
            --border-error: #e54d4d;
            --shadow-card: 0 1px 3px rgba(0, 0, 0, 0.04), 0 8px 32px rgba(0, 0, 0, 0.07);
            --shadow-card-hover: 0 1px 3px rgba(0, 0, 0, 0.04), 0 12px 40px rgba(0, 0, 0, 0.10);
            --shadow-focus-ring: 0 0 0 3px rgba(59, 109, 240, 0.15);
            --shadow-error-ring: 0 0 0 3px rgba(229, 77, 77, 0.12);
            --radius-card: 16px;
            --radius-input: 12px;
            --radius-btn: 10px;
            --transition-fast: 0.15s cubic-bezier(0.4, 0, 0.2, 1);
            --transition-smooth: 0.25s cubic-bezier(0.4, 0, 0.2, 1);
            --font-mono: 'SF Mono', 'Cascadia Code', 'Consolas', 'Monaco', 'JetBrains Mono', monospace;
        }

        * {
            box-sizing: border-box;
        }

        body {
            font-family: system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
            background:
                radial-gradient(ellipse 80% 60% at 30% 20%, #e3eaf5 0%, transparent 55%),
                radial-gradient(ellipse 60% 50% at 75% 70%, #dce3f0 0%, transparent 55%),
                radial-gradient(ellipse 50% 40% at 50% 50%, #e6ebf3 0%, transparent 60%),
                linear-gradient(180deg, #ecf0f6 0%, #e0e5ee 40%, #d9dfe9 100%);
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            padding: 1rem;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
            position: relative;
            overflow-x: hidden;
        }

        /* 装饰性背景光斑 */
        body::before {
            content: '';
            position: fixed;
            top: -120px;
            right: -80px;
            width: 380px;
            height: 380px;
            background: radial-gradient(circle, rgba(139, 165, 220, 0.22) 0%, transparent 70%);
            border-radius: 50%;
            pointer-events: none;
            z-index: 0;
            animation: floatBlob1 18s ease-in-out infinite;
        }

        body::after {
            content: '';
            position: fixed;
            bottom: -100px;
            left: -60px;
            width: 300px;
            height: 300px;
            background: radial-gradient(circle, rgba(120, 150, 210, 0.18) 0%, transparent 70%);
            border-radius: 50%;
            pointer-events: none;
            z-index: 0;
            animation: floatBlob2 20s ease-in-out infinite;
        }

        @keyframes floatBlob1 {
            0%,
            100% {
                transform: translate(0, 0) scale(1);
            }
            25% {
                transform: translate(-30px, 20px) scale(1.08);
            }
            50% {
                transform: translate(-10px, -15px) scale(0.94);
            }
            75% {
                transform: translate(20px, 10px) scale(1.05);
            }
        }

        @keyframes floatBlob2 {
            0%,
            100% {
                transform: translate(0, 0) scale(1);
            }
            33% {
                transform: translate(20px, -25px) scale(1.1);
            }
            66% {
                transform: translate(-15px, 10px) scale(0.92);
            }
        }

        /* 主卡片 */
        .card {
            position: relative;
            z-index: 1;
            background: var(--card-bg);
            padding: 2.5rem 2rem 2rem;
            border-radius: var(--radius-card);
            box-shadow: var(--shadow-card);
            max-width: 400px;
            width: 100%;
            transition: box-shadow var(--transition-smooth);
            animation: cardEntrance 0.5s cubic-bezier(0.22, 0.61, 0.36, 1) both;
        }

        @keyframes cardEntrance {
            from {
                opacity: 0;
                transform: translateY(16px) scale(0.97);
            }
            to {
                opacity: 1;
                transform: translateY(0) scale(1);
            }
        }

        .card:hover {
            box-shadow: var(--shadow-card-hover);
        }

        /* 顶部图标区域 */
        .icon-wrap {
            display: flex;
            justify-content: center;
            margin-bottom: 1.5rem;
        }

        .icon-circle {
            width: 56px;
            height: 56px;
            border-radius: 50%;
            background: linear-gradient(135deg, #eef3ff 0%, #e2e9fa 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
        }

        .icon-circle::after {
            content: '';
            position: absolute;
            inset: -4px;
            border-radius: 50%;
            border: 2px solid transparent;
            background: linear-gradient(135deg, rgba(59, 109, 240, 0.25), rgba(59, 109, 240, 0.06)) border-box;
            -webkit-mask: linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0);
            -webkit-mask-composite: xor;
            mask-composite: exclude;
        }

        .icon-shield {
            width: 26px;
            height: 30px;
            flex-shrink: 0;
        }

        /* 标题 */
        .title {
            text-align: center;
            font-size: 1.35rem;
            font-weight: 700;
            color: var(--text-primary);
            margin: 0 0 0.4rem;
            letter-spacing: -0.01em;
        }

        .subtitle {
            text-align: center;
            font-size: 0.9rem;
            color: var(--text-secondary);
            margin: 0 0 1.6rem;
            line-height: 1.5;
        }

        /* 错误信息 */
        .error-banner {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            background: #fef2f2;
            border: 1px solid #fecaca;
            border-radius: 10px;
            padding: 0.7rem 0.9rem;
            margin-bottom: 1.2rem;
            color: #b91c1c;
            font-size: 0.85rem;
            font-weight: 500;
            animation: shakeError 0.5s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
        }

        @keyframes shakeError {
            0%,
            100% {
                transform: translateX(0);
            }
            15% {
                transform: translateX(-6px);
            }
            30% {
                transform: translateX(6px);
            }
            45% {
                transform: translateX(-4px);
            }
            60% {
                transform: translateX(4px);
            }
            75% {
                transform: translateX(-2px);
            }
            90% {
                transform: translateX(2px);
            }
        }

        .error-banner .error-icon {
            flex-shrink: 0;
            width: 18px;
            height: 18px;
        }

        /* 验证码输入组 */
        .code-group {
            display: flex;
            gap: 10px;
            justify-content: center;
            margin-bottom: 1.4rem;
        }

        .code-input {
            width: 48px;
            height: 56px;
            text-align: center;
            font-size: 1.35rem;
            font-weight: 600;
            font-family: var(--font-mono);
            letter-spacing: 0.02em;
            color: var(--text-primary);
            border: 2px solid var(--border);
            border-radius: var(--radius-input);
            background: #fafbfc;
            outline: none;
            transition:
                border-color var(--transition-fast),
                box-shadow var(--transition-fast),
                background var(--transition-fast),
                transform var(--transition-fast);
            -webkit-appearance: none;
            -moz-appearance: textfield;
            caret-color: var(--border-focus);
        }

        .code-input::-webkit-outer-spin-button,
        .code-input::-webkit-inner-spin-button {
            -webkit-appearance: none;
            margin: 0;
        }

        .code-input:hover {
            border-color: #c5cdd8;
            background: #f7f8fa;
        }

        .code-input:focus {
            border-color: var(--border-focus);
            background: #ffffff;
            box-shadow: var(--shadow-focus-ring);
            transform: translateY(-1px);
            z-index: 2;
            position: relative;
        }

        .code-input.filled {
            border-color: #bcc7d6;
            background: #f6f8fb;
        }

        .code-input.has-error {
            border-color: var(--border-error);
            background: #fffbfb;
            box-shadow: var(--shadow-error-ring);
            animation: pulseError 1.5s ease-in-out 1;
        }

        @keyframes pulseError {
            0%,
            100% {
                box-shadow: 0 0 0 3px rgba(229, 77, 77, 0.12);
            }
            50% {
                box-shadow: 0 0 0 8px rgba(229, 77, 77, 0.03);
            }
        }

        /* 隐藏的提交input */
        .hidden-submit {
            position: absolute;
            opacity: 0;
            width: 0;
            height: 0;
            pointer-events: none;
            tab-index: -1;
        }

        /* 按钮 */
        .btn {
            display: block;
            width: 100%;
            padding: 0.8rem 1.2rem;
            background: linear-gradient(180deg, #1d1f27 0%, #14161c 100%);
            color: #ffffff;
            border: none;
            border-radius: var(--radius-btn);
            font-size: 0.95rem;
            font-weight: 600;
            letter-spacing: 0.01em;
            cursor: pointer;
            transition:
                background var(--transition-fast),
                transform var(--transition-fast),
                box-shadow var(--transition-fast),
                opacity var(--transition-fast);
            position: relative;
            overflow: hidden;
            -webkit-tap-highlight-color: transparent;
        }

        .btn:hover {
            background: linear-gradient(180deg, #2a2d37 0%, #1d2029 100%);
            box-shadow: 0 4px 16px rgba(20, 22, 28, 0.25);
            transform: translateY(-1px);
        }

        .btn:active {
            transform: translateY(0) scale(0.985);
            box-shadow: 0 2px 8px rgba(20, 22, 28, 0.2);
            transition: transform 0.08s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .btn:focus-visible {
            outline: 3px solid rgba(59, 109, 240, 0.5);
            outline-offset: 2px;
        }

        .btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
            transform: none;
            box-shadow: none;
            pointer-events: none;
        }

        /* 按钮加载动画 */
        .btn .spinner {
            display: none;
            width: 18px;
            height: 18px;
            border: 2.5px solid rgba(255, 255, 255, 0.3);
            border-top-color: #ffffff;
            border-radius: 50%;
            animation: spin 0.7s linear infinite;
            margin-right: 8px;
            vertical-align: middle;
        }

        @keyframes spin {
            to {
                transform: rotate(360deg);
            }
        }

        .btn.is-loading .spinner {
            display: inline-block;
        }

        .btn.is-loading .btn-text {
            display: inline;
        }

        /* 底部提示 */
        .footer-hint {
            text-align: center;
            margin-top: 1.2rem;
            font-size: 0.8rem;
            color: var(--text-muted);
            line-height: 1.4;
        }

        .footer-hint span {
            display: inline-block;
            vertical-align: middle;
        }

        .dot-indicator {
            display: inline-block;
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: #c5cdd8;
            margin: 0 5px;
            vertical-align: middle;
        }

        /* 响应式 */
        @media (max-width: 420px) {
            .card {
                padding: 2rem 1.2rem 1.6rem;
                border-radius: 14px;
            }

            .code-group {
                gap: 7px;
            }

            .code-input {
                width: 40px;
                height: 50px;
                font-size: 1.2rem;
                border-radius: 10px;
            }

            .title {
                font-size: 1.2rem;
            }

            .subtitle {
                font-size: 0.82rem;
                margin-bottom: 1.3rem;
            }

            .icon-circle {
                width: 48px;
                height: 48px;
            }

            .icon-shield {
                width: 22px;
                height: 26px;
            }
        }

        @media (max-width: 340px) {
            .code-group {
                gap: 5px;
            }

            .code-input {
                width: 35px;
                height: 46px;
                font-size: 1.05rem;
                border-radius: 8px;
            }

            .card {
                padding: 1.5rem 0.8rem 1.3rem;
            }
        }
    </style>
</head>
<body>

    <div class="card">
        <!-- 盾牌图标 -->
        <div class="icon-wrap">
            <div class="icon-circle">
                <!-- 简约盾牌+对勾 SVG -->
                <svg class="icon-shield" viewBox="0 0 26 30" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M13 1.5L2.5 5.8V14.2C2.5 20.8 7.2 26.9 13 28.5C18.8 26.9 23.5 20.8 23.5 14.2V5.8L13 1.5Z"
                    fill="#3b6df0"
                    stroke="#3b6df0"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round" />
                    <path d="M9 14.5L11.8 17.3L17.5 11.5"
                    stroke="white"
                    stroke-width="2.5"
                    stroke-linecap="round"
                    stroke-linejoin="round" />
                </svg>
            </div>
        </div>

        <!-- 标题 -->
        <h2 class="title">两步验证</h2>
        <p class="subtitle">请输入你的验证器 App 上显示的 6 位验证码</p>

        <!-- 服务端错误信息（保留原有模板语法） -->
        ${errorMsg ? `
        <div class="error-banner" id="serverError">
            <svg class="error-icon" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="10" cy="10" r="9" stroke="#b91c1c" stroke-width="1.8" fill="none"/>
                <path d="M10 6v4.5" stroke="#b91c1c" stroke-width="2" stroke-linecap="round"/>
                <circle cx="10" cy="14.5" r="1.2" fill="#b91c1c"/>
            </svg>
            <span>${errorMsg}</span>
        </div>
        ` : ''}

        <!-- 表单 -->
        <form method="post" action="/__2fa_login" id="twoFactorForm" autocomplete="off">
            <!-- 隐藏的实际提交字段 -->
            <input type="hidden" name="token" id="hiddenToken" value="">

            <!-- 6个视觉输入框 -->
            <div class="code-group" id="codeGroup">
                <input type="text"
                class="code-input"
                inputmode="numeric"
                pattern="[0-9]"
                maxlength="1"
                autocomplete="one-time-code"
                data-index="0"
                id="code0"
                required>
                <input type="text"
                class="code-input"
                inputmode="numeric"
                pattern="[0-9]"
                maxlength="1"
                autocomplete="off"
                data-index="1"
                id="code1">
                <input type="text"
                class="code-input"
                inputmode="numeric"
                pattern="[0-9]"
                maxlength="1"
                autocomplete="off"
                data-index="2"
                id="code2">
                <input type="text"
                class="code-input"
                inputmode="numeric"
                pattern="[0-9]"
                maxlength="1"
                autocomplete="off"
                data-index="3"
                id="code3">
                <input type="text"
                class="code-input"
                inputmode="numeric"
                pattern="[0-9]"
                maxlength="1"
                autocomplete="off"
                data-index="4"
                id="code4">
                <input type="text"
                class="code-input"
                inputmode="numeric"
                pattern="[0-9]"
                maxlength="1"
                autocomplete="off"
                data-index="5"
                id="code5">
            </div>

            <!-- 提交按钮 -->
            <button type="submit" class="btn" id="submitBtn">
                <span class="spinner"></span>
                <span class="btn-text">验证</span>
            </button>
        </form>

        <!-- 底部提示 -->
        <p class="footer-hint">
            <span>🔐 安全验证</span>
            <span class="dot-indicator"></span>
            <span>代码每 30 秒刷新</span>
        </p>
    </div>

    <script>
        (function() {
            const form = document.getElementById('twoFactorForm');
            const hiddenToken = document.getElementById('hiddenToken');
            const codeInputs = document.querySelectorAll('.code-input');
            const submitBtn = document.getElementById('submitBtn');
            const serverError = document.getElementById('serverError');
            const totalInputs = codeInputs.length;

            // 如果服务端返回了错误，给所有输入框添加错误样式
            if (serverError) {
                codeInputs.forEach(input => {
                    input.classList.add('has-error');
                });
                // 自动聚焦到第一个输入框
                codeInputs[0].focus();
                // 3秒后移除脉冲动画类（保留红色边框）
                setTimeout(() => {
                    codeInputs.forEach(input => {
                        input.classList.remove('has-error');
                    });
                }, 2000);
            } else {
                // 自动聚焦第一个输入框
                codeInputs[0].focus();
            }

            // 合并所有输入框的值并设置到隐藏input
            function updateHiddenToken() {
                let token = '';
                codeInputs.forEach(input => {
                    token += input.value;
                });
                hiddenToken.value = token;
                return token;
            }

            // 检查是否所有输入框都已填写
            function isAllFilled() {
                let allFilled = true;
                codeInputs.forEach(input => {
                    if (!input.value || !/^[0-9]$/.test(input.value)) {
                        allFilled = false;
                    }
                    // 更新filled类
                    if (input.value && /^[0-9]$/.test(input.value)) {
                        input.classList.add('filled');
                    } else {
                        input.classList.remove('filled');
                    }
                });
                return allFilled;
            }

            // 自动提交计时器
            let autoSubmitTimer = null;

            function maybeAutoSubmit() {
                // 清除之前的计时器
                if (autoSubmitTimer) {
                    clearTimeout(autoSubmitTimer);
                    autoSubmitTimer = null;
                }

                if (isAllFilled()) {
                    updateHiddenToken();
                    // 短暂延迟后自动提交，给用户视觉反馈
                    autoSubmitTimer = setTimeout(() => {
                        if (isAllFilled() && hiddenToken.value.length === totalInputs) {
                            submitForm();
                        }
                    }, 350);
                }
            }

            // 提交表单
            function submitForm() {
                if (submitBtn.disabled) return;

                const token = updateHiddenToken();
                if (token.length !== totalInputs) return;
                if (!/^[0-9]{6}$/.test(token)) return;

                // 显示加载状态
                submitBtn.classList.add('is-loading');
                submitBtn.disabled = true;
                const btnText = submitBtn.querySelector('.btn-text');
                if (btnText) btnText.textContent = '验证中...';

                // 提交
                form.submit();
            }

            // 处理单个输入框的输入
            function handleInput(event) {
                const input = event.target;
                const value = input.value;
                const index = parseInt(input.getAttribute('data-index'));

                // 只保留数字
                const cleaned = value.replace(/[^0-9]/g, '');

                if (cleaned.length > 0) {
                    // 取第一个数字
                    input.value = cleaned.charAt(0);

                    // 移除错误样式
                    input.classList.remove('has-error');
                    codeInputs.forEach(inp => inp.classList.remove('has-error'));

                    // 自动跳转到下一个输入框
                    if (index < totalInputs - 1) {
                        codeInputs[index + 1].focus();
                        // 如果粘贴了多个字符，把剩余的分发到后面的框
                        if (cleaned.length > 1 && index < totalInputs - 1) {
                            distributePastedDigits(cleaned, index);
                        }
                    }
                } else {
                    input.value = '';
                }

                updateHiddenToken();
                updateFilledClasses();
                maybeAutoSubmit();
            }

            // 分发粘贴的数字到各个输入框
            function distributePastedDigits(digits, startIndex) {
                const chars = digits.replace(/[^0-9]/g, '').split('');
                let idx = startIndex;
                for (let i = 0; i < chars.length && idx < totalInputs; i++) {
                    codeInputs[idx].value = chars[i];
                    codeInputs[idx].classList.remove('has-error');
                    idx++;
                }
                // 聚焦到最后一个被填充的框或下一个空框
                const focusIndex = Math.min(idx, totalInputs - 1);
                codeInputs[focusIndex].focus();
                // 如果该框已有值，选中它以便覆盖
                if (codeInputs[focusIndex].value) {
                    codeInputs[focusIndex].select();
                }
                updateHiddenToken();
                updateFilledClasses();
                maybeAutoSubmit();
            }

            // 处理粘贴事件
            function handlePaste(event) {
                event.preventDefault();
                const pasteData = (event.clipboardData || window.clipboardData).getData('text');
                const digits = pasteData.replace(/[^0-9]/g, '');

                if (digits.length === 0) return;

                const targetInput = event.target;
                const startIndex = parseInt(targetInput.getAttribute('data-index'));

                // 清空所有输入框
                codeInputs.forEach(inp => {
                    inp.value = '';
                    inp.classList.remove('has-error');
                });

                // 分发数字
                const chars = digits.split('');
                for (let i = 0; i < chars.length && i < totalInputs; i++) {
                    codeInputs[i].value = chars[i];
                }

                // 聚焦到适当位置
                const focusIndex = Math.min(chars.length, totalInputs - 1);
                codeInputs[focusIndex].focus();
                if (codeInputs[focusIndex].value && chars.length >= totalInputs) {
                    codeInputs[focusIndex].select();
                }

                updateHiddenToken();
                updateFilledClasses();
                maybeAutoSubmit();
            }

            // 处理键盘事件（退格键导航）
            function handleKeyDown(event) {
                const input = event.target;
                const index = parseInt(input.getAttribute('data-index'));
                const key = event.key;

                if (key === 'Backspace') {
                    if (input.value === '') {
                        // 当前框为空，跳到前一个框并清空它
                        if (index > 0) {
                            event.preventDefault();
                            codeInputs[index - 1].focus();
                            codeInputs[index - 1].value = '';
                            codeInputs[index - 1].classList.remove('filled');
                            updateHiddenToken();
                            updateFilledClasses();
                        }
                    } else {
                        // 当前框有值，正常删除（handleInput会处理）
                        // 但这里需要先清空再让input事件处理
                        // 实际上浏览器默认行为会先删除字符，然后触发input
                        // 我们只需要在删除后更新状态
                        setTimeout(() => {
                            updateHiddenToken();
                            updateFilledClasses();
                        }, 10);
                    }
                } else if (key === 'ArrowLeft' && input.selectionStart === 0 && index > 0) {
                    // 左箭头在光标在开头时跳到前一个框
                    codeInputs[index - 1].focus();
                    codeInputs[index - 1].select();
                } else if (key === 'ArrowRight' && input.selectionStart === input.value.length && index <
                    totalInputs - 1) {
                    // 右箭头在光标在末尾时跳到后一个框
                    codeInputs[index + 1].focus();
                    codeInputs[index + 1].select();
                } else if (key === 'Enter') {
                    // 回车提交
                    event.preventDefault();
                    if (isAllFilled() && hiddenToken.value.length === totalInputs) {
                        submitForm();
                    }
                }
            }

            // 处理焦点事件
            function handleFocus(event) {
                const input = event.target;
                // 选中已有内容，方便覆盖输入
                if (input.value) {
                    input.select();
                }
            }

            // 更新所有输入框的filled类
            function updateFilledClasses() {
                codeInputs.forEach(input => {
                    if (input.value && /^[0-9]$/.test(input.value)) {
                        input.classList.add('filled');
                    } else {
                        input.classList.remove('filled');
                    }
                });
            }

            // 绑定事件
            codeInputs.forEach(input => {
                input.addEventListener('input', handleInput);
                input.addEventListener('paste', handlePaste);
                input.addEventListener('keydown', handleKeyDown);
                input.addEventListener('focus', handleFocus);

                // 阻止非数字字符（额外的安全层）
                input.addEventListener('beforeinput', function(e) {
                    if (e.data && !/^[0-9]$/.test(e.data) && e.inputType === 'insertText') {
                        // 允许粘贴（粘贴会触发insertFromPaste）
                        if (e.inputType !== 'insertFromPaste') {
                            e.preventDefault();
                        }
                    }
                });
            });

            // 表单提交拦截
            form.addEventListener('submit', function(event) {
                const token = updateHiddenToken();
                if (token.length !== totalInputs || !/^[0-9]{6}$/.test(token)) {
                    event.preventDefault();
                    // 高亮空输入框
                    codeInputs.forEach(input => {
                        if (!input.value || !/^[0-9]$/.test(input.value)) {
                            input.classList.add('has-error');
                            input.focus();
                            return; // 只聚焦第一个空的
                        }
                    });
                    // 震动效果
                    const codeGroup = document.getElementById('codeGroup');
                    codeGroup.style.animation = 'shakeError 0.5s cubic-bezier(0.36, 0.07, 0.19, 0.97)';
                    setTimeout(() => {
                        codeGroup.style.animation = '';
                    }, 500);
                    return;
                }

                // 验证通过，显示加载状态
                if (!submitBtn.disabled) {
                    submitBtn.classList.add('is-loading');
                    submitBtn.disabled = true;
                    const btnText = submitBtn.querySelector('.btn-text');
                    if (btnText) btnText.textContent = '验证中...';
                }
            });

            // 初始状态更新
            updateFilledClasses();
            updateHiddenToken();

            // 如果服务端有错误，预检查
            if (serverError) {
                updateFilledClasses();
            }

            console.log('🔐 两步验证页面已就绪');
        })();
    </script>
</body>
</html>`;
  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

// 工具函数
function parseCookies(cookie) {
  return Object.fromEntries(cookie.split(';').map(c => c.trim().split('=')));
}
function bufferToHex(buffer) {
  return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}
function hexToArrayBuffer(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes.buffer;
}
```

## 变量设置

1.win+R打开cmd命令提示行，分别输入：

```bash
1. //注意：如果没反应则改成python3
python3 -c "import base64, os; print(base64.b32encode(os.urandom(10)).decode('utf-8'))"

eg：输出  K5JRSGKLKANGEM6Y --->对应变量： TOTP_SECRET

2. python -c "import secrets; print(secrets.token_hex(32))"

eg: 输出  d600c0ebbbe747b02c692159de6e0d5c6189c92dca08b4ca68ab45ab64709197  --->对应变量： COOKIE_SECRET


3. python -c "import secrets; print(secrets.token_hex(32))"

eg: 输出  0c34bae75104cec4044abffabfb3136015bec83d145657631e8474c9a63ce42e  --->对应变量： AUTH_HEADER_SECRET
```

## 添加2fa设备

1.打开你的2fa app，例如：Google Authenticator 或者 Microsoft Authenticator

2.输入`TOTP_SECRET`对应的代码，例如：K5JRSGKLKANGEM6Y，就能获得30秒一刷新的验证码

