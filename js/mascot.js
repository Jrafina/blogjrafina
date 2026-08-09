/**
 * 看板娘（博客小宠物）— 剑妈增强版
 * ==============================
 * 功能：
 *   - 悬浮在页面角落，待机时轻轻漂浮
 *   - 点击切换姿势，随机播放弹跳/摇摆/转圈/蹦跳/压扁动画之一
 *   - 按住可拖动，松手有专属台词
 *   - 鼠标靠近会随机搭话（带冷却，防止刷屏）
 *   - 每隔一段时间自己动一下、说句话
 *
 * 使用步骤：
 *   1. 图片已上传到图床（链接备份在 tools/看板娘图床链接.txt），填在下方 CFG.images
 *   2. 台词按角色性格改 CFG 里的 clickLines / dragLines / idleLines / nearLines
 *   3. 改完刷新页面即可生效
 */
(function () {
    'use strict';

    // ==================== 配置区（改这里！） ====================
    const CFG = {
        // 姿势图片：几张图 = 几个姿势，点击按顺序循环切换
        // 注意索引：mascot-3 是第 3 张（索引 2，向右飘姿势），
        //           mascot-7 是第 7 张（索引 6，向左飘姿势）——横飘动作依赖这两个位置
        images: [
            'https://img.1795857.xyz/file/博客/剑妈看板娘/mascot-1.png',
            'https://img.1795857.xyz/file/博客/剑妈看板娘/mascot-2.png',
            'https://img.1795857.xyz/file/博客/剑妈看板娘/mascot-3.png',
            'https://img.1795857.xyz/file/博客/剑妈看板娘/mascot-4.png',
            'https://img.1795857.xyz/file/博客/剑妈看板娘/mascot-5.png',
            'https://img.1795857.xyz/file/博客/剑妈看板娘/mascot-6.png',
            'https://img.1795857.xyz/file/博客/剑妈看板娘/mascot-7.png',
        ],
        // 显示大小（像素）
        size: 170,
        // 初始位置：'left' 左下角 / 'right' 右下角（之后可以随意拖动）
        corner: 'left',
        // 点击时的台词
        clickLines: [
            '别戳我啦，小心我砍你哦～',
            '哎呀！又打扰我看文章！',
            '这个姿势怎么样？好看吗？',
            '哼！你再戳我就飞走了！',
            '想让我换个姿势？也不是不行～',
            '嘿嘿，被我迷住了吧？',
        ],
        // 被拖动松手时的台词
        dragLines: [
            '喂喂，把我放下来！',
            '我飞！我可是会飞的！',
            '被你拎来拎去好晕……',
            '这里风景不错，就待这吧！',
            '哼，乱动我可是要生气的！',
        ],
        // 随机待机时的台词
        idleLines: [
            '欢迎光临 Jrafina 的博客～',
            '今天的文章写得不错呢！',
            '看文章累了吧？休息一下～',
            '摸鱼中……别告诉别人！',
            '我在这里守护你的博客哦！',
            '要不要去留言板说两句？',
            '主人今天也在认真学习呢～',
            '我飘我飘～',
        ],
        // 鼠标靠近时的台词
        nearLines: [
            '你靠这么近干嘛！',
            '咦？发现你了～',
            '离我远一点啦！',
            '想看我吗？好看吧！',
            '小心我咬你哦！',
        ],
        // 气泡停留时长（毫秒）
        bubbleDuration: 3500,
        // 随机待机动作间隔（毫秒）
        idleInterval: 30000,
        // 鼠标靠近多少像素内会触发反应
        proximityRange: 140,
        // 靠近反应的冷却时间（毫秒）
        proximityCooldown: 10000,
    };
    // ==================== 配置区结束 ====================

    if (!CFG.images.length) return;

    // 动作动画池：点击 / 待机时随机挑一个
    const ANIMS = ['bounce', 'wiggle', 'spin', 'jump', 'squash'];

    // 本地存储：跨页面记住她的位置和姿势（切换文章时不重置）
    const STORE_KEY = 'mascot-state';

    // ---------- 构建 DOM ----------
    const wrap = document.createElement('div');
    wrap.className = 'mascot';
    wrap.style.setProperty('--mascot-size', CFG.size + 'px');
    wrap.innerHTML =
        '<div class="mascot-bubble"><span></span></div>' +
        '<img class="mascot-img" alt="剑妈看板娘" draggable="false">';
    document.body.appendChild(wrap);

    const img = wrap.querySelector('.mascot-img');
    const bubble = wrap.querySelector('.mascot-bubble');
    const bubbleText = bubble.querySelector('span');

    // ---------- 初始位置：恢复上次的位置，否则贴边 ----------
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); } catch (_) { /* 隐私模式等场景 */ }
    const MARGIN = 16;
    if (saved && typeof saved.left === 'number' && typeof saved.top === 'number') {
        // 按当前视口夹取，防止上次位置在新窗口尺寸下出界
        const w = wrap.offsetWidth, h = wrap.offsetHeight;
        wrap.style.left = Math.min(Math.max(0, saved.left), Math.max(0, window.innerWidth - w)) + 'px';
        wrap.style.top = Math.min(Math.max(0, saved.top), Math.max(0, window.innerHeight - h)) + 'px';
        wrap.style.right = 'auto';
        wrap.style.bottom = 'auto';
    } else {
        if (CFG.corner === 'right') wrap.style.right = MARGIN + 'px';
        else wrap.style.left = MARGIN + 'px';
        wrap.style.bottom = MARGIN + 'px';
    }

    // ---------- 状态 ----------
    let poseIndex = -1;
    let bubbleTimer = null;
    let dragging = false;
    let moved = false;
    let startX = 0, startY = 0, startLeft = 0, startTop = 0;
    let lastProximityAt = 0;
    let currentAnim = '';

    // ---------- 横飘特殊动作 ----------
    // 切到 mascot-3 时触发：先看她此刻在屏幕垂直中轴线的哪一侧，
    // 左半边 → 用 mascot-3 向右飘；右半边 → 用 mascot-7 向左飘，都带白色仙气拖尾
    const DRIFT_RIGHT_POSE = 2;    // mascot-3.png（向右飘姿势）
    const DRIFT_LEFT_POSE  = 6;    // mascot-7.png（向左飘姿势）
    const DRIFT_DURATION   = 9000; // 横飘总时长（毫秒）
    const DRIFT_GHOST_EVERY = 280; // 每多少毫秒生成一个仙气残影
    const REDUCED_MOTION = window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let driftState = null;
    let glowEl = null;

    function setPose(i) {
        cancelDrift();
        let idx = (i + CFG.images.length) % CFG.images.length;

        // 特殊动作：切到 mascot-3 时按位置决定用哪张图、往哪飘
        if (idx === DRIFT_RIGHT_POSE && !REDUCED_MOTION) {
            const rect = wrap.getBoundingClientRect();
            const onLeft = rect.left + rect.width / 2 < window.innerWidth / 2;
            idx = onLeft ? DRIFT_RIGHT_POSE : DRIFT_LEFT_POSE;
            poseIndex = idx;
            img.src = CFG.images[idx];
            saveState();
            drift(onLeft ? 'right' : 'left');
            return;
        }

        poseIndex = idx;
        img.src = CFG.images[idx];
        saveState();
    }

    // 仙气拖尾：角色身后生成白色残影 + 一团白雾
    function spawnGhost(dir) {
        const g = document.createElement('img');
        g.src = img.src;
        g.className = 'mascot-ghost';
        g.draggable = false;
        const rect = wrap.getBoundingClientRect();
        g.style.left = rect.left + 'px';
        g.style.top = rect.top + 'px';
        g.style.width = rect.width + 'px';
        g.style.transform = `translateX(${dir === 'right' ? -26 : 26}px)`; // 残影滞留在身后
        document.body.appendChild(g);
        // 下一帧开始淡出 + 弥散成白雾
        requestAnimationFrame(() => {
            g.style.opacity = '0';
            g.style.filter = 'blur(10px) brightness(1.7)';
            g.style.transform = `translateX(${dir === 'right' ? -70 : 70}px)`;
        });
        setTimeout(() => g.remove(), 1600);
    }

    function updateGlow(dir) {
        if (!glowEl) {
            glowEl = document.createElement('div');
            glowEl.className = 'mascot-trail-glow';
            document.body.appendChild(glowEl);
        }
        const rect = wrap.getBoundingClientRect();
        const w = rect.width;
        glowEl.style.height = rect.height * 0.75 + 'px';
        glowEl.style.width = w * 2.8 + 'px';
        glowEl.style.top = rect.top + rect.height * 0.12 + 'px';
        glowEl.style.left = (dir === 'right' ? rect.left - w * 2.6 : rect.left + w * 0.9) + 'px';
        glowEl.style.opacity = '0.9';
    }

    // 开始横飘：缓慢水平移动，飘到对侧边缘停下
    function drift(dir) {
        cancelDrift();
        const w = wrap.offsetWidth;
        const target = dir === 'right'
            ? Math.max(MARGIN, window.innerWidth - w - MARGIN)
            : MARGIN;
        wrap.style.transition = `left ${DRIFT_DURATION}ms linear`;
        wrap.style.left = target + 'px';
        driftState = {
            dir,
            timer: setInterval(() => { spawnGhost(dir); updateGlow(dir); }, DRIFT_GHOST_EVERY),
            endTimer: setTimeout(() => cancelDrift(), DRIFT_DURATION),
        };
        updateGlow(dir);
    }

    // 取消横飘：把过渡定格在当前位置再清除，避免角色瞬移到目标点
    function cancelDrift() {
        if (driftState) {
            clearInterval(driftState.timer);
            clearTimeout(driftState.endTimer);
            driftState = null;
        }
        const cur = wrap.getBoundingClientRect().left;
        wrap.style.transition = '';
        wrap.style.left = cur + 'px';
        if (glowEl) glowEl.style.opacity = '0';
    }

    // 恢复上次的姿势（直接恢复，不触发横飘动作），否则从第 1 张开始
    if (saved && Number.isInteger(saved.pose) &&
        saved.pose >= 0 && saved.pose < CFG.images.length) {
        poseIndex = saved.pose;
        img.src = CFG.images[saved.pose];
    } else {
        setPose(0);
    }

    // 图片加载失败（链接失效）→ 显示兜底小圆脸，页面不出现裂图
    img.addEventListener('error', () => {
        img.style.display = 'none';
        if (!wrap.querySelector('.mascot-fallback-face')) {
            const fb = document.createElement('div');
            fb.className = 'mascot-fallback-face';
            fb.textContent = '🥺';
            wrap.appendChild(fb);
        }
    });

    // ---------- 说话气泡 ----------
    function say(text) {
        bubbleText.textContent = text;
        bubble.classList.add('show');
        // 气泡宽度自适应内容，并把位置夹在视口内（贴边时不会被挤到屏幕外）
        const wr = wrap.getBoundingClientRect();
        const bw = bubble.offsetWidth;
        let cx = wr.left + wr.width / 2;
        cx = Math.min(Math.max(cx, 8 + bw / 2), window.innerWidth - 8 - bw / 2);
        bubble.style.left = (cx - wr.left) + 'px';
        clearTimeout(bubbleTimer);
        bubbleTimer = setTimeout(() => bubble.classList.remove('show'), CFG.bubbleDuration);
    }
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

    // 记住当前的位置和姿势
    function saveState() {
        try {
            const rect = wrap.getBoundingClientRect();
            localStorage.setItem(STORE_KEY, JSON.stringify({
                pose: poseIndex,
                left: rect.left,
                top: rect.top,
            }));
        } catch (_) { /* localStorage 不可用时静默跳过 */ }
    }

    // ---------- 随机动作动画 ----------
    function playAnim() {
        if (currentAnim) wrap.classList.remove(currentAnim);
        currentAnim = 'anim-' + pick(ANIMS);
        void wrap.offsetWidth; // 触发重排，让动画能重新播放
        wrap.classList.add(currentAnim);
    }
    wrap.addEventListener('animationend', () => {
        if (currentAnim) { wrap.classList.remove(currentAnim); currentAnim = ''; }
    });

    // ---------- 点击 → 换姿势 + 随机动作 + 台词 ----------
    function nextPose() {
        setPose(poseIndex + 1);
        playAnim();
        say(pick(CFG.clickLines));
    }

    // ---------- 拖拽（鼠标 + 触摸统一用 Pointer Events） ----------
    wrap.addEventListener('pointerdown', (e) => {
        cancelDrift(); // 拖动会打断横飘，角色停稳在当前位置
        const rect = wrap.getBoundingClientRect();
        startX = e.clientX; startY = e.clientY;
        startLeft = rect.left; startTop = rect.top;
        // 从"贴边"切换成自由坐标
        wrap.style.left = rect.left + 'px';
        wrap.style.top = rect.top + 'px';
        wrap.style.right = 'auto';
        wrap.style.bottom = 'auto';
        dragging = true;
        moved = false;
        wrap.classList.add('dragging');
        try { wrap.setPointerCapture(e.pointerId); } catch (_) { /* 部分浏览器不支持 */ }
        e.preventDefault();
    });

    wrap.addEventListener('pointermove', (e) => {
        if (!dragging) return;
        const dx = e.clientX - startX, dy = e.clientY - startY;
        if (Math.abs(dx) + Math.abs(dy) > 5) moved = true;
        // 限制在视口内，不让她被拖出屏幕外
        const w = wrap.offsetWidth, h = wrap.offsetHeight;
        const maxL = Math.max(0, window.innerWidth - w);
        const maxT = Math.max(0, window.innerHeight - h);
        wrap.style.left = Math.min(Math.max(0, startLeft + dx), maxL) + 'px';
        wrap.style.top = Math.min(Math.max(0, startTop + dy), maxT) + 'px';
    });

    wrap.addEventListener('pointerup', () => {
        if (!dragging) return;
        dragging = false;
        wrap.classList.remove('dragging');
        if (moved) {                 // 被拖动了 → 说句话并记住新位置
            say(pick(CFG.dragLines));
            saveState();
        } else {
            nextPose();              // 原地点击 → 换姿势（setPose 里已保存）
        }
    });

    // ---------- 随机待机动作 ----------
    setInterval(() => {
        if (document.hidden || dragging) return; // 页面在后台或被拖拽时不打扰
        setPose(Math.floor(Math.random() * CFG.images.length));
        playAnim();
        say(pick(CFG.idleLines));
    }, CFG.idleInterval + 5000);

    // ---------- 鼠标靠近反应 ----------
    document.addEventListener('pointermove', (e) => {
        if (dragging) return;
        const rect = wrap.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        if (Math.hypot(e.clientX - cx, e.clientY - cy) < CFG.proximityRange &&
            Date.now() - lastProximityAt > CFG.proximityCooldown) {
            lastProximityAt = Date.now();
            say(pick(CFG.nearLines));
        }
    });

    // 页面离开（切换文章 / 刷新 / 关闭）前保存一次，兜底横飘中途等场景
    window.addEventListener('pagehide', saveState);
})();
