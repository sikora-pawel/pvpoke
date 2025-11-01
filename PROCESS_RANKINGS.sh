#!/bin/bash
# Process downloaded full matchup rankings
# Converts JSON to SQLite and compresses for deployment

set -e

echo "🔄 Full Matchup Rankings Processor"
echo "=================================="
echo ""

# Check if file provided
if [ -z "$1" ]; then
    echo "Usage: ./PROCESS_RANKINGS.sh <json-file>"
    echo ""
    echo "Example:"
    echo "  ./PROCESS_RANKINGS.sh ~/Downloads/aurora-full-rankings-1500.json"
    echo ""
    exit 1
fi

INPUT_FILE="$1"
BASENAME=$(basename "$INPUT_FILE" .json)

# Extract cup name and CP from filename
# aurora-full-rankings-1500.json → aurora, 1500
CUP=$(echo "$BASENAME" | sed 's/-full-rankings-[0-9]*//')
CP=$(echo "$BASENAME" | grep -o '[0-9]*' | tail -1)

echo "📥 Input file: $INPUT_FILE"
echo "🏆 Cup: $CUP"
echo "💪 CP: $CP"
echo ""

# Check if file exists
if [ ! -f "$INPUT_FILE" ]; then
    echo "❌ Error: File not found: $INPUT_FILE"
    exit 1
fi

# Create output directory
OUTPUT_DIR="src/data/rankings/$CUP/full"
mkdir -p "$OUTPUT_DIR"

echo "📁 Output directory: $OUTPUT_DIR"
echo ""

# Step 1: Move JSON to correct location
JSON_OUTPUT="$OUTPUT_DIR/rankings-$CP.json"
echo "1️⃣  Moving JSON..."
cp "$INPUT_FILE" "$JSON_OUTPUT"
echo "   ✅ $JSON_OUTPUT"
echo ""

# Step 2: Convert to SQLite
echo "2️⃣  Converting to SQLite..."
DB_OUTPUT="$OUTPUT_DIR/rankings-$CP.db"
php src/data/json_to_sqlite.php "$JSON_OUTPUT" "$DB_OUTPUT"
echo ""

# Step 3: Compress SQLite
echo "3️⃣  Compressing SQLite..."
gzip -f -k "$DB_OUTPUT"  # -f = force overwrite, -k = keep original
echo "   ✅ $DB_OUTPUT.gz"
echo ""

# Step 4: Show file sizes
JSON_SIZE=$(du -h "$JSON_OUTPUT" | cut -f1)
DB_SIZE=$(du -h "$DB_OUTPUT" | cut -f1)
GZ_SIZE=$(du -h "$DB_OUTPUT.gz" | cut -f1)

echo "📊 Results:"
echo "   JSON:       $JSON_SIZE  (for debugging)"
echo "   SQLite:     $DB_SIZE  (uncompressed)"
echo "   SQLite.gz:  $GZ_SIZE  (for deployment) ⭐"
echo ""

echo "✅ Processing complete!"
echo ""
echo "📦 Files ready for deployment:"
echo "   - $OUTPUT_DIR/rankings-$CP.db.gz"
echo ""
echo "💡 Next steps:"
echo "   1. git add $OUTPUT_DIR/"
echo "   2. git commit -m \"Add full matchup rankings for $CUP ($CP CP)\""
echo "   3. git push origin master"
echo ""
echo "🚀 After deployment, iOS will fetch:"
echo "   https://sikora-pawel.github.io/pvpoke/rankings/$CUP/full/rankings-$CP.db.gz"
echo ""

