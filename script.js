const chatBox = document.getElementById("chatBox");
const userInput = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");
const apiKeyInput = document.getElementById("apiKey");
const audioToggle = document.getElementById("audioToggle");
const timestampToggle = document.getElementById("timestampToggle");
const historyList = document.getElementById("historyList");
const clearHistoryBtn = document.getElementById("clearHistoryBtn");
const downloadChatBtn = document.getElementById("downloadChatBtn");
const charCount = document.getElementById("charCount");
const promptButtons = document.querySelectorAll(".prompt-btn");
const supportsSpeech = "speechSynthesis" in window && typeof SpeechSynthesisUtterance === "function";

let chatHistory = [];
let messageCount = 0;

function formatHistoryItem(entry, index) {
  const item = document.createElement("div");
  item.classList.add("history-item");
  
  const textSpan = document.createElement("span");
  textSpan.textContent = `${index + 1}. ${entry.user.slice(0, 30)}${entry.user.length > 30 ? "..." : ""}`;
  item.appendChild(textSpan);
  
  const deleteBtn = document.createElement("button");
  deleteBtn.classList.add("history-delete-btn");
  deleteBtn.textContent = "✕";
  deleteBtn.onclick = (e) => {
    e.stopPropagation();
    chatHistory.splice(index, 1);
    renderHistory();
  };
  item.appendChild(deleteBtn);
  
  item.addEventListener("click", () => loadHistoryEntry(index));
  return item;
}

function renderHistory() {
  historyList.innerHTML = "";
  if (!chatHistory.length) {
    historyList.innerHTML = `<div class="history-item">No saved chat history yet.</div>`;
    return;
  }
  chatHistory.slice().reverse().forEach((entry, reverseIndex) => {
    const index = chatHistory.length - 1 - reverseIndex;
    historyList.appendChild(formatHistoryItem(entry, index));
  });
}

function addMessage(text, sender, label = "") {
  const msg = document.createElement("div");
  msg.classList.add("message", sender);
  msg.id = `msg-${messageCount++}`;

  if (label) {
    const strong = document.createElement("strong");
    strong.textContent = label;
    msg.appendChild(strong);
  }

  const messageText = document.createElement("div");
  messageText.textContent = text;
  msg.appendChild(messageText);

  // Add timestamp
  if (timestampToggle && timestampToggle.checked) {
    const timestamp = document.createElement("span");
    timestamp.classList.add("message-timestamp");
    const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    timestamp.textContent = now;
    msg.appendChild(timestamp);
  }

  // Add action buttons for non-system messages
  if (sender !== "bot" || !msg.classList.contains("system")) {
    const actions = document.createElement("div");
    actions.classList.add("message-actions");
    
    const copyBtn = document.createElement("button");
    copyBtn.classList.add("message-action-btn");
    copyBtn.textContent = "Copy";
    copyBtn.onclick = () => {
      navigator.clipboard.writeText(text);
      copyBtn.textContent = "Copied!";
      setTimeout(() => copyBtn.textContent = "Copy", 2000);
    };
    
    const deleteBtn = document.createElement("button");
    deleteBtn.classList.add("message-action-btn");
    deleteBtn.textContent = "Delete";
    deleteBtn.onclick = () => msg.remove();
    
    actions.appendChild(copyBtn);
    actions.appendChild(deleteBtn);
    msg.appendChild(actions);
  }

  chatBox.appendChild(msg);
  chatBox.scrollTop = chatBox.scrollHeight;
}

function showStatus(text) {
  const status = document.createElement("div");
  status.classList.add("message", "bot", "system");
  
  if (text === "Thinking...") {
    const typingDiv = document.createElement("div");
    typingDiv.classList.add("typing-indicator");
    typingDiv.innerHTML = '<span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>';
    status.appendChild(typingDiv);
  } else {
    status.textContent = text;
  }
  
  chatBox.appendChild(status);
  chatBox.scrollTop = chatBox.scrollHeight;
  return status;
}

