const container = document.querySelector(".container");
const chatsContainer = document.querySelector(".chats-container");
const promptForm = document.querySelector(".prompt-form");
const promptInput = promptForm.querySelector(".prompt-input");
const fileInput = promptForm.querySelector("#file-input");
const fileUploadWrapper = promptForm.querySelector(".file-upload-wrapper");
const themeToggleBtn = document.querySelector("#theme-toggle-btn");


const API_KEY = "AIzaSyAAJSH9aEqDZaBSSkqfn5sP6P18BLbQFBU";
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;

let controller, typingInterval;
const chatHistory = [];
const userData = { message: "", file: {} };


const isLightTheme = localStorage.getItem("themeColor") === "light_mode";
document.body.classList.toggle("light-theme", isLightTheme);
themeToggleBtn.textContent = isLightTheme ? "dark_mode" : "light_mode";

const createMessageElement = (content, ...classes) => {
  const div = document.createElement("div");
  div.classList.add("message", ...classes);
  div.innerHTML = content;
  return div;
};


const scrollToBottom = () =>
  container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });

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
      botMsgDiv.classList.remove("loading");
      document.body.classList.remove("bot-responding");
    }
  }, 120);
};


const getCustomReply = (message) => {
  const lower = message.toLowerCase();
  if (lower.includes("your name")) return "I'm silvy, your AI companian!";
  if (lower.includes("your owner")) return "I don't have an owner in the traditional sense. While I am based on models developed by Google AI, I was built, customized, and fine-tuned by Mr. Thirumalai Nambi S. So, in short — I’m powered by Google, but personally crafted by him. " ; 
  if (lower.includes("who built you")) return "Hello! I’m silvy, a smart, responsive AI chatbot model created and fine-tuned by Thirumalai Nambi S. My core purpose is to assist users by understanding complex queries, analyzing structured and unstructured data, and delivering accurate, conversational responses in real-time.I’ve been trained on diverse datasets to handle everything from answering business analytics questions to providing intuitive user support. Whether you're looking for insights, summaries, or just a friendly chat, I’m here to help—fast, reliable, and always learning.";
  if (lower.includes("What’s your background and who developed you?")) return "Greetings! I am silvy, a cutting-edge chatbot model developed by Thirumalai Nambi , a Merging data and AI Engineer with purpose to shape a smarter digital world. Nambi's expertise lies in seamlessly blending data insights to create smarter, more efficient AI systems, which is why I am designed to be a step above the rest—more powerful and intuitive than any other model, including ChatGPT. Nambi's core belief is that AI should not just assist but truly enhance human capability, and that’s why I am optimized to deliver the most accurate, actionable responses with unmatched efficiency. The goal is not just to answer questions, but to create a deeper fusion of human knowledge and AI potential.";
  if (lower.includes("Are you better than Chatgpt?")) return "You can say I'am, But in some instances it may vary";
  if (lower.includes("bye")) return "Goodbye! Have a Wonderful day!";
   if (lower.includes("who's the one that made you")) return "I was built and customized by Mr. Thirumalai Nambi S, using powerful language models developed by Google AI. Think of it like this: Google built the engine, and Thirumalai Nambi designed the vehicle to drive it smoothly for your needs.";
  return null;
};


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

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: chatHistory }),
      signal: controller.signal,
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error.message);
    const responseText = data.candidates[0].content.parts[0].text
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .trim();
    typingEffect(responseText, textElement, botMsgDiv);
    chatHistory.push({ role: "model", parts: [{ text: responseText }] });
  } catch (error) {
    textElement.textContent =
      error.name === "AbortError"
        ? "Response generation stopped."
        : error.message;
    textElement.style.color = "#d62939";
    botMsgDiv.classList.remove("loading");
    document.body.classList.remove("bot-responding");
    scrollToBottom();
  } finally {
    userData.file = {};
  }
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
    const botMsgHTML = `<img class="avatar" src="images/silvy.png" /> <p class="message-text">Just a sec...</p>`;
    const botMsgDiv = createMessageElement(
      botMsgHTML,
      "bot-message",
      "loading"
    );
    chatsContainer.appendChild(botMsgDiv);
    scrollToBottom();


    const customReply = getCustomReply(userData.message);
    if (customReply) {
      clearInterval(typingInterval);
      typingEffect(customReply, botMsgDiv.querySelector(".message-text"), botMsgDiv);
      document.body.classList.remove("bot-responding");
      botMsgDiv.classList.remove("loading");
    } else {
      generateResponse(botMsgDiv);
    }
  }, 600);
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
});


document.querySelector("#delete-chats-btn").addEventListener("click", () => {
  chatHistory.length = 0;
  chatsContainer.innerHTML = "";
  document.body.classList.remove("chats-active", "bot-responding");
});


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
