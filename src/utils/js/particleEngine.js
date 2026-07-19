/**
 * particleEngine - Canvas 2D particle system for PhiTogether startup animation
 * Inspired by osu!lazer TrianglesV2
 * Features: triangle fragments, configurable modes, mobile reduction
 */
class ParticleEngine {
    constructor(canvas, options = {}) {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");
        this.PX_RATIO = window.devicePixelRatio || 1;
        this.mobile = !window.spec.isDesktop;

        // Config
        this.config = {
            particleCount: this.mobile ? 40 : 120,
            triangleCount: this.mobile ? 15 : 40,
            speedMultiplier: 1.0,
            baseSpeed: 0.5,
            colors: ["#4b89dc", "#8a55c7", "#c27bc6", "#55a3c7", "#7bc7e8"],
            glowIntensity: 0.3,
            sizeRange: [2, 8],
            ...options,
        };

        // State
        this.particles = [];
        this.triangles = [];
        this.running = false;
        this.mode = "active"; // "active" | "calm" | "menu"
        this.targetSpeedMultiplier = 1.0;
        this.targetOpacity = 1.0;
        this.globalAlpha = 1.0;
        this.width = window.innerWidth;
        this.height = window.innerHeight;

        this._raf = null;
        this._lastTime = 0;

        this.resize();
        this.init();
    }

