#!/bin/bash

# Safespace Application Startup Script

echo "🛡️  Starting Safespace - Family Communication Safety Platform"
echo "=================================================="

# Check if requirements are installed
if ! python -c "import fastapi, anthropic, uvicorn" 2>/dev/null; then
    echo "Installing dependencies..."
    pip install -r requirements.txt
fi

# Create necessary directories
mkdir -p uploaded_files Client_Databases certificates

echo "Starting server on http://localhost:8000"
echo "Press Ctrl+C to stop the server"
echo "=================================================="

# Start the server
python server.py