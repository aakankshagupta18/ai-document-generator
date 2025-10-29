#!/bin/bash

echo "🚀 Starting Document Generator with Load Balancer"
echo "=================================================="
echo ""

# Check if Docker is running
if ! docker ps > /dev/null 2>&1; then
    echo "❌ Docker is not running!"
    echo "   Please start Docker Desktop and try again."
    exit 1
fi

echo "✅ Docker is running"
echo ""

# Stop any existing containers
echo "🧹 Cleaning up old containers..."
docker-compose -f docker-compose-with-lb.yml down 2>/dev/null
docker-compose down 2>/dev/null
sleep 2

# Start services with load balancer
echo ""
echo "🚀 Starting services with load balancer..."
echo ""

docker-compose -f docker-compose-with-lb.yml up -d --build

# Wait for services
echo ""
echo "⏳ Waiting for services to start..."
sleep 10

# Check status
echo ""
echo "📊 Checking service status..."
echo ""

docker-compose -f docker-compose-with-lb.yml ps

echo ""
echo "🔍 Testing services..."
echo ""

# Test Redis
if docker exec docgen-redis redis-cli ping > /dev/null 2>&1; then
    echo "   ✅ Redis is healthy"
else
    echo "   ⚠️  Redis not responding"
fi

# Test Load Balancer
if curl -s http://localhost/health > /dev/null 2>&1; then
    echo "   ✅ Load Balancer is healthy (http://localhost/health)"
else
    echo "   ⚠️  Load Balancer not responding"
fi

# Test backend through load balancer
if curl -s http://localhost/api/health > /dev/null 2>&1; then
    echo "   ✅ Backend is reachable through load balancer"
    
    # Show which backend responded
    RESPONSE=$(curl -s http://localhost/api/health)
    INSTANCE=$(echo $RESPONSE | python3 -c "import json,sys; print(json.load(sys.stdin).get('instance', 'unknown'))" 2>/dev/null)
    echo "      Response from: $INSTANCE"
else
    echo "   ⚠️  Backend not reachable through load balancer"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  🎉 Services Started with Load Balancer!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📊 Service Status:"
echo "   Load Balancer:  http://localhost"
echo "   Backend API:    http://localhost/api/*"
echo "   Redis:          localhost:6379"
echo ""
echo "🏗️ Architecture:"
echo "   Request → Nginx (port 80) → Backend 1, 2, or 3"
echo "              ↓"
echo "            Redis (shared state)"
echo ""
echo "🔍 Useful Commands:"
echo "   View logs:         docker-compose -f docker-compose-with-lb.yml logs -f"
echo "   View LB logs:      docker logs docgen-loadbalancer -f"
echo "   Check status:      docker-compose -f docker-compose-with-lb.yml ps"
echo "   Stop all:          docker-compose -f docker-compose-with-lb.yml down"
echo "   Restart:           docker-compose -f docker-compose-with-lb.yml restart"
echo ""
echo "🧪 Test Load Balancing:"
echo "   ./test-loadbalancer.sh"
echo ""
echo "🎨 Start Frontend:"
echo "   # Option 1: Use load balancer (recommended)"
echo "   cp vite.config.loadbalancer.ts vite.config.ts"
echo "   npm run dev"
echo ""
echo "   # Option 2: Or just run (uses existing config)"
echo "   npm run dev"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

