#!/bin/bash

echo "🎨 Starting Frontend for Document Generator"
echo "==========================================="
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ Failed to install dependencies"
        exit 1
    fi
    echo "✅ Dependencies installed"
else
    echo "✅ Dependencies already installed"
fi

echo ""
echo "🔍 Checking backend connection..."

# Test if backend is reachable
if curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
    echo "   ✅ Backend server 1 is reachable (http://localhost:3001)"
else
    echo "   ⚠️  Backend server 1 not reachable at http://localhost:3001"
    echo "   Make sure Docker containers are running:"
    echo "   docker-compose ps"
fi

if curl -s http://localhost:3002/api/health > /dev/null 2>&1; then
    echo "   ✅ Backend server 2 is reachable (http://localhost:3002)"
fi

if curl -s http://localhost:3003/api/health > /dev/null 2>&1; then
    echo "   ✅ Backend server 3 is reachable (http://localhost:3003)"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  🚀 Starting Frontend Dev Server"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📝 Configuration:"
echo "   Frontend URL: http://localhost:5173"
echo "   Backend API:  http://localhost:3001 (proxied)"
echo ""
echo "💡 The frontend will proxy /api/* requests to backend"
echo ""
echo "Press Ctrl+C to stop the dev server"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Start Vite dev server
npm run dev

