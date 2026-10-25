// blogjrafina - Light Theme Effects
// Adapted for white frosted glass design

document.addEventListener('DOMContentLoaded', function() {
    // Page load fade-in
    document.body.style.opacity = '0';
    setTimeout(() => {
        document.body.style.transition = 'opacity 0.6s ease';
        document.body.style.opacity = '1';
    }, 50);

    // Initialize effects - reduced intensity for light theme
    initParticles();
    initClickRipple();
});

// ==========================================
// Soft particle effect (light-theme friendly)
// ==========================================
function initParticles() {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:0;';
    document.body.appendChild(canvas);

    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    const particles = [];
    const count = 35;

    class Particle {
        constructor() {
            this.reset(true);
        }

        reset(initial) {
            this.x = initial ? Math.random() * canvas.width : Math.random() * canvas.width;
            this.y = initial ? Math.random() * canvas.height : Math.random() * canvas.height;
            this.size = Math.random() * 1.8 + 0.6;
            this.vx = (Math.random() - 0.5) * 0.4;
            this.vy = (Math.random() - 0.5) * 0.4;
            this.opacity = Math.random() * 0.25 + 0.08;
            // Soft purples and blues appropriate for light bg
            this.hue = Math.random() * 40 + 240; // 240-280: blues to purples
        }

        update() {
            this.x += this.vx;
            this.y += this.vy;

            if (this.x < -50) this.x = canvas.width + 50;
            if (this.x > canvas.width + 50) this.x = -50;
            if (this.y < -50) this.y = canvas.height + 50;
            if (this.y > canvas.height + 50) this.y = -50;
        }

        draw() {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fillStyle = `hsla(${this.hue}, 60%, 55%, ${this.opacity})`;
            ctx.fill();
        }
    }

    for (let i = 0; i < count; i++) {
        particles.push(new Particle());
    }

    let mouseX = -1000, mouseY = -1000;
    document.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
    });

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        particles.forEach(p => {
            p.update();

            // Gentle attraction to mouse
            const dx = mouseX - p.x;
            const dy = mouseY - p.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 120) {
                const force = (1 - dist / 120) * 0.3;
                p.vx += dx * force * 0.001;
                p.vy += dy * force * 0.001;
                p.opacity = Math.min(0.45, p.opacity + 0.01);
            } else {
                p.opacity = Math.max(0.08, p.opacity - 0.002);
            }

            p.draw();

            // Connect nearby particles with subtle lines
            for (let j = particles.indexOf(p) + 1; j < particles.length; j++) {
                const other = particles[j];
                const ddx = p.x - other.x;
                const ddy = p.y - other.y;
                const d = Math.sqrt(ddx * ddx + ddy * ddy);
                if (d < 90) {
                    ctx.beginPath();
                    ctx.strokeStyle = `rgba(99, 102, 241, ${0.06 * (1 - d / 90)})`;
                    ctx.lineWidth = 0.5;
                    ctx.moveTo(p.x, p.y);
                    ctx.lineTo(other.x, other.y);
                    ctx.stroke();
                }
            }
        });

        requestAnimationFrame(animate);
    }

    animate();
}

// ==========================================
// Subtle click ripple effect
// ==========================================
function initClickRipple() {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999;';
    document.body.appendChild(canvas);

    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    const ripples = [];

    document.addEventListener('click', (e) => {
        ripples.push({
            x: e.clientX,
            y: e.clientY,
            radius: 0,
            maxRadius: 40,
            opacity: 0.35,
            color: '99, 102, 241' // indigo
        });
    });

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        for (let i = ripples.length - 1; i >= 0; i--) {
            const r = ripples[i];
            r.radius += 2.5;
            r.opacity -= 0.015;

            if (r.opacity <= 0 || r.radius > r.maxRadius) {
                ripples.splice(i, 1);
                continue;
            }

            ctx.beginPath();
            ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(${r.color}, ${r.opacity})`;
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }

        requestAnimationFrame(animate);
    }

    animate();
}
