#!/bin/bash

# DocuMate Backend Test Runner
# Automates test database setup and test execution

set -e  # Exit on error

echo "🧪 DocuMate Backend Test Runner"
echo "================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
TEST_DB_NAME="documate_test"
TEST_DB_USER="${POSTGRES_USER:-$USER}"
VENV_PATH="venv"

# Step 1: Check if virtual environment exists
echo "📦 Step 1: Checking virtual environment..."
if [ ! -d "$VENV_PATH" ]; then
    echo -e "${RED}❌ Virtual environment not found at $VENV_PATH${NC}"
    echo "Please run: python3 -m venv venv"
    exit 1
fi
echo -e "${GREEN}✓ Virtual environment found${NC}"
echo ""

# Step 2: Activate virtual environment and check dependencies
echo "📦 Step 2: Activating virtual environment..."
source "$VENV_PATH/bin/activate"
echo -e "${GREEN}✓ Virtual environment activated${NC}"
echo ""

# Step 3: Check if pytest is installed
echo "📦 Step 3: Checking test dependencies..."
if ! python -c "import pytest" 2>/dev/null; then
    echo -e "${YELLOW}⚠️  Test dependencies not found. Installing...${NC}"
    pip install -r requirements-dev.txt
fi
echo -e "${GREEN}✓ Test dependencies available${NC}"
echo ""

# Step 4: Check PostgreSQL
echo "🐘 Step 4: Checking PostgreSQL..."
if ! pg_isready -q 2>/dev/null; then
    echo -e "${RED}❌ PostgreSQL is not running${NC}"
    echo ""
    echo "Please start PostgreSQL first:"
    echo "  • macOS (Homebrew): brew services start postgresql@16"
    echo "  • Linux (systemd): sudo systemctl start postgresql"
    echo "  • Docker: docker-compose up postgres"
    echo ""
    echo "Or run with Docker:"
    echo "  docker-compose -f docker-compose.test.yml up -d"
    exit 1
fi
echo -e "${GREEN}✓ PostgreSQL is running${NC}"
echo ""

# Step 5: Create test database
echo "🗄️  Step 5: Setting up test database..."
if psql -lqt | cut -d \| -f 1 | grep -qw "$TEST_DB_NAME"; then
    echo -e "${YELLOW}⚠️  Database '$TEST_DB_NAME' already exists${NC}"
    read -p "Drop and recreate it? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Dropping existing database..."
        dropdb "$TEST_DB_NAME" 2>/dev/null || true
        createdb "$TEST_DB_NAME"
        echo -e "${GREEN}✓ Test database recreated${NC}"
    else
        echo -e "${GREEN}✓ Using existing test database${NC}"
    fi
else
    echo "Creating test database..."
    createdb "$TEST_DB_NAME"
    echo -e "${GREEN}✓ Test database created${NC}"
fi
echo ""

# Step 6: Set environment variables for tests
echo "🔧 Step 6: Configuring test environment..."
export DATABASE_URL="postgresql+asyncpg://${TEST_DB_USER}@localhost:5432/${TEST_DB_NAME}"
export JWT_SECRET_KEY="test-secret-key-for-testing-only"
export JWT_ALGORITHM="HS256"
export JWT_ACCESS_TOKEN_EXPIRE_MINUTES="30"
export PINECONE_API_KEY="mock-pinecone-key"
export PINECONE_INDEX_NAME="test-index"
export GEMINI_API_KEY="mock-gemini-key"
echo -e "${GREEN}✓ Environment configured${NC}"
echo ""

# Step 7: Run tests
echo "🧪 Step 7: Running tests..."
echo "================================"
echo ""

# Parse command line arguments
TEST_ARGS="$@"
if [ -z "$TEST_ARGS" ]; then
    # Default: run all tests with coverage
    TEST_ARGS="-v --tb=short"
fi

# Run pytest
pytest $TEST_ARGS

# Capture exit code
TEST_EXIT_CODE=$?

echo ""
echo "================================"

# Step 8: Show results
if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed!${NC}"
    echo ""
    echo "📊 Coverage report generated at: htmlcov/index.html"
    echo "   Open it with: open htmlcov/index.html"
else
    echo -e "${RED}❌ Some tests failed (exit code: $TEST_EXIT_CODE)${NC}"
    echo ""
    echo "💡 Tips:"
    echo "   • Check the output above for specific failures"
    echo "   • Run specific tests: ./run_tests.sh tests/test_auth.py"
    echo "   • Run with more detail: ./run_tests.sh -vv"
fi

echo ""
echo "📝 Quick test commands:"
echo "   All tests:           ./run_tests.sh"
echo "   Specific file:       ./run_tests.sh tests/test_auth.py"
echo "   Unit tests only:     ./run_tests.sh -m unit"
echo "   With coverage:       ./run_tests.sh --cov --cov-report=html"
echo "   Stop on first fail:  ./run_tests.sh -x"
echo ""

exit $TEST_EXIT_CODE
