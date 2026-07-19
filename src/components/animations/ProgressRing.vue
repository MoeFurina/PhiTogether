<script>
export default {
  name: "ProgressRing",
  props: {
    size: {
      type: Number,
      default: 80,
    },
    strokeWidth: {
      type: Number,
      default: 4,
    },
    progress: {
      type: Number,
      default: 0, // 0-1
    },
    color: {
      type: String,
      default: "#8a55c7",
    },
    backgroundColor: {
      type: String,
      default: "rgba(138, 85, 199, 0.2)",
    },
    autoRotate: {
      type: Boolean,
      default: true,
    },
  },
  data() {
    return {
      rotation: 0,
    };
  },
  computed: {
    radius() {
      return (this.size - this.strokeWidth) / 2;
    },
    circumference() {
      return 2 * Math.PI * this.radius;
    },
    offset() {
      return this.circumference * (1 - this.progress);
    },
    // SVG transform uses absolute coordinates, not percentages
    transformAttr() {
      const cx = this.size / 2;
      const cy = this.size / 2;
      return `rotate(${this.rotation} ${cx} ${cy})`;
    },
    cx() {
      return this.size / 2;
    },
    cy() {
      return this.size / 2;
    },
  },
  watch: {
    progress(newVal) {
      // Trigger reflow for smooth animation
      this.$nextTick(() => {
        const ring = this.$refs.ring;
        if (ring) {
          ring.style.transition = "stroke-dashoffset 0.3s ease-out";
        }
      });
    },
  },
  mounted() {
    if (this.autoRotate) {
      this.rotateInterval = setInterval(() => {
        this.rotation = (this.rotation + 3) % 360;
      }, 33); // ~30fps rotation
    }
  },
  beforeUnmount() {
    if (this.rotateInterval) {
      clearInterval(this.rotateInterval);
    }
  },
};
</script>

<template>
  <svg
    :width="size"
    :height="size"
    :style="{
      width: `${size}px`,
      height: `${size}px`,
    }"
    class="progress-ring"
    viewBox="0 0 100 100"
  >
    <!-- Background ring -->
    <circle
      cx="50"
      cy="50"
      r="40"
      fill="none"
      :stroke="backgroundColor"
      :stroke-width="strokeWidth"
    />
    
    <!-- Progress ring -->
    <circle
      ref="ring"
      class="progress-ring-fill"
      cx="50"
      cy="50"
      r="40"
      fill="none"
      :stroke="color"
      :stroke-width="strokeWidth"
      :stroke-dasharray="circumference"
      :stroke-dashoffset="offset"
      stroke-linecap="round"
      :transform="transformAttr"
    />
    
    <!-- Center dot -->
    <circle
      cx="50"
      cy="50"
      r="2"
      :fill="color"
      opacity="0.8"
    />
  </svg>
</template>

<style scoped>
    .progress-ring {
        display: block;
        margin: 0 auto;
    }

    .progress-ring-fill {
        transform-origin: 50% 50%;
        transition: stroke-dashoffset 0.3s ease-out;
    }
</style>
