#!/bin/bash

echo "🔍 Document Generator Diagnostics"
echo "=================================="
echo ""

# Check 1: Are any Python servers running?
echo "1️⃣ Checking for running Python servers..."
PYTHON_PROCS=$(ps aux | grep "python.*server" | grep -v grep)
if [ -z "$PYTHON_PROCS" ]; then
    echo "   ❌ No Python servers running"
else
    echo "   ✅ Found Python servers:"
    echo "$PYTHON_PROCS"
fi
echo ""

# Check 2: Are ports in use?
echo "2️⃣ Checking ports..."
for port in 3001 3002 3003; do
    if lsof -i :$port > /dev/null 2>&1; then
        PROC=$(lsof -ti:$port)
        echo "   ✅ Port $port is in use (PID: $PROC)"
    else
        echo "   ❌ Port $port is NOT in use"
    fi
done
echo ""

# Check 3: Test backend connectivity
echo "3️⃣ Testing backend connectivity..."
for port in 3001 3002 3003; do
    if curl -s http://localhost:$port/api/health > /dev/null 2>&1; then
        RESPONSE=$(curl -s http://localhost:$port/api/health)
        echo "   ✅ Backend on port $port responds:"
        echo "      $RESPONSE"
    else
        echo "   ❌ Backend on port $port NOT responding"
    fi
done
echo ""

# Check 4: Redis
echo "4️⃣ Checking Redis..."
if command -v redis-cli &> /dev/null; then
    if redis-cli ping > /dev/null 2>&1; then
        echo "   ✅ Redis is running and responding"
    else
        echo "   ❌ Redis is NOT running"
        echo "   Start with: brew services start redis"
    fi
else
    echo "   ⚠️  redis-cli not found (Redis may not be installed)"
fi
echo ""

# Check 5: Check for server logs
echo "5️⃣ Checking server logs..."
if [ -f "/tmp/server1.log" ]; then
    echo "   ✅ Found server logs at /tmp/server*.log"
    echo "   Last 5 lines from server1.log:"
    tail -5 /tmp/server1.log
else
    echo "   ⚠️  No server logs found at /tmp/server*.log"
fi
echo ""

# Check 6: Virtual environment
echo "6️⃣ Checking Python environment..."
if [ -d "venv" ]; then
    echo "   ✅ Virtual environment exists"
    if [ -f "venv/bin/activate" ]; then
        source venv/bin/activate
        if python -c "import flask" 2>/dev/null; then
            echo "   ✅ Flask is installed"
        else
            echo "   ❌ Flask is NOT installed"
            echo "   Run: pip install -r requirements.txt"
        fi
        if python -c "import redis" 2>/dev/null; then
            echo "   ✅ Redis Python module is installed"
        else
            echo "   ⚠️  Redis Python module is NOT installed"
            echo "   Run: pip install redis"
        fi
    fi
else
    echo "   ❌ Virtual environment does NOT exist"
    echo "   Create with: python3 -m venv venv"
fi
echo ""

# Check 7: Frontend status
echo "7️⃣ Checking frontend..."
VITE_PROC=$(ps aux | grep "vite" | grep -v grep)
if [ -z "$VITE_PROC" ]; then
    echo "   ❌ Frontend (Vite) is NOT running"
else
    echo "   ✅ Frontend (Vite) is running"
fi

if [ -d "node_modules" ]; then
    echo "   ✅ node_modules exists"
else
    echo "   ❌ node_modules missing - run: npm install"
fi
echo ""

# Summary and recommendations
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  📊 Summary & Recommendations"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Determine the issue
BACKEND_RUNNING=false
REDIS_RUNNING=false

for port in 3001 3002 3003; do
    if curl -s http://localhost:$port/api/health > /dev/null 2>&1; then
        BACKEND_RUNNING=true
        break
    fi
done

if redis-cli ping > /dev/null 2>&1; then
    REDIS_RUNNING=true
fi

if [ "$BACKEND_RUNNING" = false ]; then
    echo "❌ ISSUE: Backend is not running"
    echo ""
    echo "🔧 Solutions:"
    echo "   Option 1 - Simple single server (no Redis needed):"
    echo "      python server.py"
    echo ""
    echo "   Option 2 - Scalable with Redis:"
    if [ "$REDIS_RUNNING" = false ]; then
        echo "      brew services start redis"
    fi
    echo "      ./start-scalable-simple.sh"
    echo ""
    echo "   Option 3 - Docker:"
    echo "      docker-compose up -d"
else
    echo "✅ Backend is running"
    
    if [ -z "$VITE_PROC" ]; then
        echo "❌ ISSUE: Frontend is not running"
        echo ""
        echo "🔧 Solution:"
        echo "   npm run dev"
    else
        echo "✅ Frontend is running"
        echo ""
        echo "🎉 Everything looks good!"
        echo ""
        echo "Try accessing: http://localhost:5173"
    fi
fi

echo ""

