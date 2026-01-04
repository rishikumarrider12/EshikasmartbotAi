
const loginOverlay = document.getElementById('login-overlay');
const appContainer = document.getElementById('app-container');
const messageInput = document.getElementById('message-input');
const messagesContainer = document.getElementById('messages-container');
const welcomeScreen = document.getElementById('welcome-screen');
const historyList = document.getElementById('history-list');
const sendBtn = document.getElementById('send-btn');
const authError = document.getElementById('auth-error');
const micBtn = document.getElementById('mic-btn');
const langSelect = document.getElementById('language-select');
const settingsModal = document.getElementById('settings-modal');
const proBadge = document.querySelector('.pro-badge');

let currentUser = null;
let currentChatId = null;
let recognition = null;
let isRecording = false;
let selectedImage = null; // Store base64 image data

// Auto-resize textarea
messageInput.addEventListener('input', function () {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
    sendBtn.classList.toggle('active', this.value.trim().length > 0);
});

messageInput.addEventListener('keypress', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

// Speech Recognition
function setupSpeechRecognition() {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;

        recognition.onstart = () => {
            isRecording = true;
            micBtn.classList.add('listening');
            micBtn.innerHTML = '<span class="material-symbols-outlined">stop</span>';
        };

        recognition.onend = () => {
            isRecording = false;
            micBtn.classList.remove('listening');
            micBtn.innerHTML = '<span class="material-symbols-outlined">mic</span>';
        };

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            messageInput.value += transcript + " ";
            setInput(messageInput.value.trim());
        };

        micBtn.addEventListener('click', () => {
            if (!currentUser) return;
            if (isRecording) {
                recognition.stop();
            } else {
                recognition.lang = langSelect.value;
                recognition.start();
            }
        });
    } else {
        micBtn.style.display = 'none';
    }
}

// Session Management
window.addEventListener('load', () => {
    setupSpeechRecognition();
    const savedUser = localStorage.getItem('eshika_user');
    if (savedUser) {
        try {
            currentUser = JSON.parse(savedUser);
            showApp();
        } catch (e) {
            console.error("Failed to parse saved user data:", e);
            showLogin();
        }
    } else {
        showLogin();
    }
});

function showApp() {
    loginOverlay.classList.add('hidden');
    appContainer.classList.remove('hidden');
    updateUserProfile();
    loadHistory();
}

function showLogin() {
    loginOverlay.classList.remove('hidden');
    appContainer.classList.add('hidden');
}

// Authentication
async function handleAuth(type) {
    const username = document.getElementById('username-input').value;
    const email = document.getElementById('email-input').value;
    const password = document.getElementById('password-input').value;
    authError.textContent = '';

    const endpoint = `/api/${type}`;
    const body = type === 'login' ? { email, password } : { username, email, password };

    try {
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const data = await res.json();

        if (data.success) {
            currentUser = data.user;
            localStorage.setItem('eshika_user', JSON.stringify(currentUser));
            showApp();
        } else {
            authError.textContent = data.error || 'Authentication failed.';
        }
    } catch (err) {
        authError.textContent = 'Server connection error.';
    }
}

function logout() {
    currentUser = null;
    currentChatId = null;
    localStorage.removeItem('eshika_user');
    showLogin();
    historyList.innerHTML = '';
    messagesContainer.innerHTML = '';
}

function updateUserProfile() {
    if (!currentUser) return;
    const displayName = document.getElementById('display-name');
    const displayEmail = document.getElementById('display-email');
    const userAvatar = document.getElementById('user-avatar');
    const welcomeUser = document.getElementById('welcome-user');

    displayName.textContent = currentUser.username || "User";
    displayEmail.textContent = currentUser.email;
    userAvatar.textContent = (currentUser.username || "U")[0].toUpperCase();
    welcomeUser.textContent = currentUser.username || "Human";

    // For now, show pro badge for all logged in users
    proBadge.style.display = 'inline';
}

// History
async function loadHistory() {
    historyList.innerHTML = '';
    if (!currentUser) return;

    try {
        const res = await fetch('/api/history', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: currentUser.email })
        });
        const data = await res.json();
        if (data.history) {
            data.history
                .sort((a, b) => (b.isPinned || 0) - (a.isPinned || 0))
                .forEach(item => addToHistoryUI(item));
        }
    } catch (err) {
        console.error("Failed to load history:", err);
    }
}

