#!/bin/bash

echo "🧪 Testing API Endpoints"
echo "========================"
echo ""

# Test 1: Is backend reachable?
echo "1️⃣ Testing backend health endpoint..."
HEALTH_RESPONSE=$(curl -s -w "\n%{http_code}" http://localhost:3001/api/health 2>&1)
HTTP_CODE=$(echo "$HEALTH_RESPONSE" | tail -n 1)
BODY=$(echo "$HEALTH_RESPONSE" | head -n -1)

if [ "$HTTP_CODE" = "200" ]; then
    echo "   ✅ Backend is responding"
    echo "   Response: $BODY"
else
    echo "   ❌ Backend health check failed (HTTP $HTTP_CODE)"
    echo "   Response: $BODY"
    echo ""
    echo "🔧 Fix: Backend is not running or not on port 3001"
    echo "   Run: ./start-simple.sh"
    exit 1
fi

echo ""

# Test 2: Try to generate a document
echo "2️⃣ Testing document generation..."
GENERATE_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST http://localhost:3001/api/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Test document generation"}' 2>&1)

GEN_HTTP_CODE=$(echo "$GENERATE_RESPONSE" | tail -n 1)
GEN_BODY=$(echo "$GENERATE_RESPONSE" | head -n -1)

echo "   HTTP Status: $GEN_HTTP_CODE"
echo "   Response: $GEN_BODY"

if [ "$GEN_HTTP_CODE" = "200" ]; then
    echo "   ✅ Document generation endpoint works"
    
    # Extract job ID
    JOB_ID=$(echo "$GEN_BODY" | python3 -c "import json,sys; print(json.load(sys.stdin).get('jobId', ''))" 2>/dev/null)
    
    if [ -n "$JOB_ID" ]; then
        echo "   ✅ Job ID received: $JOB_ID"
        
        echo ""
        echo "3️⃣ Testing status endpoint..."
        sleep 2
        
        STATUS_RESPONSE=$(curl -s http://localhost:3001/api/status/$JOB_ID)
        echo "   Status: $STATUS_RESPONSE"
        
        STAGE=$(echo "$STATUS_RESPONSE" | python3 -c "import json,sys; print(json.load(sys.stdin).get('stage', 'unknown'))" 2>/dev/null)
        echo "   Current stage: $STAGE"
        
        echo ""
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "  ✅ Backend API is working correctly!"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""
        echo "If frontend still stuck, the issue is in the frontend."
        echo ""
        echo "Check browser console (F12) for errors."
        echo ""
        echo "Common frontend issues:"
        echo "   1. CORS errors (check browser console)"
        echo "   2. Wrong API URL in frontend code"
        echo "   3. Frontend not proxying to backend correctly"
        echo ""
        echo "Test in browser:"
        echo "   Open: http://localhost:5173"
        echo "   Press F12 (open developer console)"
        echo "   Try to generate a document"
        echo "   Look for errors in Console tab"
        
    else
        echo "   ⚠️ No job ID in response"
    fi
else
    echo "   ❌ Document generation failed"
    echo ""
    echo "This is why your frontend is stuck!"
    echo ""
    echo "Possible causes:"
    echo "   1. Backend code error"
    echo "   2. Missing dependencies"
    echo "   3. Database/Redis connection issue"
    echo ""
    echo "Check backend logs:"
    echo "   cat /tmp/backend.log"
    echo "   cat /tmp/server1.log"
fi

echo ""

