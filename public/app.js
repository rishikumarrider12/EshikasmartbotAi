
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

let currentUser = null;
let currentChatId = null;
let recognition = null;
let isRecording = false;

// Auto-resize textarea
messageInput.addEventListener('input', function () {
  this.style.height = 'auto';
  this.style.height = (this.scrollHeight) + 'px';
  if (this.value.trim().length > 0) {
    sendBtn.classList.add('active');
  } else {
    sendBtn.classList.remove('active');
  }
});

messageInput.addEventListener('keypress', function (e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

// Setup Speech Recognition
if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = 'en-US';

  recognition.onstart = function () {
    isRecording = true;
    micBtn.classList.add('listening');
    micBtn.innerHTML = '<span class="material-symbols-outlined">stop</span>';
  };

  recognition.onend = function () {
    isRecording = false;
    micBtn.classList.remove('listening');
    micBtn.innerHTML = '<span class="material-symbols-outlined">mic</span>';
  };

  recognition.onresult = function (event) {
    const transcript = event.results[0][0].transcript;
    messageInput.value += transcript + " ";
    setInput(messageInput.value.trim());
  };

  micBtn.addEventListener('click', () => {
    if (!processMicClick()) return;
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

function processMicClick() {
  if (!currentUser) return false;
  return true;
}

// Session Management (LocalStorage)
window.addEventListener('load', () => {
  const saved = localStorage.getItem('eshika_user');
  if (saved) {
    try {
      currentUser = JSON.parse(saved);
      loginOverlay.classList.add('hidden');
      appContainer.classList.remove('hidden');
      updateUserProfile();
      loadHistory();
    } catch (e) {
      console.error("Session load check failed");
    }
  }
});

// Authentication
async function handleAuth(type) {
  const username = document.getElementById('username-input').value;
  const email = document.getElementById('email-input').value;
  const password = document.getElementById('password-input').value;

  authError.textContent = '';

  const endpoint = type === 'login' ? '/api/login' : '/api/signup';
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
      localStorage.setItem('eshika_user', JSON.stringify(currentUser)); // Persist Session

      loginOverlay.classList.add('hidden');
      appContainer.classList.remove('hidden');
      updateUserProfile();
      loadHistory();
    } else {
      authError.textContent = data.error || 'Authentication failed';
    }
  } catch (err) {
    authError.textContent = 'Connection error. Please check server.';
  }
}

function logout() {
  currentUser = null;
  currentChatId = null;
  localStorage.removeItem('eshika_user');
  location.reload();
}

function updateUserProfile() {
  document.getElementById('display-name').textContent = currentUser.username || "User";
  document.getElementById('display-email').textContent = currentUser.email;
  const initial = (currentUser.username || "U")[0].toUpperCase();
  document.getElementById('user-avatar').textContent = initial;
  document.getElementById('welcome-user').textContent = currentUser.username || "Human";
}

// History Handling
async function loadHistory() {
  historyList.innerHTML = ''; // Clear
  if (!currentUser) return;

  try {
    const res = await fetch('/api/history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: currentUser.email })
    });
    const data = await res.json();
    if (data.history) {
      // Sort: Pinned first, then by original order (assuming Newest First from server)
      const sorted = data.history.sort((a, b) => {
        if (a.isPinned === b.isPinned) return 0;
        return a.isPinned ? -1 : 1;
      });

      sorted.forEach(item => {
        addToHistoryUI(item.title, item.id, item.isPinned);
      });
    }
  } catch (err) {
    console.error("Failed to load history");
  }
}

function addToHistoryUI(title, id, isPinned) {
  const item = document.createElement('div');
  item.className = `sidebar-item ${isPinned ? 'pinned' : ''}`;

  // Title section
  const titleDiv = document.createElement('div');
  titleDiv.className = 'history-title';
  titleDiv.innerHTML = `<span class="material-symbols-outlined">${isPinned ? 'push_pin' : 'chat_bubble_outline'}</span><span>${title}</span>`;
  titleDiv.onclick = () => loadChat(id);

  // Actions section
  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'chat-actions';

  // Pin Button
  const pinBtn = document.createElement('button');
  pinBtn.className = 'action-btn';
  pinBtn.innerHTML = `<span class="material-symbols-outlined">${isPinned ? 'do_not_disturb_on' : 'push_pin'}</span>`;
  pinBtn.title = isPinned ? "Unpin" : "Pin";
  pinBtn.onclick = (e) => { e.stopPropagation(); togglePin(id, isPinned); };

  // Rename Button
  const renameBtn = document.createElement('button');
  renameBtn.className = 'action-btn';
  renameBtn.innerHTML = `<span class="material-symbols-outlined">edit</span>`;
  renameBtn.title = "Rename";
  renameBtn.onclick = (e) => { e.stopPropagation(); renameChat(id); };

  // Delete Button
  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'action-btn delete';
  deleteBtn.innerHTML = `<span class="material-symbols-outlined">delete</span>`;
  deleteBtn.title = "Delete";
  deleteBtn.onclick = (e) => { e.stopPropagation(); deleteChat(id); };

  actionsDiv.appendChild(pinBtn);
  actionsDiv.appendChild(renameBtn);
  actionsDiv.appendChild(deleteBtn);

  item.appendChild(titleDiv);
  item.appendChild(actionsDiv);

  historyList.appendChild(item); // Append for Newest First (if sorted correctly)
}

async function togglePin(chatId, currentStatus) {
  try {
    await fetch('/api/chat/pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: currentUser.email, chatId, isPinned: !currentStatus })
    });
    loadHistory(); // Reload to sort
  } catch (e) { console.error(e); }
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
  } catch (e) { console.error(e); }
}

