let chat = document.getElementById("chat");
let voiceEnabled = true;
let synth = window.speechSynthesis;

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
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-IN";
  synth.speak(utterance);
}

function addMessage(text, className) {
  const div = document.createElement("div");
  div.className = "message " + className;
  div.textContent = text;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

async function sendMessage() {
  const input = document.getElementById("userInput");
  const message = input.value.trim();
  if (!message) return;

  addMessage("You: " + message, "user");
  input.value = "";

  try {
    const res = await fetch("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message })
    });

    const data = await res.json();
    addMessage("Eshika: " + data.reply, "bot");
    speak(data.reply);

  } catch {
    addMessage("Eshika: Server error. Please try again.", "bot");
  }
}
