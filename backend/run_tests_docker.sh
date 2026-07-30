#!/bin/bash

# DocuMate Backend Test Runner (Docker Version)
# Uses Docker PostgreSQL for isolated testing

set -e

echo "🧪 DocuMate Backend Test Runner (Docker)"
echo "========================================"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Step 1: Check Docker
echo "🐳 Step 1: Checking Docker..."
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running${NC}"
    echo "Please start Docker Desktop first"
    exit 1
fi
echo -e "${GREEN}✓ Docker is running${NC}"
echo ""

# Step 2: Start test database
echo "🗄️  Step 2: Starting test database..."
cd "$(dirname "$0")/.."  # Go to project root
docker-compose -f docker-compose.test.yml up -d
echo "Waiting for PostgreSQL to be ready..."
sleep 3
echo -e "${GREEN}✓ Test database is ready${NC}"
echo ""

# Step 3: Activate venv and run tests
echo "🧪 Step 3: Running tests..."
cd backend
source venv/bin/activate

# Set environment for Docker database (port 5433)
export DATABASE_URL="postgresql+asyncpg://postgres:postgres@localhost:5433/documate_test"
export JWT_SECRET_KEY="test-secret-key"
export JWT_ALGORITHM="HS256"
export JWT_ACCESS_TOKEN_EXPIRE_MINUTES="30"
export PINECONE_API_KEY="mock-key"
export PINECONE_INDEX_NAME="test-index"
export GEMINI_API_KEY="mock-key"

echo ""
# Run tests
pytest ${@:--v --tb=short}
TEST_EXIT_CODE=$?

echo ""
echo "========================================"

if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed!${NC}"
else
    echo -e "${RED}❌ Some tests failed${NC}"
fi

echo ""
echo "🧹 Cleanup:"
echo "   Keep DB running: (for faster re-runs)"
echo "   Stop DB:         docker-compose -f docker-compose.test.yml down"
echo "   Clean DB:        docker-compose -f docker-compose.test.yml down -v"
echo ""

exit $TEST_EXIT_CODE
