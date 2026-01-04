<?php
// auth.php - Authentication for Eshika Smart Bot
require_once 'config.php';

$input = json_decode(file_get_contents('php://input'), true);
$action = $_GET['action'] ?? '';

if (!$input && $action !== 'check') {
    sendResponse(['error' => 'No input provided'], 400);
}

$users = loadUsers();

if ($action === 'login') {
    $email = strtolower($input['email']);
    $password = $input['password'];

    foreach ($users as $user) {
        if ($user['email'] === $email && $user['password'] === $password) {
            unset($user['password']);
            sendResponse(['success' => true, 'user' => $user]);
        }
    }
    sendResponse(['error' => 'Invalid email or password'], 401);

} elseif ($action === 'signup') {
    $username = $input['username'];
    $email = strtolower($input['email']);
    $password = $input['password'];

    foreach ($users as $user) {
        if ($user['email'] === $email) {
            sendResponse(['error' => 'Email already registered'], 400);
        }
    }

    $newUser = [
        'username' => $username,
        'email' => $email,
        'password' => $password,
        'chats' => []
    ];

    $users[] = $newUser;
    saveUsers($users);

    unset($newUser['password']);
    sendResponse(['success' => true, 'user' => $newUser]);

} elseif ($action === 'update') {
    $email = strtolower($input['email']);
    $newUsername = $input['newUsername'] ?? null;
    $oldPassword = $input['oldPassword'] ?? null;
    $newPassword = $input['newPassword'] ?? null;

    foreach ($users as &$user) {
        if ($user['email'] === $email) {
            if ($newUsername) $user['username'] = $newUsername;
            
            if ($oldPassword && $newPassword) {
                if ($user['password'] === $oldPassword) {
                    $user['password'] = $newPassword;
                } else {
                    sendResponse(['error' => 'Incorrect current password'], 401);
                }
            }
            saveUsers($users);
            unset($user['password']);
            sendResponse(['success' => true, 'user' => $user]);
        }
    }
    sendResponse(['error' => 'User not found'], 404);
}

sendResponse(['error' => 'Invalid action'], 400);
?>
