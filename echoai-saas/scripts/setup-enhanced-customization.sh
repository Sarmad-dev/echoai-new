#!/bin/bash

echo "🎨 Setting up Enhanced Customization Features"
echo "============================================="

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the echoai-saas directory"
    exit 1
fi

echo "📦 Installing any missing dependencies..."

# Install class-variance-authority if not already installed
npm install class-variance-authority

echo ""
echo "🔄 Running database migration for chatbot API keys..."

# Generate Prisma client and push schema
npx prisma generate
npx prisma db push

echo ""
echo "✅ Setup completed successfully!"
echo ""
echo "🎯 New Features Added:"
echo "   • 🎨 Enhanced Color Picker with:"
echo "     - Predefined color palette"
echo "     - Color wheel selector"
echo "     - Custom hex input"
echo "     - Gradient options"
echo "   • 💬 Test Chat Widget:"
echo "     - Real-time chat testing"
echo "     - Training data validation"
echo "     - Live preview with chatbot settings"
echo "     - Configurable positioning"
echo "   • 🔑 Chatbot API Keys:"
echo "     - Each chatbot gets unique API key"
echo "     - Secure authentication for embed widgets"
echo ""
echo "🚀 Next Steps:"
echo "   1. Visit /dashboard/customize to try the new features"
echo "   2. Select a chatbot and test the enhanced color picker"
echo "   3. Use the test chat widget to verify functionality"
echo "   4. Train your chatbot with data for better responses"