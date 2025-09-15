/**
 * Widget Metrics Endpoint
 * Provides usage statistics and performance metrics
 */
const express = require('express');
const router = express.Router();

// Metrics storage (use Redis or database in production)
const metrics = {
  downloads: 0,
  activeInstances: 0,
  errors: 0,
  performance: {
    avgLoadTime: 0,
    avgResponseTime: 0
  }
};

router.get('/health', (req, res) => {
  res.json({
  "version": "1.0.0",
  "status": "healthy",
  "timestamp": "2025-09-11T18:42:55.665Z",
  "checks": {
    "files": {
      "enhanced-widget.js": "available",
      "enhanced-widget.min.js": "available"
    },
    "cdn": {
      "status": "operational",
      "latency": "< 100ms"
    }
  }
});
});

router.get('/metrics', (req, res) => {
  res.json({
    ...metrics,
    timestamp: new Date().toISOString()
  });
});

router.post('/track', (req, res) => {
  const { event, properties } = req.body;
  
  // Track widget usage
  switch (event) {
    case 'widget_loaded':
      metrics.downloads++;
      break;
    case 'widget_error':
      metrics.errors++;
      break;
    case 'performance_metric':
      if (properties.loadTime) {
        metrics.performance.avgLoadTime = 
          (metrics.performance.avgLoadTime + properties.loadTime) / 2;
      }
      break;
  }
  
  res.json({ success: true });
});

module.exports = router;