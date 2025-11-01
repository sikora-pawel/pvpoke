<?php
// Router for PHP built-in server
// This prevents PHP from trying to execute .js, .css, and other static files

$requestUri = $_SERVER['REQUEST_URI'];
$requestPath = parse_url($requestUri, PHP_URL_PATH);
$fileExtension = pathinfo($requestPath, PATHINFO_EXTENSION);

// Construct the file path
$filePath = __DIR__ . $requestPath;

// List of extensions that should be served as static files (not processed by PHP)
$staticExtensions = ['js', 'css', 'json', 'jpg', 'jpeg', 'png', 'gif', 'svg', 'ico', 'woff', 'woff2', 'ttf', 'eot', 'map'];

// If it's a static file and it exists, serve it directly
if (in_array($fileExtension, $staticExtensions)) {
    if (file_exists($filePath)) {
        // Return false to let PHP's built-in server serve the file
        return false;
    } else {
        // File doesn't exist, return 404
        http_response_code(404);
        echo "404 Not Found: " . htmlspecialchars($requestPath);
        return true;
    }
}

// For .php files or files without extension, let PHP handle them normally
// This includes index.php, rankerfull.php, etc.
if ($fileExtension === 'php' || $fileExtension === '') {
    if (file_exists($filePath)) {
        // Let PHP process it
        return false;
    } elseif (file_exists($filePath . '.php')) {
        // Try with .php extension
        require $filePath . '.php';
        return true;
    } else {
        // File doesn't exist
        http_response_code(404);
        echo "404 Not Found: " . htmlspecialchars($requestPath);
        return true;
    }
}

// For any other case, try to serve the file
return false;
?>

