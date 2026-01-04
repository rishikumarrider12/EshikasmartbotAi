<?php
// history.php - Chat history management for Eshika Smart Bot
require_once 'config.php';

$input = json_decode(file_get_contents('php://input'), true);
$action = $_GET['action'] ?? '';

if (!$input) {
    sendResponse(['error' => 'No input provided'], 400);
}

$email = strtolower($input['email'] ?? '');
$chatId = $input['chatId'] ?? null;

$users = loadUsers();
$userIndex = -1;
foreach ($users as $idx => $user) {
    if ($user['email'] === $email) {
        $userIndex = $idx;
        break;
    }
}

if ($userIndex === -1) {
    sendResponse(['error' => 'User not found'], 404);
}

if ($action === 'rename') {
    $newTitle = $input['newTitle'] ?? 'Untitled Chat';
    foreach ($users[$userIndex]['chats'] as &$chat) {
        if ($chat['id'] == $chatId) {
            $chat['title'] = $newTitle;
            break;
        }
    }
    saveUsers($users);
    sendResponse(['success' => true]);

} elseif ($action === 'delete') {
    $users[$userIndex]['chats'] = array_filter($users[$userIndex]['chats'], function($chat) use ($chatId) {
        return $chat['id'] != $chatId;
    });
    $users[$userIndex]['chats'] = array_values($users[$userIndex]['chats']); // Re-index
    saveUsers($users);
    sendResponse(['success' => true]);

} elseif ($action === 'pin') {
    foreach ($users[$userIndex]['chats'] as &$chat) {
        if ($chat['id'] == $chatId) {
            $chat['isPinned'] = !($chat['isPinned'] ?? false);
            break;
        }
    }
    saveUsers($users);
    sendResponse(['success' => true]);

} elseif ($action === 'list') {
    sendResponse(['history' => $users[$userIndex]['chats']]);
}

sendResponse(['error' => 'Invalid action'], 400);
?>