function addToHistoryUI({ title, id, isPinned }) {
    const item = document.createElement('div');
    item.className = `sidebar-item ${isPinned ? 'pinned' : ''}`;
    item.innerHTML = `
        <div class="history-title" onclick="loadChat('${id}')">
            <span class="material-symbols-outlined">${isPinned ? 'push_pin' : 'chat_bubble_outline'}</span>
            <span>${title}</span>
        </div>
        <div class="chat-actions">
            <button class="action-btn" title="${isPinned ? "Unpin" : "Pin"}" onclick="togglePin('${id}', ${isPinned})">
                <span class="material-symbols-outlined">${isPinned ? 'do_not_disturb_on' : 'push_pin'}</span>
            </button>
            <button class="action-btn" title="Rename" onclick="renameChat('${id}')">
                <span class="material-symbols-outlined">edit</span>
            </button>
            <button class="action-btn delete" title="Delete" onclick="deleteChat('${id}')">
                <span class="material-symbols-outlined">delete</span>
            </button>
        </div>
    `;
    historyList.appendChild(item);
}


async function togglePin(chatId, currentStatus) {
    try {
        await fetch('/api/chat/pin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: currentUser.email, chatId, isPinned: !currentStatus })
        });
        loadHistory();
    } catch (e) { console.error("Failed to toggle pin:", e); }
}

async function deleteChat(chatId) {
    if (!confirm("Are you sure you want to delete this chat?")) return;
    try {
        await fetch('/api/chat/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: currentUser.email, chatId })
        });
        if (currentChatId === chatId) startNewChat();
        loadHistory();
    } catch (e) { console.error("Failed to delete chat:", e); }
}

async function renameChat(chatId) {
    const newName = prompt("Enter new name for this chat:");
    if (!newName || newName.trim() === '') return;
    try {
        await fetch('/api/chat/rename', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: currentUser.email, chatId, newTitle: newName.trim() })
        });
        loadHistory();
    } catch (e) { console.error("Failed to rename chat:", e); }
}

async function loadChat(chatId) {
    try {
        const res = await fetch('/api/chat/load', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: currentUser.email, chatId })
        });
        const data = await res.json();

        if (data.chat) {
            currentChatId = data.chat.id;
            welcomeScreen.classList.add('hidden');
            messagesContainer.classList.remove('hidden');
            messagesContainer.innerHTML = '';
            data.chat.messages.forEach(msg => addMessage(msg.content, msg.role));
            scrollToBottom();
            sidebar.classList.remove('open');
        }
    } catch (err) {
        console.error("Error loading chat:", err);
    }
}


// Settings
function toggleSettings() {
    settingsModal.classList.toggle('hidden');
    document.getElementById('settings-msg').textContent = '';
    // Clear form fields when opening
    if (!settingsModal.classList.contains('hidden')) {
        document.getElementById('new-username').value = '';
        document.getElementById('old-password').value = '';
        document.getElementById('new-password').value = '';
    }
}

async function updateAccount() {
    const newUsername = document.getElementById('new-username').value;
    const oldPassword = document.getElementById('old-password').value;
    const newPassword = document.getElementById('new-password').value;
    const msg = document.getElementById('settings-msg');

    if (!oldPassword) {
        msg.textContent = "Current password is required to make changes.";
        return;
    }

    try {
        const res = await fetch('/api/account/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: currentUser.email, oldPassword, newUsername, newPassword })
        });
        const data = await res.json();
        if (data.success) {
            msg.style.color = 'lightgreen';
            msg.textContent = "Account updated successfully!";
            if (newUsername) {
                currentUser.username = newUsername;
                localStorage.setItem('eshika_user', JSON.stringify(currentUser));
                updateUserProfile();
            }
            setTimeout(toggleSettings, 1500);
        } else {
            msg.style.color = '#ff8b8b';
            msg.textContent = data.error;
        }
    } catch (err) {
        msg.textContent = "Server error during account update.";
    }
}

// Add Logout button to settings modal if not present
const modalContent = document.querySelector('.modal-content');
if (!document.getElementById('logout-btn')) {
    const logoutBtn = document.createElement('button');
    logoutBtn.id = 'logout-btn';
    logoutBtn.textContent = 'Log Out';
    logoutBtn.style.marginTop = '1rem';
    logoutBtn.style.background = '#d9534f';
    logoutBtn.style.color = 'white';
    logoutBtn.onclick = logout;
    modalContent.appendChild(logoutBtn);
}


// Chat
function setInput(text) {
    messageInput.value = text;
    messageInput.focus();
    messageInput.dispatchEvent(new Event('input'));
}

