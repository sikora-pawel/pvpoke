<?php
/**
 * Convert rankings JSON to SQLite (called via AJAX)
 * 
 * POST params:
 *   cup: string - cup name
 *   league: int - CP limit
 */

header('Content-Type: application/json');

$cup = $_POST['cup'] ?? null;
$league = $_POST['league'] ?? null;

if (!$cup || !$league) {
    echo json_encode(['success' => false, 'error' => 'Missing cup or league', 'debug' => $_POST]);
    exit;
}

$jsonFile = __DIR__ . "/rankings/$cup/full/rankings-$league.json";
$dbFile = __DIR__ . "/rankings/$cup/full/rankings-$league.db";

if (!file_exists($jsonFile)) {
    echo json_encode([
        'success' => false, 
        'error' => "JSON file not found", 
        'jsonFile' => $jsonFile,
        'cwd' => getcwd(),
        'dir' => __DIR__
    ]);
    exit;
}

// Wait a moment for file to be fully written
sleep(1);

// Execute conversion script with custom php.ini for memory limits
$scriptPath = __DIR__ . '/json_to_sqlite.php';
$phpIniPath = __DIR__ . '/../php.ini';

// Use -c to specify php.ini location (for memory_limit = 2G)
$command = "php -c " . escapeshellarg($phpIniPath) . " " . escapeshellarg($scriptPath) . " " . escapeshellarg($jsonFile) . " " . escapeshellarg($dbFile) . " 2>&1";

exec($command, $output, $returnCode);

if ($returnCode === 0) {
    // Compress
    $gzCommand = "gzip -f -k " . escapeshellarg($dbFile) . " 2>&1";
    exec($gzCommand, $gzOutput, $gzReturnCode);
    
    $dbSize = file_exists($dbFile) ? filesize($dbFile) : 0;
    $gzSize = file_exists($dbFile . '.gz') ? filesize($dbFile . '.gz') : 0;
    
    echo json_encode([
        'success' => true,
        'dbFile' => "$cup/full/rankings-$league.db",
        'gzFile' => "$cup/full/rankings-$league.db.gz",
        'dbSize' => round($dbSize / 1024, 2) . ' KB',
        'gzSize' => round($gzSize / 1024, 2) . ' KB',
        'output' => $output,
        'debug' => [
            'jsonFile' => $jsonFile,
            'dbFile' => $dbFile,
            'command' => $command
        ]
    ]);
} else {
    echo json_encode([
        'success' => false,
        'error' => 'Conversion failed',
        'returnCode' => $returnCode,
        'output' => $output,
        'command' => $command,
        'jsonFile' => $jsonFile,
        'dbFile' => $dbFile
    ]);
}