async function renameChat(chatId) {
  const newName = prompt("Enter new name for this chat:");
  if (!newName) return;
  try {
    await fetch('/api/chat/rename', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: currentUser.email, chatId, newTitle: newName })
    });
    loadHistory();
  } catch (e) { console.error(e); }
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

      data.chat.messages.forEach(msg => {
        addMessage(msg.content, msg.role);
      });
      scrollToBottom();

      // Close sidebar on mobile
      sidebar.classList.remove('open');
    }
  } catch (err) {
    console.error("Error loading chat", err);
  }
}


// Settings Modal
function toggleSettings() {
  settingsModal.classList.toggle('hidden');
  document.getElementById('settings-msg').textContent = '';
}

// Open settings from sidebar item
document.querySelectorAll('.sidebar-item').forEach(item => {
  if (item.textContent.includes('Settings')) {
    item.addEventListener('click', toggleSettings);
  }
});

async function updateAccount() {
  const newUsername = document.getElementById('new-username').value;
  const oldPassword = document.getElementById('old-password').value;
  const newPassword = document.getElementById('new-password').value;
  const msg = document.getElementById('settings-msg');

  if (!oldPassword) {
    msg.textContent = "Current password is required";
    return;
  }

  try {
    const res = await fetch('/api/account/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: currentUser.email,
        oldPassword,
        newUsername,
        newPassword
      })
    });

    const data = await res.json();
    if (data.success) {
      msg.style.color = 'green';
      msg.textContent = "Updated successfully!";
      if (newUsername) {
        currentUser.username = newUsername;
        localStorage.setItem('eshika_user', JSON.stringify(currentUser)); // Update Persistent Session
        updateUserProfile();
      }
      if (newPassword) currentUser.password = newPassword;
      setTimeout(toggleSettings, 1500);
    } else {
      msg.style.color = '#ff8b8b';
      msg.textContent = data.error;
    }
  } catch (err) {
    msg.textContent = "Server error";
  }
}

