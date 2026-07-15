These are my notes for how the browser extension works:

#### Structure:

libby_extension

- manifest.json - The metadata bridge: Describes permissions of extensions, as well as entry point for different scripts
- background.js : Background workers, handle state and intercepting requests
- content.js : This script is put into the DOM, and handles chrome extensions 'actions', automating clicks
- popup.html - The html for the actual popup
- popup.js - The JS linked to the popup, wiring buttons in HTML to extension actions

#### Messages

##### popup.js -> background.js

**Messages:**

ENABLE_DOWNLOADS / DISABLE_DOWNLOADS / EXPORT_URLS_COMPLETED

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
