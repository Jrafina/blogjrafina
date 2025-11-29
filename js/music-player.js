// 等待页面加载完成
document.addEventListener('DOMContentLoaded', function() {
    // 获取元素
    const audioPlayer = document.getElementById('music-player-core');
    const songItems = document.querySelectorAll('.song-list li');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const loopBtn = document.getElementById('loop-btn');
    const toggleBtn = document.getElementById('togglePlayer');
    const musicPlayer = document.getElementById('musicPlayer');
    let loopMode = 'cycle'; // 播放模式：cycle(列表循环)、single(单曲循环)

    // 更新播放模式图标
    function updateLoopIcon() {
        const icon = loopBtn.querySelector('i');
        icon.className = '';
        if (loopMode === 'cycle') {
            icon.className = 'fas fa-redo';
            loopBtn.classList.remove('active');
        } else {
            icon.className = 'fas fa-redo-alt';
            loopBtn.classList.add('active');
        }
    }

    // 切换播放模式
    loopBtn.addEventListener('click', () => {
        loopMode = loopMode === 'cycle' ? 'single' : 'cycle';
        updateLoopIcon();
    });

    // 播放指定索引的歌曲
    function playSong(index) {
        if (index < 0 || index >= songItems.length) return;

        // 更新列表选中状态
        songItems.forEach((item, i) => {
            item.classList.toggle('active', i === index);
        });

        // 加载并播放歌曲
        const songSrc = songItems[index].getAttribute('data-src');
        const sourceElement = audioPlayer.querySelector('source');
        sourceElement.src = songSrc;
        audioPlayer.load();

        // 尝试播放（处理浏览器自动播放限制）
        audioPlayer.play().catch(e => {
            console.log('自动播放受限，需用户交互:', e);
            // 提示用户点击播放
            const playTip = document.createElement('div');
            playTip.style.cssText = 'color:#ff6700;font-size:12px;margin-top:8px;text-align:center;';
            playTip.textContent = '🔔 点击播放器播放按钮开始听歌';
            audioPlayer.parentNode.insertBefore(playTip, audioPlayer.nextSibling);
            setTimeout(() => playTip.remove(), 3000);
        });
    }

    // 获取当前播放索引
    function getCurrentIndex() {
        for (let i = 0; i < songItems.length; i++) {
            if (songItems[i].classList.contains('active')) {
                return i;
            }
        }
        return 0;
    }

    // 上一首
    prevBtn.addEventListener('click', () => {
        let currentIndex = getCurrentIndex();
        currentIndex = (currentIndex - 1 + songItems.length) % songItems.length;
        playSong(currentIndex);
    });

    // 下一首
    nextBtn.addEventListener('click', () => {
        let currentIndex = getCurrentIndex();
        currentIndex = (currentIndex + 1) % songItems.length;
        playSong(currentIndex);
    });

    // 歌曲列表点击事件
    songItems.forEach(item => {
        item.addEventListener('click', () => {
            const index = parseInt(item.getAttribute('data-index'));
            playSong(index);
        });
    });

    // 播放结束自动切换下一首
    audioPlayer.addEventListener('ended', () => {
        if (loopMode === 'single') {
            // 单曲循环
            audioPlayer.play();
        } else {
            // 列表循环，自动播放下一首
            let currentIndex = getCurrentIndex();
            currentIndex = (currentIndex + 1) % songItems.length;
            playSong(currentIndex);
        }
    });

    // 折叠/展开播放器
    toggleBtn.addEventListener('click', () => {
        musicPlayer.classList.toggle('collapsed');
    });

    // 点击播放器头部也能折叠/展开
    const playerHeader = document.querySelector('.player-header');
    playerHeader.addEventListener('click', (e) => {
        // 避免事件冒泡重复触发
        if (e.target !== toggleBtn && !toggleBtn.contains(e.target)) {
            musicPlayer.classList.toggle('collapsed');
        }
    });

    // 保存播放状态到本地存储
    function savePlayState() {
        try {
            const currentIndex = getCurrentIndex();
            const currentTime = audioPlayer.currentTime;
            const isPlaying = !audioPlayer.paused;

            localStorage.setItem('musicPlayerState', JSON.stringify({
                currentIndex,
                currentTime,
                isPlaying,
                loopMode
            }));
        } catch (e) {
            console.log('保存播放状态失败:', e);
        }
    }

    // 定期保存播放状态（3秒一次）
    setInterval(savePlayState, 3000);

    // 页面卸载前强制保存
    window.addEventListener('beforeunload', savePlayState);

    // 恢复播放状态
    function restorePlayState() {
        try {
            const state = localStorage.getItem('musicPlayerState');
            if (state) {
                const { currentIndex, currentTime, isPlaying, loopMode: savedLoopMode } = JSON.parse(state);

                // 恢复循环模式
                if (savedLoopMode) {
                    loopMode = savedLoopMode;
                    updateLoopIcon();
                }

                // 恢复播放歌曲和进度
                playSong(currentIndex);
                audioPlayer.currentTime = currentTime;

                // 尝试恢复播放状态（受浏览器策略限制）
                if (isPlaying) {
                    audioPlayer.play().catch(e => console.log('恢复播放失败:', e));
                }
            }
        } catch (e) {
            console.log('恢复播放状态失败:', e);
        }
    }

    // 页面加载时恢复播放状态
    restorePlayState();
});