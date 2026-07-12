## Installation

This project is setup with `crxjs/vite-plugin`, in order so that I can used React, Typescript, and Tailwind in my development process.

Bootstrapping:

```
mkdir libby_extension_v2 && cd libby_extension_v2
npm init -y

npm install react react-dom
npm install -D vite typescript @types/chrome @types/react @types/react-dom @crxjs/vite-plugin tailwindcss postcss autoprefixer

npm install tailwindcss @tailwindcss/vite
npm install -D @vitejs/plugin-react
```

### Descriptions

These are my notes for how the browser extension works:

#### Structure:

libby_extension

- manifest.json - The metadata bridge: Describes permissions of extensions, as well as entry point for different scripts
- background.ts : Background workers, handle state and intercepting requests
- content.ts : This script is put into the DOM, and handles chrome extensions 'actions', automating clicks
- App.tsx - The react component that actually controls the popup
- popup.ts - The JS linked to the popup, wiring buttons in HTML to extension actions

#### Messages

##### popup.js -> background.js

**Messages:**

ENABLE_DOWNLOADS / DISABLE_DOWNLOADS / EXPORT_URLS_COMPLETED / DOWNLOAD_FIRST_PART

- Tells bg worker to download / stop downloading when message is sent

GET_STATE

- Quick fetch of state to init the popup

**Responses:**

downloads_enabled / downloads_disabled

state:

- downloadsEnabled, isProcessing, queueSize, urlsCaptured

##### popup.js -> content.js

**Messages:**

START_CLICKING / STOP_CLICKING

- Tells the bot to start/stop paging through the book

**Responses:**

- START: already_active / started
- STOP: stopped / not_active