function loadHistoryEntry(index) {
  const entry = chatHistory[index];
  if (!entry) return;

  userInput.value = entry.user;
  chatBox.innerHTML = "";
  addMessage(entry.user, "user", "User");
  addMessage(entry.bot, "bot", "Assistant");
}

function speakText(text) {
  if (!supportsSpeech || !audioToggle.checked) return;

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = 1;
  utterance.pitch = 1;
  utterance.volume = 1;

  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

function loadAudioPreference() {
  const saved = localStorage.getItem("audioEnabled");
  if (saved !== null) {
    audioToggle.checked = saved === "true";
  }

  if (!supportsSpeech) {
    audioToggle.checked = false;
    audioToggle.disabled = true;
    audioToggle.parentElement.textContent = "Audio replies unavailable in this browser";
  }
}

function loadTimestampPreference() {
  const saved = localStorage.getItem("timestampEnabled");
  if (saved !== null) {
    timestampToggle.checked = saved === "true";
  }
}

function downloadChatHistory() {
  if (chatHistory.length === 0) {
    alert("No chat history to download.");
    return;
  }

  let content = "NeuroChat Conversation History\n";
  content += "================================\n\n";
  
  chatHistory.forEach((entry, index) => {
    content += `Conversation ${index + 1}\n`;
    content += `User: ${entry.user}\n`;
    content += `Assistant: ${entry.bot}\n`;
    content += `Date: ${new Date(entry.date).toLocaleString()}\n`;
    content += "---\n\n";
  });

  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `NeuroChat-${new Date().toISOString().slice(0, 10)}.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function saveHistory(userMessage, botReply) {
  chatHistory.push({ user: userMessage, bot: botReply, date: new Date().toISOString() });
  if (chatHistory.length > 15) {
    chatHistory.shift();
  }
  renderHistory();
}

function showError(message) {
  addMessage(message, "bot", "Error");
}

async function sendMessage() {
  const message = userInput.value.trim();
  const apiKey = apiKeyInput.value.trim();

  if (!message) {
    showStatus("Type a message before sending.");
    return;
  }

  if (!apiKey) {
    showStatus("API key required to connect.");
    return;
  }

  addMessage(message, "user", "You");
  userInput.value = "";
  showStatus("Thinking...");

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-3.5-turbo",
        messages: [{ role: "user", content: message }],
      }),
    });

    const result = await response.json();
    const typingBubble = document.querySelector(".bot.system:last-child");
    if (typingBubble) typingBubble.remove();

    if (!response.ok) {
      showError(result.error?.message || "Unable to fetch response.");
      console.error(result);
      return;
    }

    if (result.choices && result.choices.length > 0) {
      const botReply = result.choices[0].message?.content || "No response returned.";
      addMessage(botReply, "bot", "Assistant");
      saveHistory(message, botReply);
      speakText(botReply);
    } else {
      showError("The AI returned an empty reply.");
      console.log(result);
    }
  } catch (error) {
    const typingBubble = document.querySelector(".bot.system:last-child");
    if (typingBubble) typingBubble.remove();
    showError("Network error or invalid API key.");
    console.error(error);
  }
}

sendBtn.addEventListener("click", sendMessage);
userInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

userInput.addEventListener("input", () => {
  const length = userInput.value.length;
  charCount.textContent = `${length}/500`;
  if (length >= 500) {
    userInput.value = userInput.value.slice(0, 500);
    charCount.textContent = "500/500";
  }
});

promptButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const prompt = button.dataset.prompt;
    userInput.value = prompt;
    userInput.focus();
    charCount.textContent = `${prompt.length}/500`;
  });
});

clearHistoryBtn.addEventListener("click", () => {
  if (confirm("Are you sure you want to clear all chat history?")) {
    chatHistory = [];
    renderHistory();
  }
});

downloadChatBtn.addEventListener("click", downloadChatHistory);

audioToggle.addEventListener("change", () => {
  localStorage.setItem("audioEnabled", audioToggle.checked);
});

timestampToggle.addEventListener("change", () => {
  localStorage.setItem("timestampEnabled", timestampToggle.checked);
});

loadAudioPreference();
loadTimestampPreference();
renderHistory();
