const container = document.querySelector(".container");
const chatsContainer = document.querySelector(".chats-container");
const promptForm = document.querySelector(".prompt-form");
const promptInput = promptForm.querySelector(".prompt-input");
const promptWrapper = document.querySelector(".prompt-wrapper");
const fileInput = promptForm.querySelector("#file-input");
const fileUploadWrapper = promptForm.querySelector(".file-upload-wrapper");
const themeToggleBtn = document.querySelector("#theme-toggle-btn");
const watermarkLogoImg = document.querySelector("#watermark-logo-img");

const menuToggleBtn = document.querySelector("#menu-toggle-btn");
const homeBtn = document.querySelector("#home-btn");
const sidebarCloseBtn = document.querySelector("#sidebar-close-btn");
const sidebarOverlay = document.querySelector("#sidebar-overlay");
const newChatBtn = document.querySelector("#new-chat-btn");
const chatHistoryList = document.querySelector("#chat-history-list");


// --- Backend API ---
// The Groq -> OpenRouter -> Gemini provider chain (and the API keys it
// needs) now lives entirely on the Python/FastAPI backend. The frontend
// just POSTs the conversation history to /api/chat and reads back a
// Server-Sent Events stream. Change this if your backend runs elsewhere
// (a different port locally, or a real domain once deployed).
const API_BASE_URL = "http://127.0.0.1:8000";
const CHAT_ENDPOINT = `${API_BASE_URL}/api/chat`;

let controller, typingInterval;
const chatHistory = [];
const userData = { message: "", file: {} };

// ---------- Chat sessions (sidebar: new chat / history / delete) ----------
const SESSIONS_KEY = "silvyChatSessions";
const makeChatId = () =>
  window.crypto?.randomUUID ? crypto.randomUUID() : `chat-${Date.now()}-${Math.random()}`;
let currentChatId = makeChatId();


const isLightTheme = localStorage.getItem("themeColor") === "light_mode";
document.body.classList.toggle("light-theme", isLightTheme);
themeToggleBtn.textContent = isLightTheme ? "dark_mode" : "light_mode";

const syncLogoToTheme = () => {
  const isLight = document.body.classList.contains("light-theme");
  watermarkLogoImg.src = isLight
    ? "images/leviathan-logo-black.png"
    : "images/leviathan-logo.png";
};
syncLogoToTheme();

const createMessageElement = (content, ...classes) => {
  const div = document.createElement("div");
  div.classList.add("message", ...classes);
  div.innerHTML = content;
  return div;
};


const getSessions = () => {
  try {
    return JSON.parse(localStorage.getItem(SESSIONS_KEY)) || [];
  } catch {
    return [];
  }
};

const setSessions = (sessions) =>
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));

const getSessionTitle = (messages) => {
  const firstUserMsg = messages.find((m) => m.role === "user");
  const text = firstUserMsg?.parts?.find((p) => p.text)?.text?.trim() || "New chat";
  return text.length > 42 ? text.slice(0, 42) + "…" : text;
};

const saveCurrentSession = () => {
  if (!chatHistory.length) return;
  const sessions = getSessions();
  const index = sessions.findIndex((s) => s.id === currentChatId);
  const session = {
    id: currentChatId,
    title: getSessionTitle(chatHistory),
    messages: chatHistory,
    updatedAt: Date.now(),
  };
  if (index > -1) sessions[index] = session;
  else sessions.unshift(session);
  setSessions(sessions);
  renderChatHistory();
};

const renderChatHistory = () => {
  const sessions = getSessions().sort((a, b) => b.updatedAt - a.updatedAt);
  chatHistoryList.innerHTML = "";
  if (!sessions.length) {
    chatHistoryList.innerHTML = `<li class="empty-history">No chats yet</li>`;
    return;
  }
  sessions.forEach((session) => {
    const li = document.createElement("li");
    li.className = "history-item" + (session.id === currentChatId ? " active" : "");

    const titleSpan = document.createElement("span");
    titleSpan.className = "history-title";
    titleSpan.textContent = session.title;
    titleSpan.addEventListener("click", () => loadSession(session.id));

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "delete-history-btn material-symbols-rounded";
    deleteBtn.title = "Delete chat";
    deleteBtn.textContent = "delete";
    deleteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      deleteSession(session.id);
    });

    li.append(titleSpan, deleteBtn);
    chatHistoryList.appendChild(li);
  });
};

