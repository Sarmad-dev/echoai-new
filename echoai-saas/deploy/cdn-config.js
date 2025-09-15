/**
 * CDN Configuration and Deployment Setup
 * Manages widget distribution and version management
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class CDNManager {
  constructor(config = {}) {
    this.config = {
      cdnUrl: process.env.CDN_URL || 'https://cdn.echoai.com',
      bucketName: process.env.S3_BUCKET || 'echoai-widget-cdn',
      region: process.env.AWS_REGION || 'us-east-1',
      distributionId: process.env.CLOUDFRONT_DISTRIBUTION_ID,
      enableVersioning: true,
      enableCompression: true,
      cacheMaxAge: 31536000, // 1 year
      ...config
    };

    this.distPath = path.join(__dirname, '..', 'dist');
    this.versions = new Map();
  }

  /**
   * Generate file hash for cache busting
   */
  generateFileHash(filePath) {
    const fileBuffer = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(fileBuffer).digest('hex').substring(0, 8);
  }

  /**
   * Create version manifest
   */
  createVersionManifest() {
    const manifest = {
      version: process.env.WIDGET_VERSION || '1.0.0',
      buildTime: new Date().toISOString(),
      files: {},
      integrity: {}
    };

    // Scan dist directory for files
    const files = fs.readdirSync(this.distPath);
    
    files.forEach(file => {
      if (file.endsWith('.js')) {
        const filePath = path.join(this.distPath, file);
        const hash = this.generateFileHash(filePath);
        const stats = fs.statSync(filePath);
        
        manifest.files[file] = {
          size: stats.size,
          hash: hash,
          url: `${this.config.cdnUrl}/widget/${manifest.version}/${file}`,
          integrity: `sha256-${crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('base64')}`
        };
      }
    });

    // Write manifest
    const manifestPath = path.join(this.distPath, 'manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    
    console.log('✅ Version manifest created');
    return manifest;
  }

  /**
   * Generate CDN deployment structure
   */
  generateCDNStructure() {
    const version = process.env.WIDGET_VERSION || '1.0.0';
    const cdnDir = path.join(this.distPath, 'cdn');
    
    // Create version-specific directory
    const versionDir = path.join(cdnDir, version);
    if (!fs.existsSync(versionDir)) {
      fs.mkdirSync(versionDir, { recursive: true });
    }

    // Copy files to versioned directory
    const files = fs.readdirSync(this.distPath);
    files.forEach(file => {
      if (file.endsWith('.js') || file === 'manifest.json') {
        const sourcePath = path.join(this.distPath, file);
        const destPath = path.join(versionDir, file);
        fs.copyFileSync(sourcePath, destPath);
      }
    });

    // Create latest symlinks
    const latestDir = path.join(cdnDir, 'latest');
    if (!fs.existsSync(latestDir)) {
      fs.mkdirSync(latestDir, { recursive: true });
    }

    files.forEach(file => {
      if (file.endsWith('.js')) {
        const sourcePath = path.join(this.distPath, file);
        const latestPath = path.join(latestDir, file);
        fs.copyFileSync(sourcePath, latestPath);
      }
    });

    console.log(`📁 CDN structure created for version ${version}`);
  }

  /**
   * Generate HTML integration examples
   */
  generateIntegrationExamples() {
    const version = process.env.WIDGET_VERSION || '1.0.0';
    const examplesDir = path.join(this.distPath, 'examples');
    
    if (!fs.existsSync(examplesDir)) {
      fs.mkdirSync(examplesDir, { recursive: true });
    }

    // Basic integration example
    const basicExample = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>EchoAI Widget - Basic Integration</title>
</head>
<body>
    <h1>My Website</h1>
    <p>This is a basic integration example of the EchoAI widget.</p>

    <!-- EchoAI Widget -->
    <script src="${this.config.cdnUrl}/widget/latest/enhanced-widget.min.js" 
            integrity="sha384-..." 
            crossorigin="anonymous"></script>
    <script>
        EchoAI.init({
            apiKey: 'your-api-key',
            chatbotId: 'your-chatbot-id',
            apiUrl: 'https://your-api-endpoint.com/api/enhanced-chat/widget'
        });
    </script>
</body>
</html>`;

    // Advanced integration example
    const advancedExample = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>EchoAI Widget - Advanced Integration</title>
    <style>
        :root {
            --echoai-primary-color: #007bff;
            --echoai-background-color: #ffffff;
        }
    </style>
</head>
<body>
    <h1>Advanced Integration Example</h1>
    
    <!-- Custom trigger button -->
    <button id="chat-trigger">Open Chat</button>

    <!-- EchoAI Widget -->
    <script src="${this.config.cdnUrl}/widget/${version}/enhanced-widget.min.js" 
            integrity="sha384-..." 
            crossorigin="anonymous"></script>
    <script>
        EchoAI.init({
            apiKey: 'your-api-key',
            chatbotId: 'your-chatbot-id',
            apiUrl: 'https://your-api-endpoint.com/api/enhanced-chat/widget',
            
            // Advanced configuration
            theme: {
                primaryColor: '#007bff',
                backgroundColor: '#ffffff',
                borderRadius: '12px'
            },
            
            features: {
                streaming: { enabled: true },
                imageUpload: { enabled: true },
                conversationHistory: { enabled: true },
                faq: { enabled: true }
            },
            
            // Event handlers
            onReady: () => console.log('Widget ready'),
            onMessage: (message) => {
                // Custom analytics
                gtag('event', 'chat_message', {
                    message_type: message.role
                });
            }
        });

        // Custom trigger
        document.getElementById('chat-trigger').addEventListener('click', () => {
            EchoAI.open();
        });
    </script>
</body>
</html>`;

    // React integration example
    const reactExample = `import React, { useEffect } from 'react';

const EchoAIWidget = ({ config }) => {
  useEffect(() => {
    // Load widget script
    const script = document.createElement('script');
    script.src = '${this.config.cdnUrl}/widget/latest/enhanced-widget.min.js';
    script.async = true;
    script.onload = () => {
      window.EchoAI.init(config);
    };
    document.head.appendChild(script);

    return () => {
      // Cleanup
      if (window.EchoAI) {
        window.EchoAI.destroy();
      }
      document.head.removeChild(script);
    };
  }, [config]);

  return null; // Widget renders itself
};

export default EchoAIWidget;

// Usage:
// <EchoAIWidget config={{
//   apiKey: 'your-api-key',
//   chatbotId: 'your-chatbot-id',
//   apiUrl: 'https://your-api-endpoint.com/api/enhanced-chat/widget'
// }} />`;

    // Vue integration example
    const vueExample = `<template>
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
      script.src = '${this.config.cdnUrl}/widget/latest/enhanced-widget.min.js';
      script.async = true;
      script.onload = () => {
        window.EchoAI.init(this.config);
      };
      document.head.appendChild(script);
    }
  }
};
</script>`;

    // Write examples
    fs.writeFileSync(path.join(examplesDir, 'basic.html'), basicExample);
    fs.writeFileSync(path.join(examplesDir, 'advanced.html'), advancedExample);
    fs.writeFileSync(path.join(examplesDir, 'react.jsx'), reactExample);
    fs.writeFileSync(path.join(examplesDir, 'vue.vue'), vueExample);

    console.log('📝 Integration examples generated');
  }

  /**
   * Generate deployment configuration
   */
  generateDeploymentConfig() {
    // AWS S3 + CloudFront configuration
    const awsConfig = {
      s3: {
        bucket: this.config.bucketName,
        region: this.config.region,
        publicReadPolicy: {
          Version: '2012-10-17',
          Statement: [
            {
              Sid: 'PublicReadGetObject',
              Effect: 'Allow',
              Principal: '*',
              Action: 's3:GetObject',
              Resource: `arn:aws:s3:::${this.config.bucketName}/*`
            }
          ]
        }
      },
      cloudfront: {
        distributionId: this.config.distributionId,
        origins: [
          {
            domainName: `${this.config.bucketName}.s3.${this.config.region}.amazonaws.com`,
            originPath: '/widget',
            customOriginConfig: {
              httpPort: 80,
              httpsPort: 443,
              originProtocolPolicy: 'https-only'
            }
          }
        ],
        defaultCacheBehavior: {
          targetOriginId: 'S3-widget-origin',
          viewerProtocolPolicy: 'redirect-to-https',
          compress: true,
          cachePolicyId: '4135ea2d-6df8-44a3-9df3-4b5a84be39ad', // Managed-CachingOptimized
          ttl: {
            defaultTTL: this.config.cacheMaxAge,
            maxTTL: this.config.cacheMaxAge
          }
        }
      }
    };

    // Nginx configuration for self-hosting
    const nginxConfig = `# EchoAI Widget CDN Configuration
server {
    listen 80;
    listen 443 ssl http2;
    server_name cdn.yourdomain.com;

    # SSL configuration (if using HTTPS)
    ssl_certificate /path/to/ssl/certificate.crt;
    ssl_certificate_key /path/to/ssl/private.key;

    # Widget files location
    root /var/www/echoai-widget;
    index index.html;

    # Enable gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/javascript
        application/xml+rss
        application/json;

    # Cache static assets
    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        add_header Access-Control-Allow-Origin "*";
        add_header Access-Control-Allow-Methods "GET, OPTIONS";
        add_header Access-Control-Allow-Headers "Origin, X-Requested-With, Content-Type, Accept";
    }

    # Widget API endpoints
    location /widget/ {
        add_header Access-Control-Allow-Origin "*";
        add_header Access-Control-Allow-Methods "GET, OPTIONS";
        add_header Access-Control-Allow-Headers "Origin, X-Requested-With, Content-Type, Accept";
        
        # Handle preflight requests
        if ($request_method = 'OPTIONS') {
            return 204;
        }
        
        try_files $uri $uri/ =404;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
}`;

    // Docker configuration
    const dockerConfig = `# EchoAI Widget CDN Dockerfile
FROM nginx:alpine

# Copy widget files
COPY dist/ /usr/share/nginx/html/widget/

# Copy nginx configuration
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf

# Enable gzip compression
RUN echo 'gzip on;' >> /etc/nginx/nginx.conf && \\
    echo 'gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;' >> /etc/nginx/nginx.conf

EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]`;

    // Write configuration files
    const deployDir = path.join(__dirname);
    fs.writeFileSync(path.join(deployDir, 'aws-config.json'), JSON.stringify(awsConfig, null, 2));
    fs.writeFileSync(path.join(deployDir, 'nginx.conf'), nginxConfig);
    fs.writeFileSync(path.join(deployDir, 'Dockerfile'), dockerConfig);

    console.log('⚙️ Deployment configurations generated');
  }

  /**
   * Generate monitoring and health check endpoints
   */
  generateMonitoringConfig() {
    const healthCheck = `{
  "version": "${process.env.WIDGET_VERSION || '1.0.0'}",
  "status": "healthy",
  "timestamp": "${new Date().toISOString()}",
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
}`;

    const metricsEndpoint = `/**
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
  res.json(${healthCheck});
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

module.exports = router;`;

    // Write monitoring files
    const monitoringDir = path.join(__dirname, 'monitoring');
    if (!fs.existsSync(monitoringDir)) {
      fs.mkdirSync(monitoringDir, { recursive: true });
    }

    fs.writeFileSync(path.join(monitoringDir, 'health.json'), healthCheck);
    fs.writeFileSync(path.join(monitoringDir, 'metrics.js'), metricsEndpoint);

    console.log('📊 Monitoring configuration generated');
  }

  /**
   * Deploy to CDN
   */
  async deploy() {
    console.log('🚀 Starting CDN deployment...');

    // Generate all necessary files
    this.createVersionManifest();
    this.generateCDNStructure();
    this.generateIntegrationExamples();
    this.generateDeploymentConfig();
    this.generateMonitoringConfig();

    console.log('✅ CDN deployment preparation complete!');
    console.log(`📦 Version: ${process.env.WIDGET_VERSION || '1.0.0'}`);
    console.log(`🌐 CDN URL: ${this.config.cdnUrl}`);
    
    return {
      version: process.env.WIDGET_VERSION || '1.0.0',
      cdnUrl: this.config.cdnUrl,
      files: fs.readdirSync(path.join(this.distPath, 'cdn'))
    };
  }
}

module.exports = CDNManager;

// CLI usage
if (require.main === module) {
  const manager = new CDNManager();
  manager.deploy().then(result => {
    console.log('Deployment result:', result);
  }).catch(error => {
    console.error('Deployment failed:', error);
    process.exit(1);
  });
}