// 合并DOMContentLoaded事件监听
document.addEventListener('DOMContentLoaded', function() {
    // 添加页面加载动画
    document.body.style.opacity = '0';
    setTimeout(() => {
        document.body.style.transition = 'opacity 0.8s ease';
        document.body.style.opacity = '1';
    }, 100);

    // 文章筛选相关功能
    const searchInput = document.getElementById('searchInput');
    const articleList = document.getElementById('articleList');
    const articles = articleList.getElementsByTagName('li');
    const categoryLinks = document.querySelectorAll('.category-link');
    const categoryTitle = document.querySelector('.category-title');
    const backAllBtn = document.getElementById('backAllBtn');
    const allArticles = Array.from(articles);

    // 为文章项添加入场动画
    allArticles.forEach((article, index) => {
        article.style.opacity = '0';
        article.style.transform = 'translateY(30px)';
        setTimeout(() => {
            article.style.transition = 'all 0.6s ease';
            article.style.opacity = '1';
            article.style.transform = 'translateY(0)';
        }, index * 100);
    });

    // 分类切换功能
    categoryLinks.forEach(link => {
        link.addEventListener('click', function() {
            // 添加点击动画
            this.style.transform = 'scale(0.95)';
            setTimeout(() => {
                this.style.transform = 'scale(1)';
            }, 150);

            categoryLinks.forEach(link => link.classList.remove('active'));
            this.classList.add('active');

            const category = this.getAttribute('data-category');

            if (category === 'all') {
                categoryTitle.textContent = 'Jrafina的博客小站';
                backAllBtn.style.display = 'none';
            } else if (category === 'tutorials') {
                categoryTitle.textContent = '教程归纳';
                backAllBtn.style.display = 'inline-flex';
            } else if (category === 'solutions') {
                categoryTitle.textContent = '问题解决';
                backAllBtn.style.display = 'inline-flex';
            }

            filterArticles(category);
        });
    });

    // 返回全部文章
    backAllBtn.addEventListener('click', function() {
        this.style.transform = 'scale(0.95)';
        setTimeout(() => {
            this.style.transform = 'scale(1)';
        }, 150);

        categoryLinks.forEach(link => link.classList.remove('active'));
        document.querySelector('[data-category="all"]').classList.add('active');
        categoryTitle.textContent = 'Jrafina的博客小站';
        backAllBtn.style.display = 'none';
        filterArticles('all');
    });

    // 搜索功能
    searchInput.addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase().trim();
        const activeCategory = document.querySelector('.category-link.active').getAttribute('data-category');
        filterArticles(activeCategory, searchTerm);
    });

    // 文章筛选函数
    function filterArticles(category, searchTerm = '') {
        allArticles.forEach((article, index) => {
            const articleCategory = article.getAttribute('data-category');
            const articleTitle = article.querySelector('.article-link').textContent.toLowerCase();
            const isCategoryMatch = category === 'all' || articleCategory === category;
            const isSearchMatch = searchTerm === '' || articleTitle.includes(searchTerm);

            if (isCategoryMatch && isSearchMatch) {
                article.style.display = '';
                // 添加显示动画
                setTimeout(() => {
                    article.style.opacity = '1';
                    article.style.transform = 'translateY(0)';
                }, index * 50);
            } else {
                article.style.opacity = '0';
                article.style.transform = 'translateY(20px)';
                setTimeout(() => {
                    article.style.display = 'none';
                }, 300);
            }
        });
    }

    // Tips筛选相关功能
    const tipsSearchInput = document.getElementById('tipsSearchInput');
    const allTips = document.querySelectorAll('.tip-item');

    // 为Tips添加入场动画
    allTips.forEach((tip, index) => {
        tip.style.opacity = '0';
        tip.style.transform = 'translateX(-20px)';
        setTimeout(() => {
            tip.style.transition = 'all 0.5s ease';
            tip.style.opacity = '1';
            tip.style.transform = 'translateX(0)';
        }, index * 100);
    });

    // 设置不同类别的标签颜色
    document.querySelectorAll('.tip-tag').forEach(tag => {
        const category = tag.parentElement.getAttribute('data-tip-category');
        switch(category) {
            case 'css':
                tag.style.background = 'linear-gradient(135deg, #2d6299, #3b82f6)';
                break;
            case 'js':
                tag.style.background = 'linear-gradient(135deg, #d9534f, #ef4444)';
                break;
            case 'html':
                tag.style.background = 'linear-gradient(135deg, #5cb85c, #10b981)';
                break;
            default:
                tag.style.background = 'linear-gradient(135deg, #6c757d, #9ca3af)';
        }
    });

    // Tips筛选函数
    function filterTips(searchTerm = '') {
        allTips.forEach((tip, index) => {
            const tipText = tip.querySelector('.tip-text').textContent.toLowerCase();
            const tipCategory = tip.getAttribute('data-tip-category').toLowerCase();
            const isMatch = tipText.includes(searchTerm) || (searchTerm && tipCategory.includes(searchTerm));

            if (isMatch) {
                tip.style.display = '';
                setTimeout(() => {
                    tip.style.opacity = '1';
                    tip.style.transform = 'translateX(0)';
                }, index * 50);
            } else {
                tip.style.opacity = '0';
                tip.style.transform = 'translateX(-20px)';
                setTimeout(() => {
                    tip.style.display = 'none';
                }, 300);
            }
        });
    }

    // Tips搜索框事件监听
    tipsSearchInput.addEventListener('input', function() {
        const searchTerm = this.value.trim().toLowerCase();
        filterTips(searchTerm);
    });

    // 初始化所有鼠标特效
    initMouseEffects();
});

