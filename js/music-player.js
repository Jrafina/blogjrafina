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
    let currentSongIndex = 0;

    // 更新播放模式图标
    function updateLoopIcon() {
        const icon = loopBtn.querySelector('i');
        if (loopMode === 'cycle') {
            icon.className = 'fas fa-redo';
            loopBtn.classList.remove('active');
            loopBtn.title = '列表循环';
        } else {
            icon.className = 'fas fa-redo-alt';
            loopBtn.classList.add('active');
            loopBtn.title = '单曲循环';
        }
    }

    // 切换播放模式
    loopBtn.addEventListener('click', () => {
        loopMode = loopMode === 'cycle' ? 'single' : 'cycle';
        updateLoopIcon();

        // 添加点击反馈
        loopBtn.style.transform = 'scale(0.9)';
        setTimeout(() => {
            loopBtn.style.transform = 'scale(1)';
        }, 150);
    });

    // 播放指定索引的歌曲
    function playSong(index) {
        if (index < 0 || index >= songItems.length) return;

        currentSongIndex = index;

        // 更新列表选中状态
        songItems.forEach((item, i) => {
            item.classList.toggle('active', i === index);
        });

        // 加载并播放歌曲
        const songSrc = songItems[index].getAttribute('data-src');

        // 检查音频源是否与当前相同，避免重复加载
        if (audioPlayer.src !== songSrc) {
            audioPlayer.src = songSrc;
        }

        // 添加播放动画
        const activeItem = songItems[index];
        activeItem.style.animation = 'pulse 0.6s ease';
        setTimeout(() => {
            activeItem.style.animation = '';
        }, 600);

        // 尝试播放
        const playPromise = audioPlayer.play();

        if (playPromise !== undefined) {
            playPromise.then(() => {
                console.log('播放成功:', songItems[index].querySelector('.song-name').textContent);
                // 移除可能的错误提示
                const errorTip = document.querySelector('.music-error-tip');
                if (errorTip) errorTip.remove();
            }).catch(error => {
                console.log('自动播放受限，需用户交互:', error);
                showPlayTip('🔔 点击播放器播放按钮开始听歌');
            });
        }
    }

    // 显示播放提示
    function showPlayTip(message) {
        // 移除可能存在的旧提示
        const existingTip = document.querySelector('.music-play-tip');
        if (existingTip) {
            existingTip.remove();
        }

        const playTip = document.createElement('div');
        playTip.className = 'music-play-tip';
        playTip.style.cssText = 'color:#06b6d4;font-size:12px;margin-top:8px;text-align:center;padding:8px;background:rgba(6,182,212,0.1);border-radius:8px;';
        playTip.textContent = message;
        audioPlayer.parentNode.insertBefore(playTip, audioPlayer.nextSibling);
        setTimeout(() => {
            if (playTip.parentNode) {
                playTip.remove();
            }
        }, 3000);
    }

    // 显示错误提示
    function showErrorTip(message) {
        const errorTip = document.createElement('div');
        errorTip.className = 'music-error-tip';
        errorTip.style.cssText = 'color:#ef4444;font-size:12px;margin-top:8px;text-align:center;padding:8px;background:rgba(239,68,68,0.1);border-radius:8px;';
        errorTip.textContent = message;
        audioPlayer.parentNode.insertBefore(errorTip, audioPlayer.nextSibling);
        setTimeout(() => {
            if (errorTip.parentNode) {
                errorTip.remove();
            }
        }, 5000);
    }

    // 获取当前播放索引
    function getCurrentIndex() {
        return currentSongIndex;
    }

    // 上一首
    prevBtn.addEventListener('click', () => {
        let currentIndex = getCurrentIndex();
        currentIndex = (currentIndex - 1 + songItems.length) % songItems.length;
        playSong(currentIndex);

        // 添加点击反馈
        prevBtn.style.transform = 'scale(0.9)';
        setTimeout(() => {
            prevBtn.style.transform = 'scale(1)';
        }, 150);
    });

    // 下一首
    nextBtn.addEventListener('click', () => {
        let currentIndex = getCurrentIndex();
        currentIndex = (currentIndex + 1) % songItems.length;
        playSong(currentIndex);

        // 添加点击反馈
        nextBtn.style.transform = 'scale(0.9)';
        setTimeout(() => {
            nextBtn.style.transform = 'scale(1)';
        }, 150);
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
            audioPlayer.currentTime = 0;
            audioPlayer.play().catch(e => console.log('单曲循环播放失败:', e));
        } else {
            // 列表循环，自动播放下一首
            let currentIndex = getCurrentIndex();
            currentIndex = (currentIndex + 1) % songItems.length;
            playSong(currentIndex);
        }
    });

    // 音频错误处理
    audioPlayer.addEventListener('error', function(e) {
        console.error('音频加载错误:', e);
        showErrorTip('❌ 音频加载失败，请检查网络连接或尝试其他歌曲');

        // 如果当前歌曲加载失败，自动跳到下一首
        if (loopMode !== 'single') {
            setTimeout(() => {
                let currentIndex = getCurrentIndex();
                currentIndex = (currentIndex + 1) % songItems.length;
                playSong(currentIndex);
            }, 2000);
        }
    });

    // 音频加载完成
    audioPlayer.addEventListener('loadeddata', function() {
        console.log('音频加载完成:', this.src);
    });

    // 折叠/展开播放器
    toggleBtn.addEventListener('click', () => {
        musicPlayer.classList.toggle('collapsed');
        const icon = toggleBtn.querySelector('i');
        icon.classList.toggle('fa-chevron-up');
        icon.classList.toggle('fa-chevron-down');
    });

    // 点击播放器头部也能折叠/展开
    const playerHeader = document.querySelector('.player-header');
    playerHeader.addEventListener('click', (e) => {
        if (e.target !== toggleBtn && !toggleBtn.contains(e.target)) {
            musicPlayer.classList.toggle('collapsed');
            const icon = toggleBtn.querySelector('i');
            icon.classList.toggle('fa-chevron-up');
            icon.classList.toggle('fa-chevron-down');
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

    // 定期保存播放状态
    setInterval(savePlayState, 3000);
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

                // 恢复播放歌曲
                if (currentIndex >= 0 && currentIndex < songItems.length) {
                    playSong(currentIndex);

                    // 恢复播放进度
                    audioPlayer.addEventListener('loadedmetadata', function() {
                        if (currentTime > 0 && currentTime < audioPlayer.duration) {
                            audioPlayer.currentTime = currentTime;
                        }

                        // 尝试恢复播放状态（受浏览器策略限制）
                        if (isPlaying) {
                            audioPlayer.play().catch(e => {
                                console.log('恢复播放失败，需要用户交互:', e);
                            });
                        }
                    }, { once: true });
                }
            }
        } catch (e) {
            console.log('恢复播放状态失败:', e);
        }
    }

    // 页面加载时恢复播放状态
    restorePlayState();

    // 添加CSS动画
    const style = document.createElement('style');
    style.textContent = `
        @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.02); }
            100% { transform: scale(1); }
        }

        .song-list li {
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
    `;
    document.head.appendChild(style);

    // 初始化播放第一首歌
    setTimeout(() => {
        if (songItems.length > 0 && !audioPlayer.src) {
            playSong(0);
        }
    }, 1000);
});