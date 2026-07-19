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
            phase: 0, // 0=black-wake, 1=typing-text, 2=logo-fade-in, 3=logo-hold, 4=transition
            logoOpacity: 0,
            logoScale: 0.92,
            typingComplete: false,
            screenFade: 1,
            _animFrame: null,
            _typingDone: false,
        };
    },
    computed: {
        welcomeText() {
            return this.$t("introSequence.welcome");
        },
        showLogo() {
            return this.phase >= 2;
        },
        textGlow() {
            // Text glows subtly when logo appears
            if (this.phase >= 3) return 1;
            if (this.phase >= 2) return 0.3 + (this.logoOpacity * 0.7);
            return 0;
        },
    },
    methods: {
        // ── Phase 0: Pure black, subtle particles wake ──
        phase0BlackWake() {
            this.phase = 0;
            setTimeout(() => this.phase1TypingText(), 700);
        },

        // ── Phase 1: "Welcome to PhiTogether" typing ──
        phase1TypingText() {
            this.phase = 1;
        },

        // ── Phase 2: Logo fades in gracefully ──
        phase2LogoAnimation() {
            this.phase = 2;
            this.logoOpacity = 0;
            this.logoScale = 0.92;

            const start = performance.now();
            const duration = 2200;

            const animate = () => {
                const elapsed = performance.now() - start;
                const t = Math.min(elapsed / duration, 1);

                const easeOut = 1 - Math.pow(1 - t, 3);

                this.logoOpacity = easeOut;
                this.logoScale = 0.92 + (1 - 0.92) * easeOut;

                if (t < 1) {
                    this._animFrame = requestAnimationFrame(animate);
                } else {
                    setTimeout(() => this.phase3LogoHold(), 400);
                }
            };
            this._animFrame = requestAnimationFrame(animate);
        },

        // ── Phase 3: Logo fully visible, brief hold ──
        phase3LogoHold() {
            this.phase = 3;
            this.logoOpacity = 1;
            this.logoScale = 1;

            setTimeout(() => this.phase4Transition(), 1200);
        },

        // ── Phase 4: Smooth fade to main menu ──
        phase4Transition() {
            this.phase = 4;
            const start = performance.now();
            const duration = 800;

            const animate = () => {
                const elapsed = performance.now() - start;
                const t = Math.min(elapsed / duration, 1);
                this.screenFade = 1 - t;
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

        // ── Called by TypingText when typing finishes ──
        onTypingComplete() {
            this._typingDone = true;
            // Brief pause after last character, then start logo animation
            setTimeout(() => this.phase2LogoAnimation(), 600);
        },
    },
    mounted() {
        // Start from pure black
        this.phase0BlackWake();
    },
    beforeUnmount() {
        if (this._animFrame) {
            cancelAnimationFrame(this._animFrame);
            this._animFrame = null;
        }
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
        <!-- Particle background in calm mode for subtle atmosphere -->
        <ParticleBackground mode="calm" />

        <!-- Intro content container -->
        <div class="intro-container">
            <!-- Typing Text (Phase 1+) -->
            <div
                v-show="phase >= 1"
                class="typing-wrapper"
                :class="{ 'text-shifted': phase >= 2 }"
                :style="{
                    opacity: phase >= 1 ? 1 : 0,
                    textShadow: textGlow > 0 ? `0 0 ${8 + textGlow * 12}px rgba(138, 85, 199, ${textGlow * 0.4})` : 'none',
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
            </div>

            <!-- Original Logo (Phase 2+) -->
            <div
                v-show="showLogo"
                class="logo-wrapper"
                :style="{
                    opacity: logoOpacity,
                    transform: `scale(${logoScale})`,
                }"
            >
                <img
                    src="/src/core/lg512y512.png"
                    class="intro-logo"
                    :class="{ mobile: mobile }"
                    alt="PhiTogether"
                />
            </div>
        </div>

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
        align-items: center;
        justify-content: center;
        min-height: 60px;
        transition: all 0.8s ease-out;
        letter-spacing: 2px;
    }

    .typing-wrapper.text-shifted {
        /* Subtle shift to integrate with logo */
        transform: translateY(-8px);
    }

    .logo-wrapper {
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .intro-logo {
        width: 260px;
        height: auto;
        object-fit: contain;
        opacity: 0.95;
    }

    .intro-logo.mobile {
        width: 200px;
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
