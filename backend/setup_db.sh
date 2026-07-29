#!/bin/bash

# Database setup script for DocuMate

echo "======================================"
echo "DocuMate Database Setup"
echo "======================================"

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo "PostgreSQL is not installed. Installing via Homebrew..."
    if ! command -v brew &> /dev/null; then
        echo "Error: Homebrew is not installed. Please install Homebrew first:"
        echo "  /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
        exit 1
    fi

    brew install postgresql@16
    brew services start postgresql@16

    # Wait for PostgreSQL to start
    echo "Waiting for PostgreSQL to start..."
    sleep 3
else
    echo "PostgreSQL is already installed."
fi

# Create database
echo "Creating 'documate' database..."
createdb documate 2>/dev/null && echo "Database created successfully!" || echo "Database may already exist or there was an error."

# Run migrations
echo "Running database migrations..."
source venv/bin/activate
alembic upgrade head

echo ""
echo "======================================"
echo "Database setup complete!"
echo "======================================"
echo ""
echo "You can now start the backend server with:"
echo "  source venv/bin/activate && uvicorn main:app --reload"