// 鼠标特效系统
function initMouseEffects() {
    // 1. 粒子效果
    initParticleEffect();

    // 2. 鼠标轨迹效果
    initMouseTrail();

    // 3. 点击涟漪效果
    initClickRipple();

    // 4. 自定义光标
    initCustomCursor();
}

// 高性能粒子效果
function initParticleEffect() {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '9998';
    document.body.appendChild(canvas);

    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const particleCount = 60;
    const particles = [];
    let mouseX = 0;
    let mouseY = 0;
    let mouseMoved = false;

    class Particle {
        constructor() {
            this.reset();
        }

        reset() {
            this.x = Math.random() * canvas.width;
            this.y = Math.random() * canvas.height;
            this.size = Math.random() * 2 + 1;
            this.speedX = Math.random() * 1 - 0.5;
            this.speedY = Math.random() * 1 - 0.5;
            this.color = `hsl(${Math.random() * 360}, 70%, 60%)`;
            this.alpha = Math.random() * 0.5 + 0.2;
            this.baseSize = this.size;
        }

        update() {
            if (mouseMoved) {
                const dx = mouseX - this.x;
                const dy = mouseY - this.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < 100) {
                    const force = (100 - distance) / 100;
                    this.speedX += dx * 0.0005 * force;
                    this.speedY += dy * 0.0005 * force;
                    this.size = this.baseSize + (2 * force);
                }
            }

            this.x += this.speedX;
            this.y += this.speedY;

            if (this.x < 0 || this.x > canvas.width) this.speedX *= -1;
            if (this.y < 0 || this.y > canvas.height) this.speedY *= -1;

            this.size += (this.baseSize - this.size) * 0.1;
            this.x = Math.max(0, Math.min(canvas.width, this.x));
            this.y = Math.max(0, Math.min(canvas.height, this.y));
        }

        draw() {
            ctx.save();
            ctx.globalAlpha = this.alpha;
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }

    for (let i = 0; i < particleCount; i++) {
        particles.push(new Particle());
    }

    document.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
        mouseMoved = true;

        clearTimeout(window.mouseTimeout);
        window.mouseTimeout = setTimeout(() => {
            mouseMoved = false;
        }, 2000);
    });

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        particles.forEach(particle => {
            particle.update();
            particle.draw();

            particles.forEach(otherParticle => {
                const dx = particle.x - otherParticle.x;
                const dy = particle.y - otherParticle.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < 100) {
                    ctx.beginPath();
                    ctx.strokeStyle = `rgba(99, 102, 241, ${0.2 * (1 - distance / 100)})`;
                    ctx.lineWidth = 0.5;
                    ctx.moveTo(particle.x, particle.y);
                    ctx.lineTo(otherParticle.x, otherParticle.y);
                    ctx.stroke();
                }
            });
        });

        requestAnimationFrame(animate);
    }

    animate();
}

