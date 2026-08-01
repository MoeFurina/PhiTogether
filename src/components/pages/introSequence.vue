<script>
import ParticleBackground from "@components/animations/ParticleBackground.vue";
import TypingText from "@components/animations/TypingText.vue";

export default {
    name: "introSequence",
    components: {
        ParticleBackground,
        TypingText,
    },
    data() {
        return {
            mobile: !window.spec.isDesktop,
            phase: 0, // 0=wake, 1=typing, 2=logo-in, 3=logo-breath, 4=outro
            wakeGlow: 0,
            logoOpacity: 0,
            logoScale: 0.92,
            logoBlur: 14,
            glowIntensity: 0,
            glowPulse: 0,
            typingComplete: false,
            subtitleOpacity: 0,
            textOpacity: 1,
            screenFade: 1,
            flashOpacity: 0,
            _animFrame: null,
            _timers: [],
            _typingDone: false,
        };
    },
    computed: {
        welcomeText() {
            return this.$t("introSequence.welcome");
        },
        subtitleText() {
            return this.$t("introSequence.subtitle");
        },
        showLogo() {
            return this.phase >= 2;
        },
        particleMode() {
            return this.phase >= 2 && this.phase <= 3 ? "active" : "calm";
        },
        textGlow() {
            if (this.phase >= 3) return 1;
            if (this.phase >= 2) return 0.3 + this.logoOpacity * 0.7;
            return 0;
        },
        logoStyle() {
            return {
                opacity: this.logoOpacity,
                transform: "scale(" + this.logoScale + ")",
                filter: "blur(" + this.logoBlur + "px)",
            };
        },
        haloStyle() {
            const g = this.glowIntensity * (0.9 + this.glowPulse * 0.1);
            return {
                opacity: Math.min(g, 1),
                transform: "scale(" + (0.4 + this.glowIntensity * 0.65) + ")",
            };
        },
        wakeStyle() {
            return {
                opacity: this.wakeGlow,
                transform: "scale(" + (0.2 + this.wakeGlow * 4.5) + ")",
            };
        },
    },
    methods: {
        _later(fn, ms) {
            const id = setTimeout(fn, ms);
            this._timers.push(id);
        },

        // ── Phase 0: a soft glow opens from pure black ──
        phase0Wake() {
            this.phase = 0;
            const start = performance.now();
            const duration = 700;
            const animate = () => {
                const t = Math.min((performance.now() - start) / duration, 1);
                this.wakeGlow = 1 - Math.pow(1 - t, 3);
                if (t < 1) {
                    this._animFrame = requestAnimationFrame(animate);
                } else {
                    this._later(() => this.phase1TypingText(), 100);
                }
            };
            this._animFrame = requestAnimationFrame(animate);
        },

        // ── Phase 1: typing intro ──
        phase1TypingText() {
            this.phase = 1;
        },

        // ── Phase 2: logo lands — blur dissolves + springy overshoot + halo ──
        phase2LogoAnimation() {
            this.phase = 2;
            this.logoOpacity = 0;
            this.logoScale = 0.92;
            this.logoBlur = 14;

            const easeOutBack = t => {
                const c1 = 1.70158;
                const c3 = c1 + 1;
                return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
            };

            const start = performance.now();
            const duration = 2100;
            const animate = () => {
                const t = Math.min((performance.now() - start) / duration, 1);
                const easeOut = 1 - Math.pow(1 - t, 3);

                this.logoOpacity = easeOut;
                this.logoScale = 0.92 + (1.08 - 0.92) * easeOutBack(t);
                this.logoBlur = 14 * (1 - easeOut);
                this.glowIntensity = easeOut;

                if (t < 1) {
                    this._animFrame = requestAnimationFrame(animate);
                } else {
                    this._later(() => this.phase3LogoBreath(), 400);
                }
            };
            this._animFrame = requestAnimationFrame(animate);
        },

        // ── Phase 3: logo breathes, text fades away ──
        phase3LogoBreath() {
            this.phase = 3;
            this.logoOpacity = 1;
            this.logoScale = 1;
            this.logoBlur = 0;

            const start = performance.now();
            const duration = 1600;
            const animate = () => {
                const t = (performance.now() - start) / duration;
                this.glowPulse = Math.sin(t * Math.PI * 2);
                this.textOpacity = Math.max(1 - t / 0.6, 0);
                if (t < 1) {
                    this._animFrame = requestAnimationFrame(animate);
                } else {
                    this._later(() => this.phase4Transition(), 300);
                }
            };
            this._animFrame = requestAnimationFrame(animate);
        },

        // ── Phase 4: zoom + blur out, flash sweep, hand over ──
        phase4Transition() {
            this.phase = 4;
            const start = performance.now();
            const duration = 950;
            const animate = () => {
                const t = Math.min((performance.now() - start) / duration, 1);
                const easeIn = t * t;

                this.logoScale = 1 + 0.14 * easeIn;
                this.logoBlur = 12 * easeIn;
                this.screenFade = 1 - easeIn;
                this.flashOpacity = Math.sin(t * Math.PI) * 0.85;

                if (t < 1) {
                    this._animFrame = requestAnimationFrame(animate);
                } else {
                    this.$router.replace({
                        path: "/startPage",
                        query: { fromIntro: "1" },
                    });
                }
            };
            this._animFrame = requestAnimationFrame(animate);
        },

        onTypingComplete() {
            this._typingDone = true;
            const start = performance.now();
            const duration = 500;
            const animate = () => {
                const t = Math.min((performance.now() - start) / duration, 1);
                this.subtitleOpacity = 1 - Math.pow(1 - t, 2);
                if (t < 1) {
                    this._animFrame = requestAnimationFrame(animate);
                } else {
                    this._later(() => this.phase2LogoAnimation(), 500);
                }
            };
            this._animFrame = requestAnimationFrame(animate);
        },
    },
    mounted() {
        this.phase0Wake();
    },
    beforeUnmount() {
        if (this._animFrame) {
            cancelAnimationFrame(this._animFrame);
            this._animFrame = null;
        }
        this._timers.forEach(clearTimeout);
        this._timers = [];
    },
};
</script>

