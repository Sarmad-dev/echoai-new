#!/usr/bin/env node

/**
 * EchoAI Widget Deployment Validation
 * Validates the built widget and deployment artifacts
 */

const fs = require("fs");
const path = require("path");

class DeploymentValidator {
  constructor() {
    this.distPath = path.join(__dirname, "..", "dist");
    this.errors = [];
    this.warnings = [];
  }

  log(message, type = "info") {
    const timestamp = new Date().toISOString();
    const prefix = {
      info: "✅",
      warning: "⚠️",
      error: "❌",
    }[type];

    console.log(`${prefix} [${timestamp}] ${message}`);

    if (type === "error") {
      this.errors.push(message);
    } else if (type === "warning") {
      this.warnings.push(message);
    }
  }

  validateFileExists(filePath, description) {
    if (fs.existsSync(filePath)) {
      this.log(`${description} exists: ${filePath}`);
      return true;
    } else {
      this.log(`${description} missing: ${filePath}`, "error");
      return false;
    }
  }

  validateFileSize(filePath, maxSize, description) {
    if (!fs.existsSync(filePath)) {
      return false;
    }

    const stats = fs.statSync(filePath);
    const sizeKB = stats.size / 1024;

    if (sizeKB <= maxSize) {
      this.log(
        `${description} size OK: ${sizeKB.toFixed(1)}KB (max: ${maxSize}KB)`
      );
      return true;
    } else {
      this.log(
        `${description} too large: ${sizeKB.toFixed(1)}KB (max: ${maxSize}KB)`,
        "warning"
      );
      return false;
    }
  }

  validateJavaScriptSyntax(filePath, description) {
    if (!fs.existsSync(filePath)) {
      return false;
    }

    try {
      const content = fs.readFileSync(filePath, "utf8");

      // Basic syntax validation
      if (content.includes("function") || content.includes("=>")) {
        this.log(`${description} syntax appears valid`);
        return true;
      } else {
        this.log(`${description} may have syntax issues`, "warning");
        return false;
      }
    } catch (error) {
      this.log(
        `${description} syntax validation failed: ${error.message}`,
        "error"
      );
      return false;
    }
  }

  validateWidgetStructure(filePath) {
    if (!fs.existsSync(filePath)) {
      return false;
    }

    const content = fs.readFileSync(filePath, "utf8");
    const requiredComponents = [
      "StateManager",
      "EventManager",
      "APIClient",
      "RealtimeManager",
      "UIManager",
      "EchoAI",
    ];

    let allFound = true;
    requiredComponents.forEach((component) => {
      if (content.includes(component)) {
        this.log(`Widget component found: ${component}`);
      } else {
        this.log(`Widget component missing: ${component}`, "error");
        allFound = false;
      }
    });

    return allFound;
  }

