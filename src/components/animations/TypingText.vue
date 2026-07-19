<script>
    export default {
        name: "TypingText",
        props: {
            text: {
                type: String,
                default: "",
            },
            speed: {
                type: Number,
                default: 80, // ms per character
            },
            startDelay: {
                type: Number,
                default: 0, // ms before starting
            },
            fontFamily: {
                type: String,
                default: "Saira, Arial, sans-serif",
            },
            fontSize: {
                type: String,
                default: "48px",
            },
            color: {
                type: String,
                default: "#ffffff",
            },
            textAlign: {
                type: String,
                default: "center",
            },
            showCursor: {
                type: Boolean,
                default: true,
            },
            onComplete: {
                type: Function,
                default: null,
            },
        },
        data() {
            return {
                displayText: "",
                started: false,
            };
        },
        watch: {
            text(newVal) {
                this.reset();
            },
        },
        methods: {
            reset() {
                this.displayText = "";
                this.started = false;
                this.startTyping();
            },
            startTyping() {
                if (this.startDelay > 0) {
                    setTimeout(() => this.beginTyping(), this.startDelay);
                } else {
                    this.beginTyping();
                }
            },
            beginTyping() {
                this.started = true;
                const text = this.text;
                let i = 0;
                const interval = setInterval(() => {
                    if (i >= text.length) {
                        clearInterval(interval);
                        if (this.onComplete) {
                            this.onComplete();
                        }
                        return;
                    }
                    this.displayText = text.slice(0, i + 1);
                    i++;
                }, this.speed);
            },
        },
        mounted() {
            this.startTyping();
        },
        beforeUnmount() {
            // Clear any pending intervals
            this.started = false;
        },
    };
</script>

<template>
    <div
        class="typing-text"
        :style="{
            fontFamily,
            fontSize,
            color,
            textAlign,
        }"
    >
        <span class="typing-text-content">{{ displayText }}</span>
        <span
            v-if="showCursor && started && displayText.length < text.length"
            class="typing-cursor"
        >
            |
        </span>
    </div>
</template>

<style scoped>
    .typing-text {
        white-space: nowrap;
    }

    .typing-text-content {
        display: inline-block;
    }

    .typing-cursor {
        display: inline-block;
        margin-left: 4px;
        animation: typing-cursor-blink 1s infinite;
    }

    @keyframes typing-cursor-blink {
        0%,
        50% {
            opacity: 1;
        }
        51%,
        100% {
            opacity: 0;
        }
    }
</style>
