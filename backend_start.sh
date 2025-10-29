#!/bin/bash

echo "🔧 Fixing and Restarting Servers"
echo "================================="
echo ""

echo "1️⃣ Stopping all Python and Node servers..."
pkill -9 -f "python.*server" 2>/dev/null && echo "   ✅ Python servers stopped"
pkill -9 -f "node.*server" 2>/dev/null && echo "   ✅ Node servers stopped"

echo ""
echo "2️⃣ Waiting for ports to be released..."
sleep 3

echo ""
echo "3️⃣ Checking which ports are still in use..."
for port in 3001 3002 3003; do
    if lsof -i :$port > /dev/null 2>&1; then
        echo "   ⚠️  Port $port still in use"
        lsof -i :$port
    else
        echo "   ✅ Port $port is free"
    fi
done

echo ""
echo "4️⃣ Starting fresh..."
./start-scalable-simple.sh

