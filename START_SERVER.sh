#!/bin/bash
# Start pvpoke development server with proper routing and custom PHP config

cd "$(dirname "$0")/src"
echo "🚀 Starting pvpoke development server on http://localhost:8000"
echo "📁 Serving from: $(pwd)"
echo "⚙️  Using custom PHP config (256MB POST limit)"
echo ""
echo "Press Ctrl+C to stop"
echo ""

php -S localhost:8000 -c php.ini router.php

