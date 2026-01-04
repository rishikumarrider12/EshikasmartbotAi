import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR);
}

// Load users from file
let users = [];
if (fs.existsSync(USERS_FILE)) {
  try {
    const data = fs.readFileSync(USERS_FILE, 'utf8');
    users = JSON.parse(data);
  } catch (err) {
    console.error("Error reading users file:", err);
    users = [];
  }
}

function saveUsers() {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
  } catch (err) {
    console.error("Error saving users file:", err);
  }
}

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Auth Endpoints
app.post("/api/signup", (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ error: "All fields are required" });
  }

  const existingUser = users.find(u => u.email === email);
  if (existingUser) {
    return res.status(400).json({ error: "User already exists" });
  }

  const newUser = {
    id: Date.now().toString(),
    username,
    email,
    password,
    chats: []
  };
  users.push(newUser);
  saveUsers(); // PERSIST

  const { password: _, ...userSafe } = newUser;
  res.json({ success: true, user: userSafe });
});

app.post("/api/login", (req, res) => {
  const { email, password } = req.body;
  const user = users.find(u => u.email === email && u.password === password);

  if (!user) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const { password: _, ...userSafe } = user;
  res.json({ success: true, user: userSafe });
});

// History & Account Management Endpoints
app.post("/api/history", (req, res) => {
  const { email } = req.body;
  const user = users.find(u => u.email === email);
  if (!user) return res.status(404).json({ error: "User not found" });

  const history = user.chats.map(chat => ({
    id: chat.id,
    title: chat.title,
    isPinned: chat.isPinned || false
  }));
  res.json({ history });
});

app.post("/api/chat/load", (req, res) => {
  const { email, chatId } = req.body;
  const user = users.find(u => u.email === email);
  if (!user) return res.status(404).json({ error: "User not found" });

  const chat = user.chats.find(c => c.id === chatId);
  if (!chat) return res.status(404).json({ error: "Chat not found" });

  res.json({ chat });
});

app.post("/api/chat/delete", (req, res) => {
  const { email, chatId } = req.body;
  const user = users.find(u => u.email === email);
  if (!user) return res.status(404).json({ error: "User not found" });

  const chatIndex = user.chats.findIndex(c => c.id === chatId);
  if (chatIndex === -1) return res.status(404).json({ error: "Chat not found" });

  user.chats.splice(chatIndex, 1);
  saveUsers();
  res.json({ success: true });
});

app.post("/api/chat/rename", (req, res) => {
  const { email, chatId, newTitle } = req.body;
  const user = users.find(u => u.email === email);
  if (!user) return res.status(404).json({ error: "User not found" });

  const chat = user.chats.find(c => c.id === chatId);
  if (!chat) return res.status(404).json({ error: "Chat not found" });

  chat.title = newTitle;
  saveUsers();
  res.json({ success: true });
});

app.post("/api/chat/pin", (req, res) => {
  const { email, chatId, isPinned } = req.body;
  const user = users.find(u => u.email === email);
  if (!user) return res.status(404).json({ error: "User not found" });

  const chat = user.chats.find(c => c.id === chatId);
  if (!chat) return res.status(404).json({ error: "Chat not found" });

  chat.isPinned = isPinned;
  saveUsers();
  res.json({ success: true });
});

app.post("/api/account/update", (req, res) => {
  const { email, newUsername, newPassword, oldPassword } = req.body;
  const user = users.find(u => u.email === email);

  if (!user) return res.status(404).json({ error: "User not found" });
  if (user.password !== oldPassword) return res.status(401).json({ error: "Incorrect old password" });

  if (newUsername) user.username = newUsername;
  if (newPassword) user.password = newPassword;

  saveUsers(); // PERSIST

  res.json({ success: true, message: "Account updated successfully" });
});


// Chat Endpoint
app.post("/chat", async (req, res) => {
  try {
    const { message, email, chatId, language, model } = req.body;

    const user = users.find(u => u.email === email);
    if (!user) return res.status(401).json({ error: "User not found" });

    // Manage Chat Session
    let currentChat;
    if (chatId) {
      currentChat = user.chats.find(c => c.id === chatId);
    }

    if (!currentChat) {
      currentChat = {
        id: Date.now().toString(),
        title: message.substring(0, 30) + (message.length > 30 ? "..." : ""),
        messages: []
      };
      user.chats.unshift(currentChat);
    }

    // Add User Message
    currentChat.messages.push({ role: 'user', content: message });
    saveUsers(); // Save execution state immediately

    // Image Generation Check (Pollinations.ai)
    if (message.toLowerCase().startsWith('/image') ||
      message.toLowerCase().startsWith('generate image') ||
      message.toLowerCase().startsWith('draw')) {

      const prompt = message.replace(/^\/image|generate image|draw/gi, '').trim();
      if (prompt.length > 0) {
        const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}`;
        const reply = `Here is the image for "${prompt}":\n\n![${prompt}](${imageUrl})`;

        // Add Bot Message
        currentChat.messages.push({ role: 'bot', content: reply });
        saveUsers();

        return res.json({ reply, chatId: currentChat.id, title: currentChat.title });
      }
    }

    // API Call
    const API_KEY = process.env.GEMINI_API_KEY;
    const MODEL_NAME = model || "gemini-1.5-flash-latest";
    const cleanModelName = MODEL_NAME.startsWith('models/') ? MODEL_NAME : `models/${MODEL_NAME}`;
    const url = `https://generativelanguage.googleapis.com/v1beta/${cleanModelName}:generateContent?key=${API_KEY}`;

    const langInstruction = language ? ` Please reply in this language code: ${language}.` : "";

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `You are Eshika Smart Bot AI 🤖. Intro: "I am Eshika chatbot Ai created by N. Rishi Kumar son of N. Chiranjeevi". \n\nKnowledge Base:\n- Founder and Chairman of Eshika IT Solutions & Eshika Training and Placements is **Raghu Varma**.\n\nStyle Guide:\n- Use emojis frequently to express emotion 🌟.\n- Be concise but friendly.\n- If the user speaks in a different language, reply in that language.${langInstruction}\n\nUser: ${message}`
          }]
        }]
      })
    });

    const data = await response.json();

    if (data.error) {
      console.error("Gemini API Error Detail:", JSON.stringify(data.error, null, 2));

      let reply = "I am having trouble connecting to my brain right now. Please try again.";
      const errorCode = data.error.code;
      const errorMsg = data.error.message || "";

      if (errorCode === 429) {
        reply = "I'm a bit overwhelmed right now (Quota Exceeded). Please try again in a minute! 😅";
      } else if (errorMsg.includes("API key")) {
        reply = "There's an issue with my API key connection. Please check the configuration. 🔑";
      } else if (errorCode === 404) {
        reply = `I couldn't find the model "${MODEL_NAME}". Please select a different one in settings. 🔍`;
      } else if (errorCode === 400) {
        reply = "I didn't understand that request. It might be too long or contains unsupported content. 🧩";
      } else {
        reply = `Brain Error (${errorCode || 'Unknown'}): ${errorMsg || 'Something went wrong connection-wise.'}`;
      }

      return res.status(errorCode || 500).json({ reply });
    }

    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "I couldn't generate a response.";

    // Add Bot Message
    currentChat.messages.push({ role: 'bot', content: reply });
    saveUsers(); // Save execution state

    res.json({ reply, chatId: currentChat.id, title: currentChat.title });

  } catch (err) {
    console.error("Server-Side Error:", err);
    res.status(500).json({ reply: `An internal server error occurred: ${err.message}` });
  }
});

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
  console.log(`Eshika Smart Bot by N. Rishi Kumar is active .`);
});