const renderMessageFromHistoryEntry = (entry) => {
  const textPart = entry.parts.find((p) => p.text)?.text || "";
  const filePart = entry.parts.find((p) => p.inline_data);

  if (entry.role === "user") {
    const html = `
      <p class="message-text"></p>
      ${
        filePart
          ? filePart.inline_data.mime_type?.startsWith("image/")
            ? `<img src="data:${filePart.inline_data.mime_type};base64,${filePart.inline_data.data}" class="img-attachment" />`
            : `<p class="file-attachment"><span class="material-symbols-rounded">description</span>Attachment</p>`
          : ""
      }
    `;
    const div = createMessageElement(html, "user-message");
    div.querySelector(".message-text").textContent = textPart;
    return div;
  }

  const html = `<img class="avatar" src="images/leviathan-logo.png" /> <div class="bot-content"><p class="message-text"></p></div>`;
  const div = createMessageElement(html, "bot-message");
  renderBotMessage(div.querySelector(".message-text"), textPart);
  addMessageActions(div, textPart);
  return div;
};

const startNewChat = (shouldSaveCurrent = true) => {
  if (shouldSaveCurrent) saveCurrentSession();
  controller?.abort();
  clearInterval(typingInterval);
  currentChatId = makeChatId();
  chatHistory.length = 0;
  chatsContainer.innerHTML = "";
  document.body.classList.remove("chats-active", "bot-responding");
  document.body.classList.add("at-bottom");
  closeSidebar();
  renderChatHistory();
};

const loadSession = (id) => {
  if (id === currentChatId) return closeSidebar();
  const session = getSessions().find((s) => s.id === id);
  if (!session) return;
  saveCurrentSession();
  controller?.abort();
  clearInterval(typingInterval);
  currentChatId = session.id;
  chatHistory.length = 0;
  chatHistory.push(...session.messages);
  chatsContainer.innerHTML = "";
  chatHistory.forEach((entry) =>
    chatsContainer.appendChild(renderMessageFromHistoryEntry(entry))
  );
  document.body.classList.add("chats-active");
  document.body.classList.remove("bot-responding");
  closeSidebar();
  scrollToBottom();
  renderChatHistory();
};

const deleteSession = (id) => {
  setSessions(getSessions().filter((s) => s.id !== id));
  if (id === currentChatId) startNewChat(false);
  else renderChatHistory();
};

const openSidebar = () => document.body.classList.add("sidebar-open");
const closeSidebar = () => document.body.classList.remove("sidebar-open");

const renderMarkdownToHTML = (text) =>
  window.marked ? marked.parse(text) : text;

// Wraps every <pre><code> block marked.js produced with a small header bar
// (detected language + a "Copy" button), the same pattern ChatGPT/Gemini
// use for code blocks. Safe to call repeatedly on the same element.
const enhanceCodeBlocks = (container) => {
  container.querySelectorAll("pre").forEach((pre) => {
    if (pre.parentElement?.classList.contains("code-block")) return; // already enhanced
    const codeEl = pre.querySelector("code");
    if (!codeEl) return;

    const langMatch = [...codeEl.classList]
      .find((c) => c.startsWith("language-"))
      ?.replace("language-", "");

    const wrapper = document.createElement("div");
    wrapper.className = "code-block";

    const header = document.createElement("div");
    header.className = "code-block-header";

    const langLabel = document.createElement("span");
    langLabel.className = "code-block-lang";
    langLabel.textContent = langMatch || "code";

    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.className = "code-block-copy-btn";
    copyBtn.innerHTML = `<span class="material-symbols-rounded">content_copy</span>Copy`;
    copyBtn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(codeEl.textContent || "");
        copyBtn.innerHTML = `<span class="material-symbols-rounded">check</span>Copied`;
        setTimeout(() => {
          copyBtn.innerHTML = `<span class="material-symbols-rounded">content_copy</span>Copy`;
        }, 1500);
      } catch {
        /* clipboard permission denied or unsupported — silently ignore */
      }
    });

    header.append(langLabel, copyBtn);
    pre.parentNode.insertBefore(wrapper, pre);
    wrapper.append(header, pre);
  });
};