    resize() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.canvas.width = this.width * this.PX_RATIO;
        this.canvas.height = this.height * this.PX_RATIO;
        this.canvas.style.width = `${this.width}px`;
        this.canvas.style.height = `${this.height}px`;
        this.ctx.setTransform(this.PX_RATIO, 0, 0, this.PX_RATIO, 0, 0);
    }

    init() {
        // Init particles (small glowing dots)
        this.particles = [];
        for (let i = 0; i < this.config.particleCount; i++) {
            this.particles.push(this.createParticle());
        }

        // Init triangles
        this.triangles = [];
        for (let i = 0; i < this.config.triangleCount; i++) {
            this.triangles.push(this.createTriangle());
        }
    }

    createParticle() {
        const color = this.config.colors[Math.floor(Math.random() * this.config.colors.length)];
        return {
            x: Math.random() * this.width,
            y: Math.random() * this.height,
            vx: (Math.random() - 0.5) * this.config.baseSpeed,
            vy: (Math.random() - 0.5) * this.config.baseSpeed,
            size:
                this.config.sizeRange[0] +
                Math.random() * (this.config.sizeRange[1] - this.config.sizeRange[0]),
            color: color,
            alpha: 0.3 + Math.random() * 0.5,
            life: Math.random() * 1000,
            maxLife: 2000 + Math.random() * 3000,
            pulse: Math.random() * Math.PI * 2,
        };
    }

    createTriangle() {
        const color = this.config.colors[Math.floor(Math.random() * this.config.colors.length)];
        return {
            x: Math.random() * this.width,
            y: Math.random() * this.height,
            vx: (Math.random() - 0.5) * this.config.baseSpeed * 0.7,
            vy: (Math.random() - 0.5) * this.config.baseSpeed * 0.7,
            rotation: Math.random() * Math.PI * 2,
            vRotation: (Math.random() - 0.5) * 0.02,
            size: 10 + Math.random() * 30,
            color: color,
            alpha: 0.05 + Math.random() * 0.15,
            spawnDelay: Math.random() * 1000,
        };
    }

    setMode(mode) {
        this.mode = mode;
        switch (mode) {
            case "active":
                this.targetSpeedMultiplier = 1.0;
                this.targetOpacity = 1.0;
                break;
            case "calm":
                this.targetSpeedMultiplier = 0.3;
                this.targetOpacity = 0.8;
                break;
            case "menu":
                this.targetSpeedMultiplier = 0.15;
                this.targetOpacity = 0.5;
                break;
        }
    }

    start() {
        if (this.running) return;
        this.running = true;
        this._lastTime = performance.now();
        this._animate();
    }

    stop() {
        this.running = false;
        if (this._raf) {
            cancelAnimationFrame(this._raf);
            this._raf = null;
        }
    }

    _animate = () => {
        if (!this.running) return;

        const now = performance.now();
        const dt = Math.min((now - this._lastTime) / 1000, 0.05); // cap at 50ms
        this._lastTime = now;

        // Smooth transition
        this.speedMultiplier += (this.targetSpeedMultiplier - this.speedMultiplier) * dt * 3;
        this.globalAlpha += (this.targetOpacity - this.globalAlpha) * dt * 3;

        // Clear with slight trail effect for glow
        this.ctx.fillStyle = "rgba(0, 0, 0, 0.15)";
        this.ctx.fillRect(0, 0, this.width, this.height);

        this.ctx.globalAlpha = this.globalAlpha;

        // Draw triangles (background layer)
        this._drawTriangles(dt);

        // Draw particles (foreground layer)
        this._drawParticles(dt);

        this.ctx.globalAlpha = 1.0;

        this._raf = requestAnimationFrame(this._animate);
    };

    _drawTriangles(dt) {
        const speed = this.speedMultiplier;
        for (const tri of this.triangles) {
            tri.x += tri.vx * speed;
            tri.y += tri.vy * speed;
            tri.rotation += tri.vRotation * speed;

            // Wrap
            if (tri.x < -50) tri.x = this.width + 50;
            if (tri.x > this.width + 50) tri.x = -50;
            if (tri.y < -50) tri.y = this.height + 50;
            if (tri.y > this.height + 50) tri.y = -50;

            // Skip if triangle has invalid values
            if (!isFinite(tri.x) || !isFinite(tri.y) || !isFinite(tri.size) || tri.size <= 0) {
                continue;
            }

            this.ctx.save();
            this.ctx.translate(tri.x, tri.y);
            this.ctx.rotate(tri.rotation);

            // Draw triangle
            const s = tri.size;
            this.ctx.beginPath();
            this.ctx.moveTo(0, -s);
            this.ctx.lineTo(s * 0.866, s * 0.5);
            this.ctx.lineTo(-s * 0.866, s * 0.5);
            this.ctx.closePath();

            // Gradient fill
            const gradient = this.ctx.createRadialGradient(0, 0, 0, 0, 0, s);
            const rgb = this._hexToRgba(tri.color);
            gradient.addColorStop(0, `rgba(${rgb}, ${tri.alpha})`);
            gradient.addColorStop(1, `rgba(${rgb}, 0)`);
            this.ctx.fillStyle = gradient;
            this.ctx.fill();

            // Outline
            this.ctx.strokeStyle = `rgba(${rgb}, ${tri.alpha * 0.5})`;
            this.ctx.lineWidth = 1;
            this.ctx.stroke();

            this.ctx.restore();
        }
    }

    _drawParticles(dt) {
        const speed = this.speedMultiplier;
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.life += dt * 1000;
            p.x += p.vx * speed;
            p.y += p.vy * speed;
            p.pulse += dt * 2;

            // Life cycle - fade in/out
            const lifeRatio = p.life / p.maxLife;
            let alpha = p.alpha;
            if (lifeRatio < 0.1) alpha *= lifeRatio / 0.1;
            if (lifeRatio > 0.9) alpha *= (1 - lifeRatio) / 0.1;
            alpha *= 0.5 + 0.5 * Math.sin(p.pulse);

            // Skip if particle is off-screen, expired, or has invalid values
            const isOffScreen =
                p.x < -10 || p.x > this.width + 10 || p.y < -10 || p.y > this.height + 10;
            const isExpired = lifeRatio >= 1;
            const isInvalid =
                !isFinite(p.x) || !isFinite(p.y) || !isFinite(p.size) || p.size <= 0;

            if (isOffScreen || isExpired || isInvalid) {
                this.particles[i] = this.createParticle();
                continue;
            }

            // Draw glowing dot
            const size = p.size;
            const gradient = this.ctx.createRadialGradient(
                p.x,
                p.y,
                0,
                p.x,
                p.y,
                size * 3
            );
            const rgb = this._hexToRgba(p.color);
            gradient.addColorStop(0, `rgba(${rgb}, ${alpha})`);
            gradient.addColorStop(0.5, `rgba(${rgb}, ${alpha * 0.3})`);
            gradient.addColorStop(1, `rgba(${rgb}, 0)`);

            this.ctx.fillStyle = gradient;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, size * 3, 0, Math.PI * 2);
            this.ctx.fill();

            // Core
            this.ctx.fillStyle = `rgba(${rgb}, ${alpha})`;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, size * 0.5, 0, Math.PI * 2);
            this.ctx.fill();
        }
    }

    _hexToRgba(hex) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `${r}, ${g}, ${b}`;
    }

    dispose() {
        this.stop();
        this.particles = [];
        this.triangles = [];
        this.ctx = null;
        this.canvas = null;
    }
}

export default ParticleEngine;
