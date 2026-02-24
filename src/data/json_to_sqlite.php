#!/usr/bin/env php
<?php
/**
 * Convert Full Matchup Rankings JSON to SQLite Database
 * 
 * Usage: php json_to_sqlite.php <input.json> [output.db]
 * Example: php json_to_sqlite.php aurora-full-rankings-1500.json rankings-aurora-1500.db
 */

// CRITICAL: Increase memory limit for large JSON files
ini_set('memory_limit', '2G');
ini_set('max_execution_time', '600'); // 10 minutes

if ($argc < 2) {
    echo "Usage: php json_to_sqlite.php <input.json> [output.db]\n";
    echo "Example: php json_to_sqlite.php aurora-full-rankings-1500.json rankings-aurora-1500.db\n";
    exit(1);
}

$inputFile = $argv[1];
$outputFile = $argv[2] ?? null;

// Auto-generate output filename if not provided
if (!$outputFile) {
    $outputFile = basename($inputFile, '.json') . '.db';
    $outputFile = str_replace('-full-rankings-', '-', $outputFile);
    $outputFile = 'rankings-' . $outputFile;
}

echo "🔄 Converting JSON to SQLite...\n";
echo "📥 Input:  $inputFile\n";
echo "📤 Output: $outputFile\n\n";

// Check if input file exists
if (!file_exists($inputFile)) {
    echo "❌ Error: Input file not found: $inputFile\n";
    exit(1);
}

// Load JSON
echo "📖 Loading JSON... ";
$json = file_get_contents($inputFile);
$data = json_decode($json, true);

if (!$data) {
    echo "❌ Failed!\n";
    echo "Error: Invalid JSON or empty file\n";
    exit(1);
}

$pokemonCount = count($data);
echo "✅ Loaded {$pokemonCount} Pokemon\n";

// Delete existing DB
if (file_exists($outputFile)) {
    unlink($outputFile);
}

// Create SQLite database
echo "🗄️  Creating SQLite database... ";
try {
    $db = new PDO("sqlite:$outputFile");
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    echo "✅\n";
} catch (Exception $e) {
    echo "❌ Failed!\n";
    echo "Error: " . $e->getMessage() . "\n";
    exit(1);
}

// Create schema
echo "📋 Creating schema... ";
$db->exec("
    CREATE TABLE species_map (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        species_id TEXT NOT NULL UNIQUE
    );
    
    CREATE TABLE matchups (
        pokemon_id INTEGER NOT NULL,
        opponent_id INTEGER NOT NULL,
        rating INTEGER NOT NULL,
        op_rating INTEGER NOT NULL,
        PRIMARY KEY (pokemon_id, opponent_id)
    );
    
    CREATE INDEX idx_pokemon_rating ON matchups(pokemon_id, rating DESC);
    CREATE INDEX idx_opponent ON matchups(opponent_id, pokemon_id);
");
echo "✅\n";

// Begin transaction for better performance
$db->beginTransaction();

// Step 1: Build species map
echo "🗺️  Building species map... ";
$speciesMap = [];
$speciesId = 1;

foreach ($data as $pokemon) {
    $species = $pokemon['speciesId'];
    if (!isset($speciesMap[$species])) {
        $speciesMap[$species] = $speciesId++;
    }
}

// Insert into species_map table
$stmt = $db->prepare("INSERT INTO species_map (id, species_id) VALUES (?, ?)");
foreach ($speciesMap as $species => $id) {
    $stmt->execute([$id, $species]);
}
echo "✅ " . count($speciesMap) . " species\n";

// Step 2: Insert matchups
echo "⚔️  Inserting matchups... ";
$stmt = $db->prepare("INSERT INTO matchups (pokemon_id, opponent_id, rating, op_rating) VALUES (?, ?, ?, ?)");

$totalMatchups = 0;
$processedPokemon = 0;

foreach ($data as $pokemon) {
    $pokemonId = $speciesMap[$pokemon['speciesId']];
    
    // Check if allMatches exists
    if (!isset($pokemon['allMatches']) || !is_array($pokemon['allMatches'])) {
        continue;
    }
    
    foreach ($pokemon['allMatches'] as $match) {
        $opponentId = $speciesMap[$match['opponent']] ?? null;
        
        if ($opponentId === null) {
            echo "\n⚠️  Warning: Unknown opponent: {$match['opponent']}\n";
            continue;
        }
        
        $stmt->execute([
            $pokemonId,
            $opponentId,
            $match['rating'],
            $match['opRating']
        ]);
        
        $totalMatchups++;
    }
    
    $processedPokemon++;
    
    // Progress indicator
    if ($processedPokemon % 50 == 0) {
        $percent = round(($processedPokemon / $pokemonCount) * 100);
        echo "\r⚔️  Inserting matchups... {$percent}% ({$processedPokemon}/{$pokemonCount})";
    }
}

echo "\r⚔️  Inserting matchups... ✅ {$totalMatchups} total\n";

// Commit transaction
echo "💾 Committing transaction... ";
$db->commit();
echo "✅\n";

// Optimize database
echo "🗜️  Optimizing database... ";
$db->exec("VACUUM");
$db->exec("ANALYZE");
echo "✅\n";

// Get file sizes
$jsonSize = filesize($inputFile);
$dbSize = filesize($outputFile);
$compression = round((1 - ($dbSize / $jsonSize)) * 100, 1);

echo "\n📊 Statistics:\n";
echo "   Pokemon: {$pokemonCount}\n";
echo "   Matchups: {$totalMatchups}\n";
echo "   JSON size: " . formatBytes($jsonSize) . "\n";
echo "   DB size: " . formatBytes($dbSize) . "\n";
echo "   Compression: {$compression}%\n";

// Suggest next steps
echo "\n✅ Conversion complete!\n";
echo "\n📦 Next steps:\n";
echo "   1. Compress: gzip {$outputFile}\n";
echo "   2. Result: {$outputFile}.gz (~" . formatBytes($dbSize / 3) . ")\n";
echo "   3. Upload to GitHub Pages\n";

function formatBytes($bytes, $precision = 2) {
    $units = ['B', 'KB', 'MB', 'GB'];
    $bytes = max($bytes, 0);
    $pow = floor(($bytes ? log($bytes) : 0) / log(1024));
    $pow = min($pow, count($units) - 1);
    $bytes /= pow(1024, $pow);
    return round($bytes, $precision) . ' ' . $units[$pow];
}