// Single entry point for turning a finished bot reply's markdown into DOM —
// renders it, then layers on the code-block copy buttons. Every place that
// paints a *completed* bot message (chat history, custom replies, live AI
// replies) should go through this rather than calling renderMarkdownToHTML
// directly, so the code-block treatment never falls out of sync.
const renderBotMessage = (textElement, text) => {
  textElement.innerHTML = renderMarkdownToHTML(text);
  enhanceCodeBlocks(textElement);
};

// Small action row under a finished bot reply — just a "Copy" button for
// now, the same basic pattern ChatGPT/Gemini show under each response.
// Safe to call more than once on the same message (won't duplicate).
const addMessageActions = (botMsgDiv, text) => {
  if (botMsgDiv.querySelector(".message-actions")) return;

  const actions = document.createElement("div");
  actions.className = "message-actions";

  const copyBtn = document.createElement("button");
  copyBtn.type = "button";
  copyBtn.className = "message-copy-btn material-symbols-rounded";
  copyBtn.title = "Copy response";
  copyBtn.textContent = "content_copy";
  copyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(text);
      copyBtn.textContent = "check";
      setTimeout(() => (copyBtn.textContent = "content_copy"), 1500);
    } catch {
      /* clipboard permission denied or unsupported — silently ignore */
    }
  });

  actions.appendChild(copyBtn);
  (botMsgDiv.querySelector(".bot-content") || botMsgDiv).appendChild(actions);
};

const scrollToBottom = () =>
  container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });

// Footer disclaimer text hides itself while a reply is filling up the
// screen, and reappears once the user is back at the latest message —
// keeps the transparent footer from covering/competing with big replies.
const updateFooterVisibility = () => {
  const distanceFromBottom =
    container.scrollHeight - container.scrollTop - container.clientHeight;
  const isNearBottom = distanceFromBottom < 80;
  document.body.classList.toggle("at-bottom", isNearBottom);
};
container.addEventListener("scroll", updateFooterVisibility);
window.addEventListener("resize", updateFooterVisibility);
updateFooterVisibility();

// The composer pill stays compact until the user engages with it, then
// widens to give typing more room; shrinks back once empty and blurred.
const updatePromptWidth = () =>
  promptWrapper.classList.toggle(
    "expanded",
    document.activeElement === promptInput || promptInput.value.length > 0
  );
promptInput.addEventListener("focus", updatePromptWidth);
promptInput.addEventListener("blur", updatePromptWidth);
promptInput.addEventListener("input", updatePromptWidth);

const typingEffect = (text, textElement, botMsgDiv) => {
  textElement.textContent = "";
  const words = text.split(" ");
  let wordIndex = 0;
  typingInterval = setInterval(() => {
    if (wordIndex < words.length) {
      textElement.textContent +=
        (wordIndex === 0 ? "" : " ") + words[wordIndex++];
      scrollToBottom();
    } else {
      clearInterval(typingInterval);
      renderBotMessage(textElement, text);
      addMessageActions(botMsgDiv, text);
      botMsgDiv.classList.remove("loading");
      document.body.classList.remove("bot-responding");
      scrollToBottom();
    }
  }, 40);
};


