<template>
  <div>
    <!-- Your app content -->
  </div>
</template>

<script>
export default {
  name: 'EchoAIWidget',
  props: {
    config: {
      type: Object,
      required: true
    }
  },
  mounted() {
    this.loadWidget();
  },
  beforeUnmount() {
    if (window.EchoAI) {
      window.EchoAI.destroy();
    }
  },
  methods: {
    loadWidget() {
      const script = document.createElement('script');
      script.src = 'https://cdn.echoai.com/widget/latest/enhanced-widget.min.js';
      script.async = true;
      script.onload = () => {
        window.EchoAI.init(this.config);
      };
      document.head.appendChild(script);
    }
  }
};
</script>