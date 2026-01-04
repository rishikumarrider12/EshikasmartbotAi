<?php
// config.php - Configuration for Eshika Smart Bot API

// Gemini API Key
define('GEMINI_API_KEY', 'AIzaSyDowf0vv1a-qeupHI3NktctyphZ-VqiR1E');

// Data paths
define('USERS_FILE', __DIR__ . '/../data/users.json');

// Error reporting (disable in production)
error_reporting(E_ALL);
ini_set('display_errors', 1);

// Shared logic: Load users
function loadUsers() {
    if (!file_exists(USERS_FILE)) {
        return [];
    }
    $json = file_get_contents(USERS_FILE);
    return json_decode($json, true) ?: [];
}

// Shared logic: Save users
function saveUsers($users) {
    file_put_contents(USERS_FILE, json_encode($users, JSON_PRETTY_PRINT));
}

// Shared logic: Send JSON response
function sendResponse($data, $statusCode = 200) {
    header('Content-Type: application/json');
    http_response_code($statusCode);
    echo json_encode($data);
    exit;
}
?>
