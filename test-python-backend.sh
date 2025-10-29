#!/bin/bash

echo "🧪 Testing Python Backend"
echo "=========================="
echo ""

# Check if server is running
if ! curl -s http://localhost:3001/api/status/test > /dev/null 2>&1; then
    echo "⚠️  Warning: Backend doesn't seem to be running on port 3001"
    echo "Please start the backend first with: python server.py"
    echo ""
    read -p "Press enter to continue anyway or Ctrl+C to exit..."
fi

echo "1️⃣ Testing document generation..."
echo ""

# Generate document
RESPONSE=$(curl -s -X POST http://localhost:3001/api/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Write a test document about AI"}')

echo "Response: $RESPONSE"
echo ""

# Extract job ID
JOB_ID=$(echo $RESPONSE | grep -o '"jobId":"[^"]*' | cut -d'"' -f4)

if [ -z "$JOB_ID" ]; then
    echo "❌ Failed to get job ID"
    exit 1
fi

echo "✅ Job created: $JOB_ID"
echo ""

echo "2️⃣ Testing status endpoint..."
echo ""

# Get status
STATUS=$(curl -s http://localhost:3001/api/status/$JOB_ID)
echo "Status: $STATUS"
echo ""

echo "3️⃣ Monitoring job progress (10 seconds)..."
echo ""

# Monitor for 10 seconds
for i in {1..10}; do
    STATUS=$(curl -s http://localhost:3001/api/status/$JOB_ID)
    STAGE=$(echo $STATUS | grep -o '"stage":"[^"]*' | cut -d'"' -f4)
    PROGRESS=$(echo $STATUS | grep -o '"progress":[0-9]*' | cut -d':' -f2)
    
    echo "[$i/10] Stage: $STAGE, Progress: $PROGRESS%"
    sleep 1
done

echo ""
echo "4️⃣ Testing cancel endpoint..."
echo ""

# Cancel job
CANCEL_RESPONSE=$(curl -s -X POST http://localhost:3001/api/cancel/$JOB_ID)
echo "Cancel response: $CANCEL_RESPONSE"
echo ""

# Verify cancellation
FINAL_STATUS=$(curl -s http://localhost:3001/api/status/$JOB_ID)
FINAL_STAGE=$(echo $FINAL_STATUS | grep -o '"stage":"[^"]*' | cut -d'"' -f4)

if [ "$FINAL_STAGE" = "failed" ]; then
    echo "✅ Job successfully cancelled"
else
    echo "⚠️  Job stage: $FINAL_STAGE"
fi

echo ""
echo "✅ All tests completed!"
echo ""
echo "📝 Notes:"
echo "   - To test SSE streaming: Use a browser or SSE client"
echo "   - Visit: http://localhost:3001/api/status/$JOB_ID/stream"
echo "   - Full frontend testing: npm run dev"
echo ""

