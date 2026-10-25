/**
 * 桌宠 DeskPet — 三动作 + 右键菜单
 * =====================================================================
 * 动作：转圈 / 比心 / 趴墙（各自一条带 alpha 的 WebM）
 * 默认（未选择时）：转圈 ⇄ 比心 自动轮流播放，播完一段切另一段
 * 右键菜单：
 *   · 转圈 / 比心 / 趴墙 → 立即切到该动作，并原地循环（不再自动换）
 *   · 保持               → 不改变当前画面，只是停止自动切换（当前这段继续循环）
 * 位置：固定左下角；「趴墙」时容器 left=0，配合素材里墙体左缘对齐屏幕左边缘。
 * 禁止拖动：没有任何拖拽逻辑；容器 pointer-events:none，只有画面本身接右键。
 *
 * 依赖：css/deskpet.css
 */
(function () {
    'use strict';

    // ==================== 配置区 ====================
    const CFG = {
        actions: [
            // mark：菜单里跟在动作名后面的符号（比心的 ♥ 用 CSS 染红）
            { id: 'heart', label: '比心', mark: '♥', src: 'assets/pet/heart.webm' },
            { id: 'peace', label: '比耶', mark: '✌', src: 'assets/pet/peace.webm' },
            { id: 'wall', label: '趴墙', mark: '', src: 'assets/pet/wall.webm' },
        ],
        autoCycle: ['heart', 'peace'],  // 默认自动轮流播放（趴墙不参与轮播）
        keepLabel: '保持',
        keepHint: '切换中',
        keepHintOn: '已保持',
        fadeMs: 260,
        gapMs: 120,
        storeKey: 'deskpet-state-v5',
    };
    // ==================== 配置区结束 ====================

    // mode 两种：
    //   auto  —— 转圈 ⇄ 比心 自动轮流播
    //   fixed —— 停在当前动作原地循环，不再自动切换（点动作 / 点"保持"都进这个状态）
    // 注意："保持"是保持**动作不切换**，动作本身继续播，不是定格停住。
    const MODES = ['auto', 'fixed'];

    if (document.querySelector('.deskpet')) return;   // 防重复注入

    // ---------- 状态 ----------
    function loadState() {
        const ids = CFG.actions.map(a => a.id);
        const fallback = { mode: 'auto', current: CFG.autoCycle[0] };
        try {
            const s = JSON.parse(localStorage.getItem(CFG.storeKey) || 'null');
            if (s && ids.indexOf(s.current) >= 0 && MODES.indexOf(s.mode) >= 0) return s;
        } catch (_) { /* 隐私模式等 */ }
        return fallback;
    }
    const state = loadState();

    function saveState() {
        try { localStorage.setItem(CFG.storeKey, JSON.stringify(state)); } catch (_) { }
    }

    // ---------- DOM ----------
    const root = document.createElement('div');
    root.className = 'deskpet';
    root.dataset.action = state.current;
    // 桌宠整块对鼠标透明（pointer-events:none），不再作为可交互元素暴露给读屏；
    // 菜单是独立挂在 body 上的，由 document 层的坐标命中触发。
    root.setAttribute('aria-hidden', 'true');

    const stage = document.createElement('div');
    stage.className = 'deskpet-stage';
    root.appendChild(stage);

    const toast = document.createElement('div');
    toast.className = 'deskpet-toast';
    root.appendChild(toast);

    const players = {};
    CFG.actions.forEach((a, i) => {
        const v = document.createElement('video');
        v.className = 'deskpet-video';
        v.src = a.src;
        v.muted = true;
        v.defaultMuted = true;
        v.playsInline = true;
        v.setAttribute('playsinline', '');
        v.setAttribute('webkit-playsinline', '');
        v.preload = i === 0 ? 'auto' : 'metadata';
        v.loop = false;
        v.setAttribute('disablepictureinpicture', '');
        v.setAttribute('disableremoteplayback', '');
        v.draggable = false;
        v.dataset.action = a.id;
        stage.appendChild(v);
        players[a.id] = v;
    });

    // ---------- 菜单 ----------
    const menu = document.createElement('div');
    menu.className = 'deskpet-menu';
    menu.setAttribute('role', 'menu');
    menu.setAttribute('aria-label', '桌宠动作');

    const items = {};
    CFG.actions.forEach((a) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'deskpet-menu-item';
        b.setAttribute('role', 'menuitemradio');
        b.dataset.pick = a.id;
        b.innerHTML = '<span class="deskpet-menu-tick"></span><span>' + a.label + '</span>' +
            (a.mark ? '<span class="deskpet-menu-mark deskpet-menu-mark-' + a.id + '">' + a.mark + '</span>' : '');
        menu.appendChild(b);
        items[a.id] = b;
    });

    const sep = document.createElement('div');
    sep.className = 'deskpet-menu-sep';
    menu.appendChild(sep);

    const keepItem = document.createElement('button');
    keepItem.type = 'button';
    keepItem.className = 'deskpet-menu-item';
    keepItem.setAttribute('role', 'menuitemradio');
    keepItem.dataset.pick = 'keep';
    keepItem.innerHTML = '<span class="deskpet-menu-tick"></span><span>' + CFG.keepLabel +
        '</span><span class="deskpet-menu-hint">' + CFG.keepHint + '</span>';
    menu.appendChild(keepItem);

    document.body.appendChild(root);
    document.body.appendChild(menu);

    const keepHint = keepItem.querySelector('.deskpet-menu-hint');
    const activeVideo = () => players[state.current];

    // ---------- 播放控制 ----------
    let switching = false;
    let endTimer = null;

    function clearEndTimer() {
        if (endTimer) { clearTimeout(endTimer); endTimer = null; }
    }

    // fixed 模式让 <video> 自己循环；auto 模式靠 ended 事件接力切下一段
    function syncLoop() {
        CFG.actions.forEach((a) => {
            players[a.id].loop = (state.mode === 'fixed' && a.id === state.current);
        });
    }

    function setStageRatio(id) {
        const v = players[id];
        if (v && v.videoWidth && v.videoHeight) {
            root.style.setProperty('--stage-ratio', (v.videoWidth / v.videoHeight).toFixed(4));
        }
    }

    function show(id) {
        CFG.actions.forEach((a) => players[a.id].classList.toggle('is-active', a.id === id));
        root.dataset.action = id;
        setStageRatio(id);
    }

    function scheduleNext() {
        clearEndTimer();
        if (state.mode !== 'auto') return;
        const v = activeVideo();
        const dur = isFinite(v.duration) && v.duration > 0 ? v.duration : 12;
        const delay = Math.max(400, (dur - v.currentTime) * 1000 + CFG.gapMs);
        endTimer = setTimeout(() => {
            const v2 = activeVideo();
            if (v2.ended || v2.currentTime >= (v2.duration || dur) - 0.12) nextInCycle();
            else if (!v2.paused) scheduleNext();
        }, delay);
    }

    function nextInCycle() {
        const cycle = CFG.autoCycle;
        const i = cycle.indexOf(state.current);
        play(cycle[(i + 1) % cycle.length], { restart: true, mode: 'auto' });
    }

    /** 切到某个动作。restart=false + keepTime=true 时保持当前播放进度（"保持"用） */
    function play(id, opt) {
        const o = opt || {};
        if (!players[id] || switching) return;
        switching = true;

        const from = state.current;
        if (o.mode) state.mode = o.mode;
        state.current = id;
        root.dataset.action = id;
        saveState();
        refreshMenu();   // 动作变了就同步菜单的勾选（菜单开着时自动切换也能跟上）

        const v = players[id];
        if (v.preload === 'metadata') {
            v.preload = 'auto';
            try { v.load(); } catch (_) { }
        }
        v.classList.add('is-active');
        if (from !== id) {
            players[from].classList.remove('is-active');
            setTimeout(() => {
                if (state.current !== from) { try { players[from].pause(); } catch (_) { } }
            }, CFG.fadeMs + 60);
        }
        if (o.restart) {
            try { v.currentTime = 0; } catch (_) { }
        }
        syncLoop();
        v.play().then(() => {
            root.classList.add('is-ready');
            setStageRatio(id);
            syncLoop();
            scheduleNext();
        }).catch(onPlayBlocked);

        switching = false;
    }

    function onPlayBlocked() {
        const kick = () => {
            document.removeEventListener('pointerdown', kick);
            document.removeEventListener('keydown', kick);
            document.removeEventListener('touchstart', kick);
            play(state.current, { restart: true, mode: state.mode });
        };
        document.addEventListener('pointerdown', kick, { once: true, passive: true });
        document.addEventListener('keydown', kick, { once: true });
        document.addEventListener('touchstart', kick, { once: true, passive: true });
    }

    // ---------- 菜单 ----------
    function refreshMenu() {
        CFG.actions.forEach((a) => {
            const on = a.id === state.current;
            items[a.id].querySelector('.deskpet-menu-tick').textContent = on ? '✓' : '';
            items[a.id].setAttribute('aria-checked', on ? 'true' : 'false');
        });
        // "保持"是个开关：已保持时打勾（表示这个开关是开着的，再点一次就是关）
        const kept = state.mode === 'fixed';
        keepItem.querySelector('.deskpet-menu-tick').textContent = kept ? '✓' : '';
        keepItem.setAttribute('aria-checked', kept ? 'true' : 'false');
        keepHint.textContent = kept ? CFG.keepHintOn : CFG.keepHint;
        keepHint.classList.toggle('on', kept);
        // 菜单开着时动作可能自动切换，顺手把位置也重算一下（各动作宽度不同）
        if (menu.dataset.open) positionMenu();
    }

    function positionMenu() {
        const r = root.getBoundingClientRect();
        const mw = menu.offsetWidth, mh = menu.offsetHeight;
        let x = r.right + 8;
        let y = r.bottom - mh;
        if (x + mw > window.innerWidth - 8) x = r.left - mw - 8;
        x = Math.min(Math.max(8, x), Math.max(8, window.innerWidth - mw - 8));
        y = Math.min(Math.max(8, y), Math.max(8, window.innerHeight - mh - 8));
        menu.style.left = x + 'px';
        menu.style.top = y + 'px';
    }

    // 轻提示：让"保持"这类不改变画面的操作也有可见反馈
    let toastTimer = null;
    function showToast(text) {
        toast.textContent = text;
        toast.classList.add('show');
        if (toastTimer) clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toast.classList.remove('show'), 1500);
    }

    function openMenu() {
        menu.classList.add('show');
        menu.dataset.open = '1';
        refreshMenu();     // 先算勾选状态，再按实际尺寸定位
        positionMenu();
    }

    function closeMenu() {
        menu.classList.remove('show');
        delete menu.dataset.open;
    }

    // ---------- 事件 ----------
    // 桌宠整块 pointer-events:none（正文可以正常划选/复制），
    // 所以右键菜单在 document 层按坐标命中：右键落在桌宠的矩形范围内就接管。
    function inPetArea(x, y) {
        const r = root.getBoundingClientRect();
        return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    }

    document.addEventListener('contextmenu', (e) => {
        if (!inPetArea(e.clientX, e.clientY)) return;
        e.preventDefault();
        if (menu.dataset.open) closeMenu();
        else openMenu();
    }, true);

    menu.addEventListener('click', (e) => {
        const btn = e.target.closest('.deskpet-menu-item');
        if (!btn) return;
        e.preventDefault();
        const pick = btn.dataset.pick;
        closeMenu();
        if (pick === 'keep') {
            if (state.mode === 'fixed') {
                // 已经是"已保持"：再点一次 = 取消保持，恢复自动轮流切换
                state.mode = 'auto';
                saveState();
                syncLoop();                 // 关掉 loop，回到靠 ended 接力
                refreshMenu();
                scheduleNext();
                showToast('已取消保持 · 恢复自动切换');
            } else {
                // 保持 = 保持动作不切换：动作照旧循环播放，只是不再自动切下一段
                state.mode = 'fixed';
                saveState();
                clearEndTimer();                // 取消已经排好的"下一段"
                syncLoop();                     // 当前这段转为 loop
                if (activeVideo().paused) activeVideo().play().catch(onPlayBlocked);
                refreshMenu();
                showToast(CFG.keepHintOn + ' · 动作不切换');
            }
        } else {
            // 选动作 = 切过去并原地循环
            play(pick, { restart: true, mode: 'fixed' });
        }
    });

    document.addEventListener('pointerdown', (e) => {
        if (!menu.dataset.open) return;
        if (menu.contains(e.target)) return;
        closeMenu();
    }, true);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && menu.dataset.open) closeMenu();
    });
    window.addEventListener('resize', closeMenu);
    window.addEventListener('scroll', closeMenu, { passive: true });

    // ---------- 视频事件 ----------
    CFG.actions.forEach((a) => {
        const v = players[a.id];
        v.addEventListener('ended', () => {
            if (state.mode === 'auto' && a.id === state.current) nextInCycle();
        });
        v.addEventListener('loadedmetadata', () => {
            if (a.id === state.current) setStageRatio(a.id);
            if (state.mode === 'auto' && a.id === state.current && !v.paused) scheduleNext();
        });
        v.addEventListener('playing', () => {
            root.classList.add('is-ready');
            if (a.id === state.current) setStageRatio(a.id);
        });
        v.addEventListener('error', () => {
            v.style.display = 'none';
            if (a.id === state.current) {
                const alt = CFG.actions.find(x => x.id !== a.id && players[x.id].style.display !== 'none');
                if (alt) play(alt.id, { restart: true });
            }
        });
    });

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            CFG.actions.forEach((a) => { try { players[a.id].pause(); } catch (_) { } });
            clearEndTimer();
        } else {
            activeVideo().play().catch(onPlayBlocked);
            scheduleNext();
        }
    });
    window.addEventListener('pagehide', saveState);

    // ---------- 启动 ----------
    show(state.current);
    syncLoop();
    play(state.current, { mode: state.mode });
})();