// Add Logout Option to Settings
const modalContent = document.querySelector('.modal-content');
if (!document.getElementById('logout-btn')) {
  const logoutBtn = document.createElement('button');
  logoutBtn.id = 'logout-btn';
  logoutBtn.textContent = 'Log Out';
  logoutBtn.style.marginTop = '1rem';
  logoutBtn.style.background = '#ff6b6b';
  logoutBtn.style.color = 'white';
  logoutBtn.onclick = logout;
  modalContent.appendChild(logoutBtn);
}


// Chat Logic
function setInput(text) {
  messageInput.value = text;
  messageInput.focus();
  sendBtn.classList.add('active');
  messageInput.style.height = 'auto';
  messageInput.style.height = (messageInput.scrollHeight) + 'px';
}

function startNewChat() {
  currentChatId = null;
  welcomeScreen.classList.remove('hidden');
  messagesContainer.classList.add('hidden');
  messagesContainer.innerHTML = '';
  messageInput.value = '';
  messageInput.style.height = 'auto';
  sidebar.classList.remove('open');
}

async function sendMessage() {
  const text = messageInput.value.trim();
  if (!text) return;

  // UI Updates
  messageInput.value = '';
  messageInput.style.height = 'auto';
  sendBtn.classList.remove('active');

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
        chatId: currentChatId
      })
    });

    const data = await res.json();

    const loadingMsg = document.getElementById(loadingId);
    if (loadingMsg) loadingMsg.remove();

    addMessage(data.reply, 'bot');

    if (!currentChatId && data.chatId) {
      currentChatId = data.chatId;
      addToHistoryUI(data.title, data.chatId);
      loadHistory();
    }

  } catch (err) {
    const loadingMsg = document.getElementById(loadingId);
    if (loadingMsg) loadingMsg.remove();
    addMessage("Sorry, something went wrong.", 'bot');
  }
}

function addMessage(text, sender) {
  const msgDiv = document.createElement('div');
  msgDiv.classList.add('message', sender);

  const iconDiv = document.createElement('div');
  if (sender === 'bot') {
    iconDiv.innerHTML = '<img src="/logo.png" class="bot-icon" alt="Bot" onerror="this.src=\'https://www.gstatic.com/lamda/images/gemini_sparkle_v002_d4735304ff6292a690345.svg\'">';
  }

  const contentDiv = document.createElement('div');
  contentDiv.classList.add('message-content');

  if (sender === 'bot') {
    contentDiv.innerHTML = marked.parse(text);
  } else {
    contentDiv.textContent = text;
  }

  if (sender === 'bot') msgDiv.appendChild(iconDiv);
  msgDiv.appendChild(contentDiv);

  messagesContainer.appendChild(msgDiv);
  scrollToBottom();
}

function addThinkingBubble() {
  const id = 'loading-' + Date.now();
  const msgDiv = document.createElement('div');
  msgDiv.classList.add('message', 'bot');
  msgDiv.id = id;

  const iconDiv = document.createElement('div');
  iconDiv.innerHTML = '<img src="/logo.png" class="bot-icon" alt="Bot" onerror="this.src=\'https://www.gstatic.com/lamda/images/gemini_sparkle_v002_d4735304ff6292a690345.svg\'">';

  const contentDiv = document.createElement('div');
  contentDiv.classList.add('message-content');
  contentDiv.innerHTML = `
        <div class="thinking-dots">
            <div class="dot"></div>
            <div class="dot"></div>
            <div class="dot"></div>
        </div>
    `;

  msgDiv.appendChild(iconDiv);
  msgDiv.appendChild(contentDiv);
  messagesContainer.appendChild(msgDiv);
  scrollToBottom();
  return id;
}

function scrollToBottom() {
  const chatWindow = document.getElementById('chat-window');
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

// Sidebar Interaction
const menuBtn = document.querySelector('.menu-btn');
const sidebar = document.querySelector('.sidebar');
const menuBtnMobile = document.querySelector('.menu-btn-mobile');

menuBtn.addEventListener('click', () => {
  sidebar.classList.toggle('collapsed');
});

menuBtnMobile.addEventListener('click', () => {
  sidebar.classList.toggle('open');
});
