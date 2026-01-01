let chat = document.getElementById("chat");
let voiceEnabled = true;
let synth = window.speechSynthesis;
let selectedLanguage = "en";

// Load chat history
let history = JSON.parse(localStorage.getItem("eshikaHistory")) || [];
history.forEach(m => addMessage(m.text, m.type, false));

function saveHistory(text, type) {
  history.push({ text, type });
  localStorage.setItem("eshikaHistory", JSON.stringify(history));
}

function setLanguage() {
  selectedLanguage = document.getElementById("languageSelect").value;
}

function enableVoice() {
  voiceEnabled = true;
}

function disableVoice() {
  voiceEnabled = false;
  synth.cancel();
}

function speak(text) {
  if (!voiceEnabled) return;
  synth.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = selectedLanguage;
  synth.speak(utter);
}

function addMessage(text, type, save = true) {
  const div = document.createElement("div");
  div.className = "message " + type;
  div.textContent = text;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
  if (save) saveHistory(text, type);
}

async function sendMessage() {
  const input = document.getElementById("userInput");
  const msg = input.value.trim();
  if (!msg) return;

  addMessage("You: " + msg, "user");
  input.value = "";

  try {
    const res = await fetch("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: `Reply in ${selectedLanguage}. ${msg}`
      })
    });

    const data = await res.json();
    addMessage("Eshika: " + data.reply, "bot");
    speak(data.reply);
  } catch {
    addMessage("Eshika: Server error.", "bot");
  }
}

// 🎤 MIC FEATURE
function startMic() {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    alert("Mic not supported");
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = selectedLanguage;
  recognition.start();

  recognition.onresult = (event) => {
    document.getElementById("userInput").value =
      event.results[0][0].transcript;
  };
}
