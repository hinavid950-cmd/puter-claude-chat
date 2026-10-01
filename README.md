# Claude AI Chat — Puter.js Advanced UI

A modern, full-featured AI chat interface powered by **Puter.js** and **Anthropic Claude**.

![License](https://img.shields.io/badge/license-MIT-blue)
![Puter.js](https://img.shields.io/badge/Puter.js-v2-orange)

## Features

- **Multi-turn conversations** with full chat history
- **Model selector** — Claude Opus 4.5, Sonnet 4.5, 3.7, 3.5, Opus, Haiku
- **Markdown rendering** — code blocks, lists, headers, bold, links
- **Copy & Regenerate** replies
- **Export chat** as Markdown
- **Dark / Light theme**
- **Chat history** saved in localStorage
- **Mobile responsive** with slide-out sidebar
- **Typing indicator** and status feedback
- **Suggestion chips** on empty state

## Quick Start

1. **Clone or download** this repository
2. Open `index.html` in a browser  
   *(or serve it with any static server)*

```bash
# Optional: serve locally
npx serve .
# or
python -m http.server 3000
```

3. The first time you use an AI model, Puter will prompt you to sign in (free).

## Project Structure

```
puter-claude-chat/
├── index.html          # Main page
├── css/
│   └── style.css       # Full dark/light theme styles
├── js/
│   └── app.js          # Chat logic, Puter.ai calls, markdown, storage
└── README.md
```

## How It Works

```js
// Puter.js handles auth + AI calls for you
puter.ai.chat(messagesArray, {
  model: "anthropic/claude-opus-4-5"
}).then(response => {
  // response.message.content contains the reply
});
```

No API keys needed on your side — Puter manages authentication and billing.

## Customization

| What | Where |
|------|-------|
| Default model | `index.html` → `<select id="model-select">` |
| Colors / theme | `css/style.css` → `:root` variables |
| Suggestion prompts | `index.html` → `.suggestion` buttons |
| Markdown rules | `js/app.js` → `renderMarkdown()` |

## Deploy

- **GitHub Pages**: push to a repo → Settings → Pages → Deploy from branch
- **Netlify / Vercel**: drag & drop the folder
- **Any static host**: just upload the files

## License

MIT — free to use, modify, and share.