function startNewChat() {
    currentChatId = null;
    welcomeScreen.classList.remove('hidden');
    messagesContainer.classList.add('hidden');
    messagesContainer.innerHTML = '';
    setInput('');
}

function toggleSidebar() {
    sidebar.classList.toggle('collapsed');
}

// Image Handling
function handleImageSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        selectedImage = {
            data: e.target.result.split(',')[1],
            mime: file.type
        };
        showImagePreview(e.target.result);
    };
    reader.readAsDataURL(file);
}

function showImagePreview(src) {
    const container = document.getElementById('image-preview-container');
    const img = document.getElementById('image-preview');
    img.src = src;
    container.classList.remove('hidden');
}

function removeImage() {
    selectedImage = null;
    document.getElementById('image-input').value = '';
    document.getElementById('image-preview-container').classList.add('hidden');
}





// Text-to-Speech
let ttsEnabled = false;
const speakerBtn = document.getElementById('speaker-btn');
let voices = [];

function loadVoices() {
    voices = window.speechSynthesis.getVoices();
}
window.speechSynthesis.onvoiceschanged = loadVoices;

speakerBtn.addEventListener('click', () => {
    ttsEnabled = !ttsEnabled;
    speakerBtn.innerHTML = `<span class="material-symbols-outlined">${ttsEnabled ? 'volume_up' : 'volume_off'}</span>`;
    if (!ttsEnabled) window.speechSynthesis.cancel();
});

function speak(text) {
    if (!ttsEnabled || !text) return;
    const cleanText = text.replace(/[*#_`]/g, '').replace(/<[^>]*>/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = langSelect.value;
    const matchingVoice = voices.find(v => v.lang.startsWith(utterance.lang));
    if (matchingVoice) utterance.voice = matchingVoice;
    window.speechSynthesis.speak(utterance);
}


async function sendMessage() {
    const text = messageInput.value.trim();
    if (!text || !currentUser) return;

    setInput('');
    welcomeScreen.classList.add('hidden');
    messagesContainer.classList.remove('hidden');
    addMessage(text, 'user');
    const loadingId = addThinkingBubble();

    try {
        const res = await fetch('/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: text,
                email: currentUser.email,
                chatId: currentChatId,
                language: langSelect.value,
                image: selectedImage // Add image data
            })
        });

        if (selectedImage) removeImage(); // Clear after sending


        const data = await res.json();
        const loadingMsg = document.getElementById(loadingId);
        if (loadingMsg) loadingMsg.remove();

        if (res.status !== 200) throw new Error(data.reply || "Server error");

        addMessage(data.reply, 'bot');
        speak(data.reply);

        if (!currentChatId && data.chatId) {
            currentChatId = data.chatId;
            loadHistory();
        }

    } catch (err) {
        const loadingMsg = document.getElementById(loadingId);
        if (loadingMsg) loadingMsg.remove();
        addMessage(`Sorry, an error occurred: ${err.message}`, 'bot');
    }
}

function addMessage(text, sender) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${sender}`;

    const iconHtml = sender === 'bot'
        ? '<img src="/logo.png" class="bot-icon" alt="Bot">'
        : `<div class="avatar">${(currentUser.username || "U")[0].toUpperCase()}</div>`;

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.innerHTML = sender === 'bot' ? marked.parse(text) : text;

    msgDiv.innerHTML = iconHtml;
    msgDiv.appendChild(contentDiv);
    messagesContainer.appendChild(msgDiv);
    scrollToBottom();
}


function addThinkingBubble() {
    const id = 'loading-' + Date.now();
    const msgDiv = document.createElement('div');
    msgDiv.id = id;
    msgDiv.className = 'message bot';
    msgDiv.innerHTML = `
        <img src="/logo.png" class="bot-icon" alt="Bot">
        <div class="message-content">
            <div class="thinking-dots">
                <div class="dot"></div>
                <div class="dot"></div>
                <div class="dot"></div>
            </div>
        </div>
    `;
    messagesContainer.appendChild(msgDiv);
    scrollToBottom();
    return id;
}

function scrollToBottom() {
    const chatWindow = document.getElementById('chat-window');
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

// Sidebar Toggling
const sidebar = document.querySelector('.sidebar');
document.querySelector('.menu-btn').addEventListener('click', toggleSidebar);
document.querySelector('.menu-btn-mobile').addEventListener('click', () => {
    sidebar.classList.toggle('open');
});