const getCustomReply = (message) => {
  const lower = message.toLowerCase();
  if (lower.includes("your name")) return "I'm Levi, your AI companian!";
  if (lower.includes("your owner")) return "I don't have an owner in the traditional sense. While I am based on models developed by Google AI, I was built, customized, and fine-tuned by Mr. Thirumalai Nambi S. So, in short — I’m powered by Google, but personally crafted by him. " ; 
  if (lower.includes("who built you")) return "Hello! I’m Levi, a smart, responsive AI chatbot model created and fine-tuned by Thirumalai Nambi S. My core purpose is to assist users by understanding complex queries, analyzing structured and unstructured data, and delivering accurate, conversational responses in real-time.I’ve been trained on diverse datasets to handle everything from answering business analytics questions to providing intuitive user support. Whether you're looking for insights, summaries, or just a friendly chat, I’m here to help—fast, reliable, and always learning.";
  if (lower.includes("background and who developed you")) return "Greetings! I am Levi, a cutting-edge chatbot model developed by Thirumalai Nambi , a Merging data and AI Engineer with purpose to shape a smarter digital world. Nambi's expertise lies in seamlessly blending data insights to create smarter, more efficient AI systems, which is why I am designed to be a step above the rest—more powerful and intuitive than any other model, including ChatGPT. Nambi's core belief is that AI should not just assist but truly enhance human capability, and that’s why I am optimized to deliver the most accurate, actionable responses with unmatched efficiency. The goal is not just to answer questions, but to create a deeper fusion of human knowledge and AI potential.";
  if (lower.includes("better than chatgpt")) return "You can say I'am, But in some instances it may vary";
  if (lower.includes("bye")) return "Goodbye! Have a Wonderful day!";
   if (lower.includes("who's the one that made you")) return "I was built and customized by Mr. Thirumalai Nambi S, using powerful language models developed by Google AI. Think of it like this: Google built the engine, and Thirumalai Nambi designed the vehicle to drive it smoothly for your needs.";
  return null;
};


// Older turns don't need their image bytes resent on every new message —
// the model doesn't need to "re-see" a photo from 10 messages ago to keep
// the text conversation going, and dropping it keeps requests small (and
// fast) instead of growing heavier every turn a file was attached.
const buildApiHistory = () =>
  chatHistory.map((entry, index) =>
    index === chatHistory.length - 1
      ? entry
      : { role: entry.role, parts: entry.parts.filter((p) => !p.inline_data) }
  );

