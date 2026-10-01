/**
 * Claude AI Chat — Puter.js Advanced UI
 * ======================================
 * Features: multi-chat history, model selector, markdown rendering,
 * copy/regenerate, theme toggle, localStorage persistence, export.
 */

(() => {
  "use strict";

  // ---------- State ----------
  let chats = JSON.parse(localStorage.getItem("puter-chats") || "[]");
  let currentChatId = localStorage.getItem("puter-current-chat") || null;
  let isGenerating = false;
  let abortController = null;

  // ---------- DOM ----------
  const $ = (sel) => document.querySelector(sel);
  const messagesEl = $("#messages");
  const inputEl = $("#user-input");
  const sendBtn = $("#btn-send");
  const modelSelect = $("#model-select");
  const modelBadge = $("#model-badge");
  const chatTitle = $("#chat-title");
  const statusEl = $("#status");
  const welcomeEl = $("#welcome");
  const historyEl = $("#chat-history");
  const sidebar = $("#sidebar");
  const overlay = $("#overlay");

  // ---------- Helpers ----------
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function save() {
    localStorage.setItem("puter-chats", JSON.stringify(chats));
    localStorage.setItem("puter-current-chat", currentChatId || "");
  }

  function getCurrentChat() {
    return chats.find((c) => c.id === currentChatId) || null;
  }

  function setStatus(text, type = "") {
    statusEl.textContent = text;
    statusEl.className = "status" + (type ? ` ${type}` : "");
  }

  function autoResize() {
    inputEl.style.height = "auto";
    inputEl.style.height = Math.min(inputEl.scrollHeight, 160) + "px";
  }

  // Simple markdown → HTML (no external lib needed)
  function renderMarkdown(text) {
    if (!text) return "";

    // Escape HTML first
    let html = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    // Code blocks ```
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
      return `<pre><code class="language-${lang}">${code.trim()}</code></pre>`;
    });

    // Inline code
    html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

    // Bold **text**
    html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

    // Italic *text*
    html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");

    // Headers
    html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
    html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
    html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");

    // Links [text](url)
    html = html.replace(
      /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener">$1</a>'
    );

    // Blockquotes
    html = html.replace(/^&gt; (.+)$/gm, "<blockquote>$1</blockquote>");

    // Unordered lists
    html = html.replace(/^- (.+)$/gm, "<li>$1</li>");
    html = html.replace(/(<li>.*<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`);

    // Ordered lists
    html = html.replace(/^\d+\. (.+)$/gm, "<li>$1</li>");

    // Paragraphs (split by double newline)
    html = html
      .split(/\n{2,}/)
      .map((block) => {
        if (
          block.startsWith("<h") ||
          block.startsWith("<pre") ||
          block.startsWith("<ul") ||
          block.startsWith("<ol") ||
          block.startsWith("<blockquote")
        ) {
          return block;
        }
        return `<p>${block.replace(/\n/g, "<br>")}</p>`;
      })
      .join("");

    return html;
  }

  // ---------- Chat Management ----------
  function createChat(title = "New Chat") {
    const chat = {
      id: uid(),
      title,
      model: modelSelect.value,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    chats.unshift(chat);
    currentChatId = chat.id;
    save();
    renderHistory();
    renderMessages();
    return chat;
  }

  function switchChat(id) {
    currentChatId = id;
    save();
    renderHistory();
    renderMessages();
    closeSidebar();
  }

  function deleteChat(id) {
    chats = chats.filter((c) => c.id !== id);
    if (currentChatId === id) {
      currentChatId = chats.length ? chats[0].id : null;
    }
    save();
    renderHistory();
    renderMessages();
  }

  function clearAllChats() {
    if (!confirm("Delete all chats? This cannot be undone.")) return;
    chats = [];
    currentChatId = null;
    save();
    renderHistory();
    renderMessages();
  }

  // ---------- Render ----------
  function renderHistory() {
    historyEl.innerHTML = "";
    if (!chats.length) {
      historyEl.innerHTML =
        '<p style="padding:12px;color:var(--text-muted);font-size:0.85rem;">No chats yet</p>';
      return;
    }
    chats.forEach((chat) => {
      const el = document.createElement("div");
      el.className = "history-item" + (chat.id === currentChatId ? " active" : "");
      el.innerHTML = `
        <span style="flex:1;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(chat.title)}</span>
        <button class="delete-chat" title="Delete">✕</button>
      `;
      el.addEventListener("click", (e) => {
        if (e.target.classList.contains("delete-chat")) {
          e.stopPropagation();
          deleteChat(chat.id);
        } else {
          switchChat(chat.id);
        }
      });
      historyEl.appendChild(el);
    });
  }

  function renderMessages() {
    const chat = getCurrentChat();
    messagesEl.innerHTML = "";

    if (!chat || !chat.messages.length) {
      messagesEl.appendChild(welcomeEl);
      welcomeEl.style.display = "flex";
      chatTitle.textContent = "New Chat";
      return;
    }

    welcomeEl.style.display = "none";
    chatTitle.textContent = chat.title;
    modelBadge.textContent = modelLabel(chat.model || modelSelect.value);

    chat.messages.forEach((msg, idx) => {
      messagesEl.appendChild(createMessageEl(msg, idx));
    });

    scrollToBottom();
  }

  function createMessageEl(msg, idx) {
    const div = document.createElement("div");
    div.className = `message ${msg.role}`;
    div.dataset.index = idx;

    const avatar = msg.role === "user" ? "You" : "✦";
    const roleLabel = msg.role === "user" ? "You" : "Claude";

    div.innerHTML = `
      <div class="message-avatar">${avatar}</div>
      <div class="message-body">
        <div class="message-role">${roleLabel}</div>
        <div class="message-content">${
          msg.role === "assistant" ? renderMarkdown(msg.content) : escapeHtml(msg.content).replace(/\n/g, "<br>")
        }</div>
        ${
          msg.role === "assistant"
            ? `<div class="message-actions">
                <button data-action="copy">Copy</button>
                <button data-action="regenerate">Regenerate</button>
              </div>`
            : ""
        }
      </div>
    `;

    // Action buttons
    div.querySelectorAll("[data-action]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const action = btn.dataset.action;
        if (action === "copy") {
          navigator.clipboard.writeText(msg.content).then(() => {
            btn.textContent = "Copied!";
            setTimeout(() => (btn.textContent = "Copy"), 1500);
          });
        } else if (action === "regenerate") {
          regenerate(idx);
        }
      });
    });

    return div;
  }

  function addTypingIndicator() {
    const div = document.createElement("div");
    div.className = "message assistant";
    div.id = "typing-indicator";
    div.innerHTML = `
      <div class="message-avatar">✦</div>
      <div class="message-body">
        <div class="message-role">Claude</div>
        <div class="typing"><span></span><span></span><span></span></div>
      </div>
    `;
    messagesEl.appendChild(div);
    scrollToBottom();
  }

  function removeTypingIndicator() {
    const el = $("#typing-indicator");
    if (el) el.remove();
  }

  function scrollToBottom() {
    requestAnimationFrame(() => {
      messagesEl.scrollTop = messagesEl.scrollHeight;
    });
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function modelLabel(value) {
    const opt = modelSelect.querySelector(`option[value="${value}"]`);
    return opt ? opt.textContent : value;
  }

  // ---------- AI Call ----------
  async function sendMessage(text) {
    if (!text.trim() || isGenerating) return;

    // Ensure we have a chat
    let chat = getCurrentChat();
    if (!chat) {
      chat = createChat(text.slice(0, 40) + (text.length > 40 ? "…" : ""));
    }

    // Hide welcome
    if (welcomeEl.parentNode) welcomeEl.style.display = "none";

    // Add user message
    chat.messages.push({ role: "user", content: text.trim() });
    chat.updatedAt = Date.now();

    // Update title if first message
    if (chat.messages.length === 1) {
      chat.title = text.slice(0, 40) + (text.length > 40 ? "…" : "");
      chatTitle.textContent = chat.title;
    }

    save();
    renderMessages();
    renderHistory();

    // Prepare for AI
    isGenerating = true;
    sendBtn.disabled = true;
    inputEl.value = "";
    autoResize();
    setStatus("Thinking…");
    addTypingIndicator();

    const model = modelSelect.value;
    chat.model = model;
    modelBadge.textContent = modelLabel(model);

    try {
      // Build conversation history for context
      const history = chat.messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      // Puter.ai.chat supports a messages array for multi-turn
      const response = await puter.ai.chat(history, {
        model,
        stream: false,
      });

      removeTypingIndicator();

      // Extract content (Puter returns different shapes depending on version)
      let content = "";
      if (typeof response === "string") {
        content = response;
      } else if (response?.message?.content) {
        content = response.message.content;
      } else if (response?.content) {
        content = response.content;
      } else if (response?.text) {
        content = response.text;
      } else {
        content = JSON.stringify(response, null, 2);
      }

      chat.messages.push({ role: "assistant", content });
      chat.updatedAt = Date.now();
      save();
      renderMessages();
      renderHistory();
      setStatus("Done", "success");
      setTimeout(() => setStatus(""), 2000);
    } catch (err) {
      removeTypingIndicator();
      console.error(err);
      const errMsg = err?.message || String(err);
      setStatus("Error: " + errMsg, "error");

      // Show error in chat
      chat.messages.push({
        role: "assistant",
        content: `⚠️ **Error**: ${errMsg}\n\nMake sure you are signed in to Puter and have access to the selected model.`,
      });
      save();
      renderMessages();
    } finally {
      isGenerating = false;
      sendBtn.disabled = !inputEl.value.trim();
    }
  }

  async function regenerate(assistantIdx) {
    const chat = getCurrentChat();
    if (!chat || isGenerating) return;

    // Find the user message that preceded this assistant reply
    // assistantIdx is the index in the messages array
    // We remove the assistant message and resend from the previous user message
    if (assistantIdx < 1) return;

    // Keep messages up to (but not including) the assistant message
    const userMsg = chat.messages[assistantIdx - 1];
    if (userMsg.role !== "user") return;

    chat.messages = chat.messages.slice(0, assistantIdx);
    save();
    renderMessages();

    // Re-trigger generation (without adding another user message)
    isGenerating = true;
    sendBtn.disabled = true;
    setStatus("Regenerating…");
    addTypingIndicator();

    const model = modelSelect.value;

    try {
      const history = chat.messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const response = await puter.ai.chat(history, {
        model,
        stream: false,
      });

      removeTypingIndicator();

      let content = "";
      if (typeof response === "string") {
        content = response;
      } else if (response?.message?.content) {
        content = response.message.content;
      } else if (response?.content) {
        content = response.content;
      } else if (response?.text) {
        content = response.text;
      } else {
        content = JSON.stringify(response, null, 2);
      }

      chat.messages.push({ role: "assistant", content });
      chat.updatedAt = Date.now();
      save();
      renderMessages();
      setStatus("Done", "success");
      setTimeout(() => setStatus(""), 2000);
    } catch (err) {
      removeTypingIndicator();
      setStatus("Error: " + (err?.message || err), "error");
      chat.messages.push({
        role: "assistant",
        content: `⚠️ **Error**: ${err?.message || err}`,
      });
      save();
      renderMessages();
    } finally {
      isGenerating = false;
      sendBtn.disabled = !inputEl.value.trim();
    }
  }

  // ---------- Export ----------
  function exportChat() {
    const chat = getCurrentChat();
    if (!chat || !chat.messages.length) {
      setStatus("Nothing to export", "error");
      return;
    }

    let md = `# ${chat.title}\n\n`;
    md += `**Model:** ${modelLabel(chat.model)}\n`;
    md += `**Date:** ${new Date(chat.createdAt).toLocaleString()}\n\n---\n\n`;

    chat.messages.forEach((m) => {
      md += `### ${m.role === "user" ? "You" : "Claude"}\n\n${m.content}\n\n`;
    });

    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${chat.title.replace(/[^a-z0-9]/gi, "_").slice(0, 40)}.md`;
    a.click();
    URL.revokeObjectURL(url);
    setStatus("Exported!", "success");
    setTimeout(() => setStatus(""), 2000);
  }

  // ---------- Theme ----------
  function toggleTheme() {
    const current = document.documentElement.getAttribute("data-theme");
    const next = current === "light" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("puter-theme", next);
    $("#theme-icon").textContent = next === "light" ? "☀️" : "🌙";
  }

  function loadTheme() {
    const saved = localStorage.getItem("puter-theme") || "dark";
    document.documentElement.setAttribute("data-theme", saved);
    $("#theme-icon").textContent = saved === "light" ? "☀️" : "🌙";
  }

  // ---------- Sidebar (mobile) ----------
  function openSidebar() {
    sidebar.classList.add("open");
    overlay.classList.add("active");
  }

  function closeSidebar() {
    sidebar.classList.remove("open");
    overlay.classList.remove("active");
  }

  // ---------- Events ----------
  inputEl.addEventListener("input", () => {
    autoResize();
    sendBtn.disabled = !inputEl.value.trim() || isGenerating;
  });

  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!sendBtn.disabled) sendMessage(inputEl.value);
    }
  });

  sendBtn.addEventListener("click", () => sendMessage(inputEl.value));

  modelSelect.addEventListener("change", () => {
    modelBadge.textContent = modelLabel(modelSelect.value);
    const chat = getCurrentChat();
    if (chat) {
      chat.model = modelSelect.value;
      save();
    }
  });

  $("#btn-new-chat").addEventListener("click", () => {
    createChat();
    closeSidebar();
    inputEl.focus();
  });

  $("#btn-clear-all").addEventListener("click", clearAllChats);
  $("#btn-theme").addEventListener("click", toggleTheme);
  $("#btn-export").addEventListener("click", exportChat);
  $("#btn-menu").addEventListener("click", openSidebar);
  overlay.addEventListener("click", closeSidebar);

  // Suggestion chips
  document.querySelectorAll(".suggestion").forEach((btn) => {
    btn.addEventListener("click", () => {
      sendMessage(btn.dataset.prompt);
    });
  });

  // ---------- Init ----------
  loadTheme();
  renderHistory();

  if (currentChatId && getCurrentChat()) {
    renderMessages();
  } else if (chats.length) {
    currentChatId = chats[0].id;
    save();
    renderMessages();
  } else {
    renderMessages(); // shows welcome
  }

  // Sync model select with current chat
  const chat = getCurrentChat();
  if (chat?.model) {
    modelSelect.value = chat.model;
    modelBadge.textContent = modelLabel(chat.model);
  }
})();
