#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * EchoAI Widget Distribution Builder
 * Creates single-file distribution builds with version management
 */

const VERSION = process.env.WIDGET_VERSION || '1.0.0';
const BUILD_DIR = path.join(__dirname, '..', 'dist');
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const WIDGET_FILE = path.join(PUBLIC_DIR, 'enhanced-widget.js');

console.log('🚀 Building EchoAI Widget Distribution...');
console.log(`📦 Version: ${VERSION}`);

// Ensure build directory exists
if (!fs.existsSync(BUILD_DIR)) {
  fs.mkdirSync(BUILD_DIR, { recursive: true });
}

// Read the enhanced widget source
const widgetSource = fs.readFileSync(WIDGET_FILE, 'utf8');

// Create minified version using basic minification
function minifyCode(code) {
  return code
    // Remove comments
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')
    // Remove extra whitespace
    .replace(/\s+/g, ' ')
    // Remove whitespace around operators and brackets
    .replace(/\s*([{}();,=+\-*/<>!&|])\s*/g, '$1')
    .trim();
}

// Create distribution builds
const builds = [
  {
    name: 'enhanced-widget.js',
    content: widgetSource,
    minified: false
  },
  {
    name: 'enhanced-widget.min.js',
    content: minifyCode(widgetSource),
    minified: true
  }
];

// Add version and build info to each build
builds.forEach(build => {
  const versionHeader = `/*!
 * EchoAI Enhanced Widget v${VERSION}
 * Built: ${new Date().toISOString()}
 * License: MIT
 * 
 * This is a ${build.minified ? 'minified' : 'development'} build.
 * For documentation and integration guides, visit: https://docs.echoai.com
 */
`;

  const finalContent = versionHeader + '\n' + build.content;
  
  // Write to dist directory
  const outputPath = path.join(BUILD_DIR, build.name);
  fs.writeFileSync(outputPath, finalContent);
  
  console.log(`✅ Created: ${build.name} (${(finalContent.length / 1024).toFixed(1)}KB)`);
});

// Create CDN-ready structure
const cdnDir = path.join(BUILD_DIR, 'cdn');
if (!fs.existsSync(cdnDir)) {
  fs.mkdirSync(cdnDir, { recursive: true });
}

// Create versioned CDN files
builds.forEach(build => {
  const versionedName = build.name.replace('.js', `-${VERSION}.js`);
  const cdnPath = path.join(cdnDir, versionedName);
  const sourcePath = path.join(BUILD_DIR, build.name);
  
  fs.copyFileSync(sourcePath, cdnPath);
  console.log(`📡 CDN: ${versionedName}`);
});

// Create latest symlinks for CDN
builds.forEach(build => {
  const latestName = build.name.replace('.js', '-latest.js');
  const latestPath = path.join(cdnDir, latestName);
  const sourcePath = path.join(BUILD_DIR, build.name);
  
  fs.copyFileSync(sourcePath, latestPath);
  console.log(`🔗 Latest: ${latestName}`);
});

console.log('✨ Distribution build complete!');