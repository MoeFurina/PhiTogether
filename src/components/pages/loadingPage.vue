<script>
    import shared from "@utils/js/shared";
    import ploading from "@utils/js/ploading.js";
    import ParticleBackground from "@components/animations/ParticleBackground.vue";

    export default {
        name: "loadingPage",
        components: {
            ParticleBackground,
        },
        data() {
            return {
                ver: spec.thisVersion,
                loaded: false,
                loadingPhase: "initializing",
                mobile: !window.spec.isDesktop,
            };
        },
        computed: {
            loadingText() {
                const texts = {
                    initializing: this.$t("loadingPage.initializing"),
                    loadingResources: this.$t("loadingPage.loadingRes"),
                    loadingRenderer: this.$t("loadingPage.loadingRenderer"),
                    ready: this.$t("loadingPage.ready"),
                };
                return texts[this.loadingPhase] || this.$t("loadingPage.loading");
            },
            loadingProgress() {
                const phases = {
                    initializing: 5,
                    loadingResources: 65,
                    loadingRenderer: 88,
                    ready: 100,
                };
                return phases[this.loadingPhase] || 0;
            },
        },
        methods: {
            goToIntro() {
                this.$router.replace("/introSequence");
            },
        },
        async mounted() {
            // Override shared.game.loaded immediately on mount,
            // before waiting for anything, so playerLoaded() always
            // finds the real callback — even if the race condition
            // fires loaded() before untilFullscreen resolves.
            shared.game.loaded = () => {
                this.loaded = true;
                this.loadingPhase = "ready";

                if (window.spec.antiAdditionEnabled) {
                    if (document.visibilityState !== "hidden") {
                        window.nativeApi.antiAddiction_start();
                    } else {
                        shared.game.afterShow.push(
                            () => window.nativeApi && window.nativeApi.antiAddiction_start()
                        );
                    }
                }

                setTimeout(() => {
                    this.goToIntro();
                }, 500);
            };

            const untilFullscreen = () => {
                return new Promise(res => {
                    const checkOnce = () => {
                        if (shared.game.requestedFullscreen) res();
                        else setTimeout(checkOnce, 100);
                    };
                    setTimeout(checkOnce, 100);
                    // Safety timeout: proceed after 30s even if fullscreen
                    // never confirms, so the page doesn't hang forever.
                    setTimeout(res, 30000);
                });
            };

            await untilFullscreen();

            const originalL = ploading.l.bind(ploading);
            const originalR = ploading.r.bind(ploading);

            ploading.l = (msg, id) => {
                if (id === "loadRes") {
                    this.loadingPhase = "loadingResources";
                }
                if (msg && msg.includes("Renderer")) {
                    this.loadingPhase = "loadingRenderer";
                }
                originalL(msg, id);
            };

            ploading.r = id => {
                if (id === "loadRes" && this.loaded) {
                    this.loadingPhase = "ready";
                }
                originalR(id);
            };
        },
    };
</script>

<template>
    <div id="loadingPage">
        <!-- Particle background -->
        <ParticleBackground mode="calm" />

        <!-- Main loading container -->
        <div class="loading-container">
            <!-- Original Logo -->
            <img
                src="/src/core/lg512y512.png"
                class="loading-logo"
                :class="{ mobile: mobile }"
                alt="PhiTogether"
            />

            <!-- Loading text -->
            <div class="loading-text">
                <span class="loading-phase">{{ loadingText }}</span>
                <!-- Horizontal progress bar -->
                <div class="loading-bar-track">
                    <div
                        class="loading-bar-fill"
                        :style="{ width: loadingProgress + '%' }"
                    ></div>
                </div>
            </div>

            <!-- Version info -->
            <div class="version-info">v{{ ver }}</div>
        </div>
    </div>
</template>

<style scoped>
    #loadingPage {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        z-index: 9999;
        margin: 0;
        padding: 0;
    }

    #loadingPage::before {
        content: "";
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: #000000;
        z-index: -1;
    }

    .loading-logo {
        width: 280px;
        height: auto;
        object-fit: contain;
        opacity: 0.9;
    }

    .loading-logo.mobile {
        width: 200px;
    }

    .loading-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 30px;
        position: relative;
        z-index: 1;
    }

    .loading-text {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        margin-top: 10px;
    }

    .loading-phase {
        font-family: Saira, Arial, sans-serif;
        font-size: 18px;
        color: rgba(255, 255, 255, 0.8);
        letter-spacing: 3px;
        text-transform: uppercase;
    }

    .loading-bar-track {
        width: 240px;
        height: 2px;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 2px;
        overflow: hidden;
        margin-top: 12px;
    }

    .loading-bar-fill {
        height: 100%;
        width: 0%;
        background: linear-gradient(90deg, #4b89dc, #8a55c7, #c27bc6);
        border-radius: 2px;
        transition: width 0.5s ease-out;
    }

    .version-info {
        position: fixed;
        bottom: 20px;
        right: 20px;
        font-family: Saira, Arial, sans-serif;
        font-size: 12px;
        color: rgba(255, 255, 255, 0.4);
        z-index: 1;
    }
</style>
