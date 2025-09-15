# EchoAI Enhanced Widget - Deployment Guide

## Overview

This document provides comprehensive instructions for deploying the EchoAI Enhanced Widget v1.0.0 to production environments.

## Quick Deployment

### 1. Build Distribution

```bash
# Build widget distribution files
npm run build:widget

# Validate deployment artifacts
npm run validate:deployment
```

### 2. Deploy to CDN

```bash
# Generate CDN structure and configuration
npm run deploy:cdn

# Upload to your CDN provider (AWS S3 + CloudFront example)
aws s3 sync dist/cdn/ s3://your-widget-bucket/widget/ --delete
aws cloudfront create-invalidation --distribution-id YOUR_DISTRIBUTION_ID --paths "/widget/*"
```

## Deployment Artifacts

### Generated Files

After running the build process, the following files are created:

```
dist/
├── enhanced-widget.js          # Development version (277.7KB)
├── enhanced-widget.min.js      # Minified version (171.9KB)
├── manifest.json               # Version and integrity information
├── cdn/
│   ├── 1.0.0/                 # Version-specific files
│   │   ├── enhanced-widget.js
│   │   └── enhanced-widget.min.js
│   └── latest/                # Latest version symlinks
│       ├── enhanced-widget.js
│       └── enhanced-widget.min.js
└── examples/
    ├── basic.html             # Basic integration example
    ├── advanced.html          # Advanced configuration example
    ├── react.jsx              # React integration
    └── vue.vue                # Vue.js integration
```

### Configuration Files

```
deploy/
├── aws-config.json            # AWS S3 + CloudFront configuration
├── nginx.conf                 # Nginx configuration for self-hosting
├── Dockerfile                 # Docker container configuration
└── monitoring/
    ├── health.json            # Health check endpoint
    └── metrics.js             # Metrics collection endpoint
```

## Deployment Options

### Option 1: AWS S3 + CloudFront (Recommended)

1. **Create S3 Bucket**
   ```bash
   aws s3 mb s3://your-widget-bucket
   aws s3api put-bucket-policy --bucket your-widget-bucket --policy file://deploy/s3-policy.json
   ```

2. **Configure CloudFront Distribution**
   ```bash
   aws cloudfront create-distribution --distribution-config file://deploy/cloudfront-config.json
   ```

3. **Deploy Files**
   ```bash
   aws s3 sync dist/cdn/ s3://your-widget-bucket/widget/ --delete
   aws cloudfront create-invalidation --distribution-id YOUR_DISTRIBUTION_ID --paths "/widget/*"
   ```

### Option 2: Self-Hosted with Nginx

1. **Install Nginx**
   ```bash
   sudo apt update
   sudo apt install nginx
   ```

2. **Copy Configuration**
   ```bash
   sudo cp deploy/nginx.conf /etc/nginx/sites-available/echoai-widget
   sudo ln -s /etc/nginx/sites-available/echoai-widget /etc/nginx/sites-enabled/
   ```

3. **Deploy Files**
   ```bash
   sudo mkdir -p /var/www/echoai-widget
   sudo cp -r dist/cdn/* /var/www/echoai-widget/
   sudo systemctl reload nginx
   ```

### Option 3: Docker Container

1. **Build Container**
   ```bash
   docker build -t echoai-widget:1.0.0 -f deploy/Dockerfile .
   ```

2. **Run Container**
   ```bash
   docker run -d -p 80:80 --name echoai-widget echoai-widget:1.0.0
   ```

3. **Deploy with Docker Compose**
   ```yaml
   version: '3.8'
   services:
     widget-cdn:
       build:
         context: .
         dockerfile: deploy/Dockerfile
       ports:
         - "80:80"
       restart: unless-stopped
   ```

## CDN Configuration

### Cache Headers

Set appropriate cache headers for optimal performance:

```
enhanced-widget.js          # Cache: 1 hour (for development)
enhanced-widget.min.js      # Cache: 1 year (for production)
enhanced-widget-1.0.0.js    # Cache: 1 year (immutable)
enhanced-widget-latest.js   # Cache: 1 hour (updates frequently)
```

### CORS Configuration

Ensure your CDN allows cross-origin requests:

