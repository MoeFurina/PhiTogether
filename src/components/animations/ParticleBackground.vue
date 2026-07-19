<script>
    import ParticleEngine from "@utils/js/particleEngine.js";

    export default {
        name: "ParticleBackground",
        props: {
            mode: {
                type: String,
                default: "active", // "active" | "calm" | "menu"
            },
        },
        data() {
            return {
                engine: null,
            };
        },
        watch: {
            mode(newVal) {
                if (this.engine) {
                    this.engine.setMode(newVal);
                }
            },
        },
        mounted() {
            this.engine = new ParticleEngine(this.$refs.canvas, {
                particleCount: window.spec.isDesktop ? 120 : 40,
                triangleCount: window.spec.isDesktop ? 40 : 15,
            });
            this.engine.setMode(this.mode);
            this.engine.start();
        },
        beforeUnmount() {
            if (this.engine) {
                this.engine.dispose();
                this.engine = null;
            }
        },
    };
</script>

<template>
    <canvas ref="canvas" id="particleCanvas" class="particle-background"></canvas>
</template>

<style scoped>
    .particle-background {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        z-index: -1;
        pointer-events: none;
    }
</style>