<template>
    <div
        id="introSequence"
        :style="{
            opacity: screenFade,
            transition: phase === 4 ? 'none' : 'opacity 0.3s ease-out',
        }"
    >
        <!-- Particle background (calm, livens up when logo lands) -->
        <ParticleBackground :mode="particleMode" />

        <!-- Phase 0: central wake glow opening from black -->
        <div
            v-show="phase === 0"
            class="pt-wake-glow"
            :style="wakeStyle"
        ></div>

        <!-- Intro content container -->
        <div class="intro-container">
            <!-- Typing text + subtitle (Phase 1+) -->
            <div
                v-show="phase >= 1"
                class="typing-wrapper"
                :class="{ 'text-shifted': phase >= 2 }"
                :style="{
                    opacity: (phase >= 1 ? 1 : 0) * textOpacity,
                    textShadow:
                        textGlow > 0
                            ? `0 0 ${8 + textGlow * 12}px rgba(138, 85, 199, ${textGlow * 0.4})`
                            : 'none',
                }"
            >
                <TypingText
                    v-if="phase < 2 || _typingDone"
                    :text="welcomeText"
                    :speed="mobile ? 70 : 90"
                    :startDelay="100"
                    :fontSize="mobile ? '36px' : '48px'"
                    :color="'#ffffff'"
                    :fontFamily="'Saira, Arial, sans-serif'"
                    :showCursor="phase === 1"
                    :onComplete="onTypingComplete"
                />
                <!-- Subtitle fades in after typing finishes -->
                <div
                    class="pt-subtitle"
                    :style="{ opacity: subtitleOpacity }"
                >
                    {{ subtitleText }}
                </div>
            </div>

            <!-- Logo (Phase 2+): blur dissolves + spring scale + halo -->
            <div v-show="showLogo" class="logo-wrapper">
                <div class="pt-halo" :style="haloStyle"></div>
                <img
                    src="/src/core/lg512y512.png"
                    class="intro-logo"
                    :class="{ mobile: mobile }"
                    :style="logoStyle"
                    alt="PhiTogether"
                />
            </div>
        </div>

        <!-- Closing flash sweep (Phase 4) -->
        <div
            class="pt-flash"
            :style="{ opacity: flashOpacity }"
        ></div>

        <!-- Subtle progress indicator -->
        <div
            v-show="phase >= 1 && phase < 4"
            class="intro-progress"
            :style="{ width: `${Math.min((phase / 3) * 100, 100)}%` }"
        ></div>
    </div>
</template>

<style scoped>
    #introSequence {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        background: #000000;
        z-index: 10000;
        margin: 0;
        padding: 0;
    }

    .intro-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 48px;
        position: relative;
        z-index: 1;
    }

    .typing-wrapper {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 60px;
        transition: all 0.8s ease-out;
        letter-spacing: 2px;
    }

    .typing-wrapper.text-shifted {
        transform: translateY(-8px);
    }

    /* Subtitle under the typing line */
    .pt-subtitle {
        margin-top: 14px;
        font-family: Saira, Arial, sans-serif;
        font-size: 15px;
        letter-spacing: 6px;
        color: rgba(178, 141, 224, 0.85);
        text-transform: uppercase;
    }

    .logo-wrapper {
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
    }

    .intro-logo {
        width: 260px;
        height: auto;
        object-fit: contain;
        opacity: 0.95;
        position: relative;
        z-index: 1;
    }

    .intro-logo.mobile {
        width: 200px;
    }

    /* Halo behind the logo */
    .pt-halo {
        position: absolute;
        top: 50%;
        left: 50%;
        width: 640px;
        height: 640px;
        margin: -320px 0 0 -320px;
        border-radius: 50%;
        background: radial-gradient(
            circle,
            rgba(138, 85, 199, 0.55) 0%,
            rgba(75, 137, 220, 0.25) 38%,
            rgba(194, 123, 198, 0.08) 62%,
            transparent 75%
        );
        filter: blur(10px);
        z-index: 0;
        pointer-events: none;
    }

    /* Phase 0 wake glow */
    .pt-wake-glow {
        position: fixed;
        top: 50%;
        left: 50%;
        width: 220px;
        height: 220px;
        margin: -110px 0 0 -110px;
        border-radius: 50%;
        background: radial-gradient(
            circle,
            rgba(138, 85, 199, 0.5) 0%,
            rgba(75, 137, 220, 0.2) 45%,
            transparent 70%
        );
        filter: blur(18px);
        pointer-events: none;
    }

    /* Phase 4 closing flash */
    .pt-flash {
        position: fixed;
        top: 50%;
        left: 50%;
        width: 120vmax;
        height: 120vmax;
        margin: -60vmax 0 0 -60vmax;
        border-radius: 50%;
        background: radial-gradient(
            circle,
            rgba(255, 255, 255, 0.95) 0%,
            rgba(214, 187, 244, 0.5) 35%,
            transparent 60%
        );
        pointer-events: none;
        z-index: 2;
    }

    .intro-progress {
        position: fixed;
        bottom: 0;
        left: 0;
        height: 2px;
        background: linear-gradient(90deg, #4b89dc, #8a55c7, #c27bc6);
        transition: width 0.6s ease-out;
        z-index: 1;
        opacity: 0.6;
    }
</style>