```json
{
  "CorsConfiguration": {
    "CorsRules": [
      {
        "AllowedOrigins": ["*"],
        "AllowedMethods": ["GET", "HEAD"],
        "AllowedHeaders": ["*"],
        "MaxAgeSeconds": 3600
      }
    ]
  }
}
```

## Integration URLs

After deployment, the widget will be available at:

```
# Latest version (updates automatically)
https://your-cdn.com/widget/latest/enhanced-widget.min.js

# Specific version (immutable)
https://your-cdn.com/widget/1.0.0/enhanced-widget.min.js

# Development version (unminified)
https://your-cdn.com/widget/latest/enhanced-widget.js
```

## Monitoring and Health Checks

### Health Check Endpoint

```
GET /widget/health
```

Response:
```json
{
  "version": "1.0.0",
  "status": "healthy",
  "timestamp": "2025-09-11T18:44:13.419Z",
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
}
```

### Metrics Collection

The widget includes built-in analytics and monitoring:

```javascript
// Automatic metrics collection
EchoAI.init({
  // ... your config
  analytics: {
    enabled: true,
    provider: 'google', // or 'mixpanel', 'amplitude'
    trackingId: 'your-tracking-id'
  }
});
```

## Security Considerations

### Content Security Policy

Add the following CSP headers to allow the widget:

```
script-src 'self' https://your-cdn.com;
connect-src 'self' https://your-api.com wss://your-websocket.com;
img-src 'self' data: https:;
```

### Subresource Integrity

Use SRI hashes for additional security:

```html
<script src="https://your-cdn.com/widget/1.0.0/enhanced-widget.min.js"
        integrity="sha384-..."
        crossorigin="anonymous"></script>
```

SRI hashes are available in the `manifest.json` file.

## Performance Optimization

### Bundle Analysis

- **Minified size**: 171.9KB
- **Estimated gzipped**: 51.6KB
- **Load time**: < 500ms on 3G networks

### Optimization Tips

1. **Use minified version in production**
2. **Enable gzip compression**
3. **Set appropriate cache headers**
4. **Use CDN for global distribution**
5. **Preload script for critical paths**

```html
<link rel="preload" href="https://your-cdn.com/widget/latest/enhanced-widget.min.js" as="script">
```

## Rollback Procedures

### Version Rollback

To rollback to a previous version:

1. **Update latest symlinks**
   ```bash
   aws s3 cp s3://your-bucket/widget/1.0.0/ s3://your-bucket/widget/latest/ --recursive
   ```

2. **Invalidate CDN cache**
   ```bash
   aws cloudfront create-invalidation --distribution-id YOUR_ID --paths "/widget/latest/*"
   ```

### Emergency Rollback

For immediate rollback, update the `latest` directory to point to the previous stable version.

## Troubleshooting

### Common Issues

1. **Widget not loading**
   - Check CDN availability
   - Verify CORS configuration
   - Check browser console for errors

2. **Slow loading**
   - Verify gzip compression is enabled
   - Check CDN cache hit rates
   - Monitor network latency

3. **Integration errors**
   - Validate API endpoints
   - Check authentication configuration
   - Review browser compatibility

### Debug Mode

Enable debug mode for troubleshooting:

```javascript
EchoAI.init({
  // ... your config
  debug: true,
  logLevel: 'verbose'
});
```

## Support and Maintenance

### Version Management

- **Major versions**: Breaking changes, manual migration required
- **Minor versions**: New features, backward compatible
- **Patch versions**: Bug fixes, automatic updates recommended

### Update Notifications

Subscribe to update notifications:
- GitHub releases
- NPM package updates
- Email notifications (if configured)

### Support Channels

- Documentation: `/docs/widget-integration-guide.md`
- Migration Guide: `/docs/migration-guide.md`
- GitHub Issues: For bug reports and feature requests
- Support Email: For deployment assistance

## Deployment Checklist

- [ ] Build distribution files
- [ ] Validate deployment artifacts
- [ ] Configure CDN/hosting
- [ ] Set up monitoring
- [ ] Test integration examples
- [ ] Verify health checks
- [ ] Configure analytics
- [ ] Set up rollback procedures
- [ ] Update documentation
- [ ] Notify stakeholders

## Next Steps

After successful deployment:

1. Monitor widget performance and usage
2. Collect user feedback
3. Plan feature updates
4. Optimize based on analytics data
5. Prepare for next version release