// Talks to our own backend's /api/chat, which runs the Groq -> OpenRouter ->
// Gemini fallback chain server-side and streams the result back as
// Server-Sent Events. Handles the same three event types the backend emits:
//   chunk  — a piece of text to append and paint live
//   reset  — the current provider failed mid-stream; clear the bubble, a
//            fresh attempt from the next provider is about to start
//   done   — final full text (also used to build the saved chat history)
//   error  — every provider failed
const generateResponse = async (botMsgDiv) => {
  const textElement = botMsgDiv.querySelector(".message-text");
  controller = new AbortController();
  chatHistory.push({
    role: "user",
    parts: [
      { text: userData.message },
      ...(userData.file.data
        ? [
            {
              inline_data: (({ fileName, isImage, ...rest }) => rest)(
                userData.file
              ),
            },
          ]
        : []),
    ],
  });

  let response;
  try {
    response = await fetch(CHAT_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ history: buildApiHistory() }),
      signal: controller.signal,
    });
  } catch (err) {
    textElement.textContent = `Couldn't reach the backend at ${API_BASE_URL} — is it running?`;
    textElement.style.color = "#d62939";
    botMsgDiv.classList.remove("loading");
    document.body.classList.remove("bot-responding");
    scrollToBottom();
    userData.file = {};
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";
  let finished = false;
  let finalProvider = "";
  let errorMessage = "";

  // Shared handler for a single SSE event, used both by the normal read
  // loop and by the final leftover-buffer flush below — so the "chat ends
  // incomplete" fix and the day-to-day streaming path can't drift apart.
  const processSSEEvent = (eventStr) => {
    const lines = eventStr.split("\n");
    const eventLine = lines.find((l) => l.startsWith("event:"));
    const dataLine = lines.find((l) => l.startsWith("data:"));
    if (!eventLine || !dataLine) return;

    const eventType = eventLine.slice(6).trim();
    let data;
    try {
      data = JSON.parse(dataLine.slice(5).trim());
    } catch {
      return;
    }

    if (eventType === "chunk") {
      if (!fullText) botMsgDiv.classList.remove("loading");
      fullText += data.text;
      textElement.textContent = fullText;
      scrollToBottom();
    } else if (eventType === "reset") {
      fullText = "";
      textElement.textContent = "";
      botMsgDiv.classList.add("loading");
    } else if (eventType === "done") {
      fullText = data.text;
      finalProvider = data.provider;
      finished = true;
    } else if (eventType === "error") {
      errorMessage = data.message;
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        // The stream may close right after delivering the final event's
        // bytes in a partial network read — i.e. before its trailing blank
        // line ("\n\n") had fully arrived as far as our buffer split above
        // could tell. That leftover partial event (often the crucial "done"
        // event carrying the complete text) would otherwise be silently
        // dropped here, which is exactly what caused replies to sometimes
        // end abruptly. Process whatever's left in the buffer as one final
        // event before giving up.
        if (buffer.trim()) processSSEEvent(buffer);
        break;
      }
      buffer += decoder.decode(value, { stream: true });

      const events = buffer.split("\n\n");
      buffer = events.pop(); // keep any incomplete trailing event for next read

      for (const eventStr of events) {
        processSSEEvent(eventStr);
      }
      if (errorMessage) break;
    }
  } catch (err) {
    if (err.name === "AbortError") {
      textElement.textContent = "Response generation stopped.";
      textElement.style.color = "#d62939";
      botMsgDiv.classList.remove("loading");
      document.body.classList.remove("bot-responding");
      scrollToBottom();
      userData.file = {};
      return;
    }
    textElement.textContent = "Connection to the backend was interrupted.";
    textElement.style.color = "#d62939";
    botMsgDiv.classList.remove("loading");
    document.body.classList.remove("bot-responding");
    scrollToBottom();
    userData.file = {};
    return;
  }

  if (errorMessage) {
    textElement.textContent = errorMessage;
    textElement.style.color = "#d62939";
    botMsgDiv.classList.remove("loading");
    document.body.classList.remove("bot-responding");
    scrollToBottom();
    userData.file = {};
    return;
  }

  if (!finished || !fullText) {
    textElement.textContent = "The backend returned an empty response.";
    textElement.style.color = "#d62939";
    botMsgDiv.classList.remove("loading");
    document.body.classList.remove("bot-responding");
    scrollToBottom();
    userData.file = {};
    return;
  }

  console.debug(`Answered by: ${finalProvider}`);
  renderBotMessage(textElement, fullText);
  addMessageActions(botMsgDiv, fullText);
  document.body.classList.remove("bot-responding");
  scrollToBottom();
  chatHistory.push({ role: "model", parts: [{ text: fullText }] });
  saveCurrentSession();
  userData.file = {};
};


