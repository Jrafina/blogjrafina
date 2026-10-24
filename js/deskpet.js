/**
 * 桌宠 DeskPet —— 透明背景舞蹈视频，固定左下角，不可拖动
 * =====================================================================
 * 行为：
 *   1. 两个视频（已抠像、带 alpha 通道的 WebM）轮流播放：A 播完自动切 B，
 *      B 播完再切回 A，无限循环。
 *   2. 两段视频各自对应一个 <video>，同一时刻只有一个可见（交叉淡入淡出），
 *      切换时新的从 0 秒开始播，保证"按视频原有动作播放"。
 *   3. 固定在页面左下角：定位在 CSS 里写死，JS 不提供任何拖拽/移动逻辑，
 *      容器 pointer-events:none，鼠标事件根本落不到它身上。
 *
 * 依赖：css/deskpet.css
 */
(function () {
    'use strict';

    // ==================== 配置区 ====================
    const CFG = {
        // 依次循环播放的视频（顺序即播放顺序）
        videos: [
            'assets/pet/dance-1.webm',
            'assets/pet/dance-2.webm',
        ],
        // 与 CSS 中 .deskpet-video 的 transition 时长保持一致（毫秒）
        fadeMs: 260,
        // 切下一段前额外等待的时间（毫秒），让呼吸动画和淡出有时间收尾
        gapMs: 120,
    };
    // ==================== 配置区结束 ====================

    if (!CFG.videos.length) return;

    // 同一页面重复引入时只保留一份，避免出现两只桌宠
    if (document.querySelector('.deskpet')) return;

    // ---------- 构建 DOM ----------
    const root = document.createElement('div');
    root.className = 'deskpet';
    root.setAttribute('aria-hidden', 'true');

    const stage = document.createElement('div');
    stage.className = 'deskpet-stage';
    root.appendChild(stage);

    const players = CFG.videos.map((src, i) => {
        const v = document.createElement('video');
        v.className = 'deskpet-video';
        v.src = src;
        v.muted = true;              // 必须静音：否则浏览器不允自动播放
        v.defaultMuted = true;
        v.playsInline = true;
        v.setAttribute('playsinline', '');
        v.setAttribute('webkit-playsinline', '');
        v.preload = 'auto';
        v.loop = false;              // 单段不循环，播完交给 JS 切下一段
        v.setAttribute('disablepictureinpicture', '');
        v.setAttribute('disableremoteplayback', '');
        v.draggable = false;         // 连 video 原生拖拽也一并禁掉
        v.dataset.index = String(i);
        stage.appendChild(v);
        return v;
    });

    document.body.appendChild(root);

    // ---------- 状态 ----------
    let cur = 0;                 // 当前视频下标
    let switching = false;       // 防止 ended 与兜底定时器重复触发
    let endTimer = null;         // 兜底计时器：万一 ended 没触发也能切
    let needsGesture = false;    // 自动播放被拦截时置 true

    const active = () => players[cur];

    // ---------- 可见性切换 ----------
    function show(index) {
        players.forEach((v, i) => v.classList.toggle('is-active', i === index));
    }

    function clearEndTimer() {
        if (endTimer) {
            clearTimeout(endTimer);
            endTimer = null;
        }
    }

    /**
     * 安排"这一段播完后切下一段"。
     * 主路径是 ended 事件；同时按 duration 起一个兜底定时器，
     * 防止某些浏览器/编码下 ended 不触发导致桌宠定格。
     */
    function scheduleNext() {
        clearEndTimer();
        const v = active();
        const dur = isFinite(v.duration) && v.duration > 0 ? v.duration : 12.05;
        const delay = Math.max(400, (dur - v.currentTime) * 1000 + CFG.gapMs);
        endTimer = setTimeout(() => {
            // 兜底触发时再确认一次：真的播到头了才切
            const v2 = active();
            if (v2.ended || v2.currentTime >= (v2.duration || dur) - 0.12) {
                next();
            } else if (!v2.paused) {
                scheduleNext();   // 还没播完（比如被 seek 过），重新排
            }
        }, delay);
    }

    function next() {
        if (switching) return;
        switching = true;
        clearEndTimer();

        const from = cur;
        cur = (cur + 1) % players.length;
        const to = players[cur];

        // 新的从 0 开始，按视频原本的动作从头播
        try { to.currentTime = 0; } catch (_) { /* 元数据未就绪时忽略 */ }
        to.classList.add('is-active');
        to.play().catch(onPlayBlocked);
        players[from].classList.remove('is-active');

        // 淡出结束后把上一段暂停，省解码资源
        setTimeout(() => {
            if (from !== cur) {
                try { players[from].pause(); } catch (_) { }
            }
        }, CFG.fadeMs + 60);

        switching = false;
        scheduleNext();
    }

    // ---------- 自动播放被拦截的兜底 ----------
    function onPlayBlocked() {
        needsGesture = true;
        const kick = () => {
            needsGesture = false;
            document.removeEventListener('pointerdown', kick);
            document.removeEventListener('keydown', kick);
            document.removeEventListener('touchstart', kick);
            start();
        };
        document.addEventListener('pointerdown', kick, { once: true, passive: true });
        document.addEventListener('keydown', kick, { once: true });
        document.addEventListener('touchstart', kick, { once: true, passive: true });
    }

    function start() {
        const v = active();
        v.play().then(() => {
            root.classList.add('is-ready');
            scheduleNext();
        }).catch(onPlayBlocked);
    }

    // ---------- 事件绑定 ----------
    players.forEach((v, i) => {
        v.addEventListener('ended', () => {
            if (i === cur) next();
        });
        // 元数据就绪后才能拿到准确时长，此时修正兜底定时器
        v.addEventListener('loadedmetadata', () => {
            if (i === cur && !v.paused) scheduleNext();
        });
        v.addEventListener('playing', () => root.classList.add('is-ready'));
        v.addEventListener('error', () => {
            // 资源缺失/解码失败：隐藏这一层，避免出现黑色空框
            v.style.display = 'none';
            if (i === cur && players.length > 1) next();
        });
    });

    // 页面切到后台时暂停（省电、省解码），回到前台继续
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            players.forEach(v => { try { v.pause(); } catch (_) { } });
            clearEndTimer();
        } else {
            active().play().catch(onPlayBlocked);
            scheduleNext();
        }
    });

    // ---------- 启动 ----------
    show(0);
    start();
})();
