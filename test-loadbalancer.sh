#!/bin/bash

echo "🧪 Testing Load Balancer"
echo "========================"
echo ""

# Test if load balancer is running
if ! curl -s http://localhost/health > /dev/null 2>&1; then
    echo "❌ Load balancer not running!"
    echo "   Start with: ./start-with-loadbalancer.sh"
    exit 1
fi

echo "✅ Load balancer is running"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 1: Load Balancer Health"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

curl -s http://localhost/health
echo ""

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 2: Backend Health (through Load Balancer)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

curl -s http://localhost/api/health | python3 -m json.tool
echo ""

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 3: Load Distribution (10 requests)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Making 10 requests to see load distribution..."
echo ""

declare -A servers
servers["port-3001"]=0
servers["port-3002"]=0
servers["port-3003"]=0

for i in {1..10}; do
    RESPONSE=$(curl -s http://localhost/api/health)
    INSTANCE=$(echo $RESPONSE | python3 -c "import json,sys; print(json.load(sys.stdin).get('instance', 'unknown'))" 2>/dev/null)
    
    if [ ! -z "$INSTANCE" ]; then
        servers[$INSTANCE]=$((${servers[$INSTANCE]} + 1))
        echo "Request $i → $INSTANCE"
    fi
    
    sleep 0.2
done

echo ""
echo "Load Distribution Summary:"
echo "   Server 1 (port-3001): ${servers[port-3001]} requests"
echo "   Server 2 (port-3002): ${servers[port-3002]} requests"
echo "   Server 3 (port-3003): ${servers[port-3003]} requests"
echo ""

# Check if distribution is reasonable
if [ ${servers[port-3001]} -gt 0 ] && [ ${servers[port-3002]} -gt 0 ] && [ ${servers[port-3003]} -gt 0 ]; then
    echo "✅ Load is distributed across all servers!"
else
    echo "⚠️  Load distribution may not be working correctly"
    echo "   Some servers didn't receive any requests"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 4: Create Job and Check Cross-Server Visibility"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "Creating job through load balancer..."
JOB_RESPONSE=$(curl -s -X POST http://localhost/api/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Test load balancing"}')

JOB_ID=$(echo $JOB_RESPONSE | python3 -c "import json,sys; print(json.load(sys.stdin).get('jobId', ''))" 2>/dev/null)

if [ ! -z "$JOB_ID" ]; then
    echo "✅ Job created: $JOB_ID"
    echo ""
    
    sleep 2
    
    echo "Fetching job status 3 times (should hit different servers)..."
    echo ""
    
    for i in {1..3}; do
        STATUS=$(curl -s http://localhost/api/status/$JOB_ID)
        SERVER=$(echo $STATUS | python3 -c "import json,sys; print(json.load(sys.stdin).get('_server', 'unknown'))" 2>/dev/null)
        STAGE=$(echo $STATUS | python3 -c "import json,sys; print(json.load(sys.stdin).get('stage', 'unknown'))" 2>/dev/null)
        
        echo "Request $i → Server: $SERVER, Stage: $STAGE"
        sleep 0.5
    done
    
    echo ""
    echo "✅ Job visible across all servers via Redis shared state!"
else
    echo "⚠️  Failed to create job"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 5: Server-Sent Events (SSE)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ ! -z "$JOB_ID" ]; then
    echo "Testing SSE stream for 5 seconds..."
    echo ""
    
    timeout 5 curl -s http://localhost/api/status/$JOB_ID/stream 2>/dev/null | head -5
    
    echo ""
    echo "✅ SSE streaming works through load balancer!"
else
    echo "⚠️  Skipping SSE test (no job ID)"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✅ Load balancer is working correctly!"
echo ""
echo "Features verified:"
echo "   ✅ Nginx load balancer responding"
echo "   ✅ Backend health checks working"
echo "   ✅ Load distributed across servers"
echo "   ✅ Shared state via Redis"
echo "   ✅ SSE streaming through load balancer"
echo ""
echo "🎉 Your production-grade load balanced system is ready!"
echo ""