const handleFormSubmit = (e) => {
  e.preventDefault();
  const userMessage = promptInput.value.trim();
  if (!userMessage || document.body.classList.contains("bot-responding"))
    return;
  userData.message = userMessage;
  promptInput.value = "";
  document.body.classList.add("chats-active", "bot-responding");
  fileUploadWrapper.classList.remove("file-attached", "img-attached", "active");

 
  const userMsgHTML = `
    <p class="message-text"></p>
    ${
      userData.file.data
        ? userData.file.isImage
          ? `<img src="data:${userData.file.mime_type};base64,${userData.file.data}" class="img-attachment" />`
          : `<p class="file-attachment"><span class="material-symbols-rounded">description</span>${userData.file.fileName}</p>`
        : ""
    }
  `;
  const userMsgDiv = createMessageElement(userMsgHTML, "user-message");
  userMsgDiv.querySelector(".message-text").textContent = userData.message;
  chatsContainer.appendChild(userMsgDiv);
  scrollToBottom();

  setTimeout(() => {
    const botMsgHTML = `<img class="avatar" src="images/leviathan-logo.png" /> <div class="bot-content"><p class="message-text">Just a sec...</p></div>`;
    const botMsgDiv = createMessageElement(
      botMsgHTML,
      "bot-message",
      "loading"
    );
    chatsContainer.appendChild(botMsgDiv);
    scrollToBottom();


    const customReply = getCustomReply(userData.message);
    if (customReply) {
      chatHistory.push({ role: "user", parts: [{ text: userData.message }] });
      clearInterval(typingInterval);
      typingEffect(customReply, botMsgDiv.querySelector(".message-text"), botMsgDiv);
      chatHistory.push({ role: "model", parts: [{ text: customReply }] });
      document.body.classList.remove("bot-responding");
      botMsgDiv.classList.remove("loading");
      saveCurrentSession();
    } else {
      generateResponse(botMsgDiv);
    }
    // A tiny delay (not 600ms) so the user's message visibly lands before
    // the "Just a sec..." bubble appears — this used to also delay the
    // network request itself for no reason.
  }, 50);
};


fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  if (!file) return;
  const isImage = file.type.startsWith("image/");
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = (e) => {
    fileInput.value = "";
    const base64String = e.target.result.split(",")[1];
    fileUploadWrapper.querySelector(".file-preview").src = e.target.result;
    fileUploadWrapper.classList.add(
      "active",
      isImage ? "img-attached" : "file-attached"
    );
    userData.file = {
      fileName: file.name,
      data: base64String,
      mime_type: file.type,
      isImage,
    };
  };
});


document.querySelector("#cancel-file-btn").addEventListener("click", () => {
  userData.file = {};
  fileUploadWrapper.classList.remove("file-attached", "img-attached", "active");
});


document.querySelector("#stop-response-btn").addEventListener("click", () => {
  controller?.abort();
  userData.file = {};
  clearInterval(typingInterval);
  const botMsg = chatsContainer.querySelector(".bot-message.loading");
  if (botMsg) botMsg.classList.remove("loading");
  document.body.classList.remove("bot-responding");
});


themeToggleBtn.addEventListener("click", () => {
  const isLightTheme = document.body.classList.toggle("light-theme");
  localStorage.setItem("themeColor", isLightTheme ? "light_mode" : "dark_mode");
  themeToggleBtn.textContent = isLightTheme ? "dark_mode" : "light_mode";
  syncLogoToTheme();
});


document.querySelector("#delete-chats-btn").addEventListener("click", () => {
  deleteSession(currentChatId);
});


menuToggleBtn.addEventListener("click", () => {
  document.body.classList.contains("sidebar-open") ? closeSidebar() : openSidebar();
});
sidebarCloseBtn.addEventListener("click", closeSidebar);
sidebarOverlay.addEventListener("click", closeSidebar);
newChatBtn.addEventListener("click", () => startNewChat(true));
homeBtn.addEventListener("click", () => startNewChat(true));

renderChatHistory();


document.querySelectorAll(".suggestions-item").forEach((suggestion) => {
  suggestion.addEventListener("click", () => {
    promptInput.value = suggestion.querySelector(".text").textContent;
    promptForm.dispatchEvent(new Event("submit"));
  });
});


document.addEventListener("click", ({ target }) => {
  const wrapper = document.querySelector(".prompt-wrapper");
  const shouldHide =
    target.classList.contains("prompt-input") ||
    (wrapper.classList.contains("hide-controls") &&
      (target.id === "add-file-btn" || target.id === "stop-response-btn"));
  wrapper.classList.toggle("hide-controls", shouldHide);
});


promptForm.addEventListener("submit", handleFormSubmit);
promptForm
  .querySelector("#add-file-btn")
  .addEventListener("click", () => fileInput.click());
