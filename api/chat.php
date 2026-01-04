<?php
// chat.php - Chat handling and Gemini API for Eshika Smart Bot
require_once 'config.php';

$input = json_decode(file_get_contents('php://input'), true);

if (!$input) {
    sendResponse(['error' => 'No input provided'], 400);
}

$message = $input['message'] ?? '';
$email = strtolower($input['email'] ?? '');
$chatId = $input['chatId'] ?? null;
$language = $input['language'] ?? 'en-US';
$image = $input['image'] ?? null;

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

// Find or create chat
$action = $_GET['action'] ?? '';
$currentChat = null;

if ($chatId) {
    foreach ($users[$userIndex]['chats'] as &$chat) {
        if ($chat['id'] == $chatId) {
            $currentChat = &$chat;
            break;
        }
    }
}

if ($action === 'load') {
    if (!$currentChat) {
        sendResponse(['error' => 'Chat not found'], 404);
    }
    sendResponse(['chat' => $currentChat]);
}

// Proceed with message sending if no action or action is empty
if (!$currentChat) {
    $chatId = time() . rand(100, 999);
    $newChat = [
        'id' => $chatId,
        'title' => substr($message, 0, 30),
        'messages' => [],
        'pinned' => false,
        'timestamp' => time() * 1000
    ];
    $users[$userIndex]['chats'][] = $newChat;
    $currentChat = &$users[$userIndex]['chats'][count($users[$userIndex]['chats']) - 1];
}

// Add user message
$currentChat['messages'][] = ['role' => 'user', 'content' => $message];

// Gemini API Call
$modelId = "gemini-flash-latest";
$url = "https://generativelanguage.googleapis.com/v1beta/models/{$modelId}:generateContent?key=" . GEMINI_API_KEY;

$systemPrompt = "You are Eshika Smart Bot AI 🤖. Created by N. Rishi Kumar son of N. Chiranjeevi.\nFounder/Chairman: Raghu Varma.\n\nYOUR IDENTITY (ONLY mention if asked \"who are you\"):\n\"I am Eshika chatbot AI created by N. Rishi Kumar son of N. Chiranjeevi.\"\n\nGUIDELINES:\n- BE CONCISE. Do NOT repeat your full intro in every message.\n- Use emojis 🌟.\n- Analyze images if provided.\n- Reply in {$language}.";

$parts = [['text' => $systemPrompt . "\n\nUser: " . $message]];

if ($image && isset($image['data']) && isset($image['mime'])) {
    $parts[] = [
        'inline_data' => [
            'mime_type' => $image['mime'],
            'data' => $image['data']
        ]
    ];
}

$payload = [
    'contents' => [
        ['role' => 'user', 'parts' => $parts]
    ]
];

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

$data = json_decode($response, true);

if (isset($data['error'])) {
    $errorCode = $data['error']['code'] ?? 500;
    $errorMsg = $data['error']['message'] ?? 'Unknown error';
    
    $reply = "I am having trouble connecting to my brain right now.";
    if ($errorCode == 429) {
        $reply = "I'm a bit overwhelmed right now (Quota Exceeded). Please try again in a minute or two! 😅";
    } elseif (strpos(strtolower($errorMsg), 'api key') !== false) {
        $reply = "There's an issue with my API key connection. Please check the configuration. 🔑";
    } else {
        $reply = "Brain Error ({$errorCode}): {$errorMsg} 🧩";
    }
    sendResponse(['reply' => $reply], $errorCode);
}

$reply = $data['candidates'][0]['content']['parts'][0]['text'] ?? "I couldn't generate a response.";

// Add bot message and save
$currentChat['messages'][] = ['role' => 'bot', 'content' => $reply];
saveUsers($users);

sendResponse([
    'reply' => $reply,
    'chatId' => $currentChat['id'],
    'title' => $currentChat['title']
]);
?>