// 鼠标轨迹效果
function initMouseTrail() {
    const trailCanvas = document.createElement('canvas');
    const trailCtx = trailCanvas.getContext('2d');

    trailCanvas.style.position = 'fixed';
    trailCanvas.style.top = '0';
    trailCanvas.style.left = '0';
    trailCanvas.style.width = '100%';
    trailCanvas.style.height = '100%';
    trailCanvas.style.pointerEvents = 'none';
    trailCanvas.style.zIndex = '9997';
    document.body.appendChild(trailCanvas);

    function resizeTrailCanvas() {
        trailCanvas.width = window.innerWidth;
        trailCanvas.height = window.innerHeight;
    }
    resizeTrailCanvas();
    window.addEventListener('resize', resizeTrailCanvas);

    const trailPoints = [];
    const maxTrailLength = 20;

    document.addEventListener('mousemove', (e) => {
        trailPoints.push({
            x: e.clientX,
            y: e.clientY,
            size: 8,
            alpha: 0.8
        });

        if (trailPoints.length > maxTrailLength) {
            trailPoints.shift();
        }
    });

    function drawTrail() {
        trailCtx.clearRect(0, 0, trailCanvas.width, trailCanvas.height);

        for (let i = 0; i < trailPoints.length; i++) {
            const point = trailPoints[i];
            const progress = i / trailPoints.length;

            trailCtx.save();
            trailCtx.globalAlpha = point.alpha * progress;
            trailCtx.fillStyle = `hsl(${progress * 360}, 70%, 60%)`;
            trailCtx.beginPath();
            trailCtx.arc(point.x, point.y, point.size * progress, 0, Math.PI * 2);
            trailCtx.fill();
            trailCtx.restore();

            // 逐渐减小点的尺寸和透明度
            point.size *= 0.95;
            point.alpha *= 0.9;
        }

        // 移除太小的点
        trailPoints.forEach((point, index) => {
            if (point.alpha < 0.1 || point.size < 1) {
                trailPoints.splice(index, 1);
            }
        });

        requestAnimationFrame(drawTrail);
    }

    drawTrail();
}

// 点击涟漪效果
function initClickRipple() {
    const rippleCanvas = document.createElement('canvas');
    const rippleCtx = rippleCanvas.getContext('2d');

    rippleCanvas.style.position = 'fixed';
    rippleCanvas.style.top = '0';
    rippleCanvas.style.left = '0';
    rippleCanvas.style.width = '100%';
    rippleCanvas.style.height = '100%';
    rippleCanvas.style.pointerEvents = 'none';
    rippleCanvas.style.zIndex = '9999';
    document.body.appendChild(rippleCanvas);

    function resizeRippleCanvas() {
        rippleCanvas.width = window.innerWidth;
        rippleCanvas.height = window.innerHeight;
    }
    resizeRippleCanvas();
    window.addEventListener('resize', resizeRippleCanvas);

    const ripples = [];

    document.addEventListener('click', (e) => {
        // 创建主涟漪
        ripples.push({
            x: e.clientX,
            y: e.clientY,
            radius: 0,
            maxRadius: 50,
            alpha: 0.8,
            color: `hsl(${Math.random() * 360}, 70%, 60%)`,
            lineWidth: 3
        });

        // 创建小涟漪效果
        for (let i = 0; i < 3; i++) {
            setTimeout(() => {
                ripples.push({
                    x: e.clientX + (Math.random() - 0.5) * 30,
                    y: e.clientY + (Math.random() - 0.5) * 30,
                    radius: 0,
                    maxRadius: 20 + Math.random() * 20,
                    alpha: 0.4,
                    color: `hsl(${Math.random() * 360}, 70%, 60%)`,
                    lineWidth: 1
                });
            }, i * 100);
        }
    });

    function drawRipples() {
        rippleCtx.clearRect(0, 0, rippleCanvas.width, rippleCanvas.height);

        ripples.forEach((ripple, index) => {
            ripple.radius += 2;
            ripple.alpha -= 0.02;

            if (ripple.alpha <= 0 || ripple.radius > ripple.maxRadius) {
                ripples.splice(index, 1);
                return;
            }

            rippleCtx.save();
            rippleCtx.globalAlpha = ripple.alpha;
            rippleCtx.strokeStyle = ripple.color;
            rippleCtx.lineWidth = ripple.lineWidth;
            rippleCtx.beginPath();
            rippleCtx.arc(ripple.x, ripple.y, ripple.radius, 0, Math.PI * 2);
            rippleCtx.stroke();
            rippleCtx.restore();
        });

        requestAnimationFrame(drawRipples);
    }

    drawRipples();
}