  validateManifest() {
    const manifestPath = path.join(this.distPath, "manifest.json");

    if (!this.validateFileExists(manifestPath, "Version manifest")) {
      return false;
    }

    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

      // Validate manifest structure
      const requiredFields = ["version", "buildTime", "files", "integrity"];
      let valid = true;

      requiredFields.forEach((field) => {
        if (manifest[field]) {
          this.log(`Manifest field present: ${field}`);
        } else {
          this.log(`Manifest field missing: ${field}`, "error");
          valid = false;
        }
      });

      // Validate file entries
      if (manifest.files) {
        Object.keys(manifest.files).forEach((fileName) => {
          const fileInfo = manifest.files[fileName];
          if (fileInfo.size && fileInfo.hash && fileInfo.url) {
            this.log(`Manifest entry valid: ${fileName}`);
          } else {
            this.log(`Manifest entry incomplete: ${fileName}`, "warning");
          }
        });
      }

      return valid;
    } catch (error) {
      this.log(`Manifest validation failed: ${error.message}`, "error");
      return false;
    }
  }

  validateCDNStructure() {
    const cdnPath = path.join(this.distPath, "cdn");

    if (!this.validateFileExists(cdnPath, "CDN directory")) {
      return false;
    }

    // Check version directory
    const version = process.env.WIDGET_VERSION || "1.0.0";
    const versionPath = path.join(cdnPath, version);

    if (
      !this.validateFileExists(versionPath, `Version directory (${version})`)
    ) {
      return false;
    }

    // Check latest directory
    const latestPath = path.join(cdnPath, "latest");

    if (!this.validateFileExists(latestPath, "Latest directory")) {
      return false;
    }

    // Validate required files in both directories
    const requiredFiles = ["enhanced-widget.js", "enhanced-widget.min.js"];

    let allValid = true;
    [versionPath, latestPath].forEach((dirPath) => {
      requiredFiles.forEach((fileName) => {
        const filePath = path.join(dirPath, fileName);
        if (!this.validateFileExists(filePath, `CDN file: ${fileName}`)) {
          allValid = false;
        }
      });
    });

    return allValid;
  }

  validateDocumentation() {
    const docsPath = path.join(__dirname, "..", "docs");
    const requiredDocs = ["widget-integration-guide.md", "migration-guide.md"];

    let allValid = true;
    requiredDocs.forEach((docFile) => {
      const docPath = path.join(docsPath, docFile);
      if (!this.validateFileExists(docPath, `Documentation: ${docFile}`)) {
        allValid = false;
      } else {
        // Check if documentation has content
        const content = fs.readFileSync(docPath, "utf8");
        if (content.length > 1000) {
          this.log(`Documentation has sufficient content: ${docFile}`);
        } else {
          this.log(`Documentation may be incomplete: ${docFile}`, "warning");
        }
      }
    });

    return allValid;
  }

  validateExamples() {
    const examplesPath = path.join(this.distPath, "examples");

    if (!this.validateFileExists(examplesPath, "Examples directory")) {
      return false;
    }

    const requiredExamples = [
      "basic.html",
      "advanced.html",
      "react.jsx",
      "vue.vue",
    ];

    let allValid = true;
    requiredExamples.forEach((exampleFile) => {
      const examplePath = path.join(examplesPath, exampleFile);
      if (!this.validateFileExists(examplePath, `Example: ${exampleFile}`)) {
        allValid = false;
      }
    });

    return allValid;
  }

  validateDeploymentConfig() {
    const deployPath = path.join(__dirname, "..", "deploy");
    const requiredConfigs = ["aws-config.json", "nginx.conf", "Dockerfile"];

    let allValid = true;
    requiredConfigs.forEach((configFile) => {
      const configPath = path.join(deployPath, configFile);
      if (
        !this.validateFileExists(configPath, `Deployment config: ${configFile}`)
      ) {
        allValid = false;
      }
    });

    return allValid;
  }

  validateMonitoring() {
    const monitoringPath = path.join(__dirname, "..", "deploy", "monitoring");

    if (!this.validateFileExists(monitoringPath, "Monitoring directory")) {
      return false;
    }

    const requiredFiles = ["health.json", "metrics.js"];

    let allValid = true;
    requiredFiles.forEach((fileName) => {
      const filePath = path.join(monitoringPath, fileName);
      if (!this.validateFileExists(filePath, `Monitoring: ${fileName}`)) {
        allValid = false;
      }
    });

    return allValid;
  }

  async runValidation() {
    console.log("🔍 Starting EchoAI Widget Deployment Validation...\n");

    // Core widget files validation
    this.log("=== Core Widget Files ===");
    const widgetPath = path.join(this.distPath, "enhanced-widget.js");
    const widgetMinPath = path.join(this.distPath, "enhanced-widget.min.js");

    this.validateFileExists(widgetPath, "Enhanced widget (development)");
    this.validateFileExists(widgetMinPath, "Enhanced widget (minified)");

    // File size validation
    this.validateFileSize(widgetPath, 500, "Development widget"); // 500KB max
    this.validateFileSize(widgetMinPath, 300, "Minified widget"); // 300KB max

    // JavaScript syntax validation
    this.validateJavaScriptSyntax(widgetPath, "Development widget");
    this.validateJavaScriptSyntax(widgetMinPath, "Minified widget");

    // Widget structure validation
    this.validateWidgetStructure(widgetPath);

    // Manifest validation
    this.log("\n=== Version Manifest ===");
    this.validateManifest();

    // CDN structure validation
    this.log("\n=== CDN Structure ===");
    this.validateCDNStructure();

    // Documentation validation
    this.log("\n=== Documentation ===");
    this.validateDocumentation();

    // Examples validation
    this.log("\n=== Integration Examples ===");
    this.validateExamples();

    // Deployment configuration validation
    this.log("\n=== Deployment Configuration ===");
    this.validateDeploymentConfig();

    // Monitoring validation
    this.log("\n=== Monitoring Setup ===");
    this.validateMonitoring();

    // Analytics validation
    this.log("\n=== Analytics Integration ===");
    const analyticsPath = path.join(__dirname, "widget-analytics.js");
    this.validateFileExists(analyticsPath, "Analytics integration");

    // Summary
    this.log("\n=== Validation Summary ===");

    if (this.errors.length === 0) {
      this.log("🎉 All validations passed! Widget is ready for deployment.");
    } else {
      this.log(`❌ ${this.errors.length} error(s) found:`, "error");
      this.errors.forEach((error) => {
        console.log(`   - ${error}`);
      });
    }

    if (this.warnings.length > 0) {
      this.log(`⚠️ ${this.warnings.length} warning(s):`, "warning");
      this.warnings.forEach((warning) => {
        console.log(`   - ${warning}`);
      });
    }

    // Performance metrics
    this.log("\n=== Performance Metrics ===");
    if (fs.existsSync(widgetMinPath)) {
      const stats = fs.statSync(widgetMinPath);
      const sizeKB = stats.size / 1024;
      const gzipEstimate = sizeKB * 0.3; // Rough gzip estimate

      this.log(`Minified size: ${sizeKB.toFixed(1)}KB`);
      this.log(`Estimated gzipped size: ${gzipEstimate.toFixed(1)}KB`);

      if (gzipEstimate < 50) {
        this.log("✅ Excellent bundle size for fast loading");
      } else if (gzipEstimate < 100) {
        this.log("✅ Good bundle size");
      } else {
        this.log("⚠️ Bundle size may impact loading performance", "warning");
      }
    }

    return {
      success: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings,
    };
  }
}

// Run validation if called directly
if (require.main === module) {
  const validator = new DeploymentValidator();
  validator
    .runValidation()
    .then((result) => {
      process.exit(result.success ? 0 : 1);
    })
    .catch((error) => {
      console.error("Validation failed:", error);
      process.exit(1);
    });
}

module.exports = DeploymentValidator;
