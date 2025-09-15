# EchoAI Widget CDN Dockerfile
FROM nginx:alpine

# Copy widget files
COPY dist/ /usr/share/nginx/html/widget/

# Copy nginx configuration
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf

# Enable gzip compression
RUN echo 'gzip on;' >> /etc/nginx/nginx.conf && \
    echo 'gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;' >> /etc/nginx/nginx.conf

EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]