// 自定义光标效果
function initCustomCursor() {
    const cursor = document.createElement('div');
    cursor.style.position = 'fixed';
    cursor.style.width = '20px';
    cursor.style.height = '20px';
    cursor.style.backgroundColor = 'rgba(99, 102, 241, 0.5)';
    cursor.style.border = '2px solid rgba(99, 102, 241, 0.8)';
    cursor.style.borderRadius = '50%';
    cursor.style.pointerEvents = 'none';
    cursor.style.zIndex = '10000';
    cursor.style.transition = 'transform 0.1s ease, background-color 0.2s ease';
    cursor.style.transform = 'translate(-50%, -50%)';
    document.body.appendChild(cursor);

    const cursorDot = document.createElement('div');
    cursorDot.style.position = 'fixed';
    cursorDot.style.width = '4px';
    cursorDot.style.height = '4px';
    cursorDot.style.backgroundColor = 'rgba(99, 102, 241, 1)';
    cursorDot.style.borderRadius = '50%';
    cursorDot.style.pointerEvents = 'none';
    cursorDot.style.zIndex = '10001';
    cursorDot.style.transform = 'translate(-50%, -50%)';
    document.body.appendChild(cursorDot);

    let mouseX = 0, mouseY = 0;
    let cursorX = 0, cursorY = 0;
    let dotX = 0, dotY = 0;

    document.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
    });

    function animateCursor() {
        // 光标延迟跟随
        cursorX += (mouseX - cursorX) * 0.1;
        cursorY += (mouseY - cursorY) * 0.1;

        // 圆点直接跟随
        dotX = mouseX;
        dotY = mouseY;

        cursor.style.left = cursorX + 'px';
        cursor.style.top = cursorY + 'px';

        cursorDot.style.left = dotX + 'px';
        cursorDot.style.top = dotY + 'px';

        requestAnimationFrame(animateCursor);
    }

    animateCursor();

    // 悬停效果
    const interactiveElements = document.querySelectorAll('a, button, .category-link, .article-link, .tip-item, .control-btn, .song-list li');

    interactiveElements.forEach(element => {
        element.addEventListener('mouseenter', () => {
            cursor.style.transform = 'translate(-50%, -50%) scale(1.5)';
            cursor.style.backgroundColor = 'rgba(139, 92, 246, 0.3)';
        });

        element.addEventListener('mouseleave', () => {
            cursor.style.transform = 'translate(-50%, -50%) scale(1)';
            cursor.style.backgroundColor = 'rgba(99, 102, 241, 0.5)';
        });
    });

    // 点击效果
    document.addEventListener('mousedown', () => {
        cursor.style.transform = 'translate(-50%, -50%) scale(0.8)';
        cursor.style.backgroundColor = 'rgba(239, 68, 68, 0.5)';
    });

    document.addEventListener('mouseup', () => {
        cursor.style.transform = 'translate(-50%, -50%) scale(1.5)';
        cursor.style.backgroundColor = 'rgba(139, 92, 246, 0.3)';

        setTimeout(() => {
            cursor.style.transform = 'translate(-50%, -50%) scale(1)';
            cursor.style.backgroundColor = 'rgba(99, 102, 241, 0.5)';
        }, 150);
    });

    // 添加CSS样式隐藏默认光标
    const style = document.createElement('style');
    style.textContent = `
        * {
            cursor: none !important;
        }
    `;
    document.head.appendChild(style);
}