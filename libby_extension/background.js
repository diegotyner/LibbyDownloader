const urls = [];
const undownloaded_urls_queue = [];
let lastDownloadTime = 0; // To enforce minimum delay between *downloads*
const MIN_DOWNLOAD_DELAY_MS = 5000;
let downloadsEnabled = false;
let isProcessingQueue = false;

// listening for redirect requests
chrome.webRequest.onBeforeRedirect.addListener(
  (details) => {
    console.log("Redirect detected:");
    // console.log("From: ", details.url);
    // console.log("To: ", details.redirectUrl);

    if (!urls.includes(details.redirectUrl)) {
      urls.push(details.redirectUrl);
      console.log("Redirect is new:");

      if (!downloadsEnabled) {
        console.log("Redirect detected, but downloads are paused."); // Optional: for debugging
        undownloaded_urls_queue.push(details.redirectUrl);
        return; // Exit early if downloads are not enabled
      }
      const filename = `libby_${(urls.length - 1).toString().padStart(3, "0")}.mp3`;
      const currentUrl = details.redirectUrl;

      const now = Date.now();
      const timeSinceLastDownload = now - lastDownloadTime;
      const delayNeeded = MIN_DOWNLOAD_DELAY_MS - timeSinceLastDownload;

      if (delayNeeded > 0) {
        console.log(`Delaying download of ${filename} by ${delayNeeded}ms.`);
        setTimeout(() => {
          initiateSingleDownload(currentUrl, filename);
          lastDownloadTime = Date.now(); // Update time after initiating download
        }, delayNeeded);
      } else {
        initiateSingleDownload(currentUrl, filename);
        lastDownloadTime = now; // Update time immediately
      }
    }
    console.log(urls);
  },
  {
    urls: ["*://*.listen.overdrive.com/*"],
  },
);

function initiateSingleDownload(url, filename) {
  return new Promise((resolve, reject) => {
    // Make this return a Promise
    chrome.downloads.download(
      {
        url: url,
        filename: filename,
        saveAs: false,
      },
      (downloadId) => {
        if (chrome.runtime.lastError) {
          console.error(
            `Download failed for ${filename}:`,
            chrome.runtime.lastError.message,
          );
          reject(chrome.runtime.lastError.message);
        } else if (downloadId === undefined) {
          console.error(
            `Download failed for ${filename}: downloadId undefined (URL: ${url})`,
          );
          reject("Download ID undefined");
        } else {
          console.log(`Download started for ${filename} (ID: ${downloadId}).`);
          resolve(); // Resolve the promise on successful initiation
        }
      },
    );
  });
}

// NEW: Async function to process the undownloaded_urls_queue sequentially
async function processDownloadQueue() {
  if (isProcessingQueue) {
    console.log("Download queue already being processed.");
    return;
  }
  isProcessingQueue = true; // Set flag to prevent re-entry

  while (undownloaded_urls_queue.length > 0 && downloadsEnabled) {
    const currentUrl = undownloaded_urls_queue.shift(); // Get and remove the first URL from the queue

    const urlIndex = urls.indexOf(currentUrl);
    const filename = `libby_${(urlIndex !== -1 ? urlIndex : urls.length).toString().padStart(3, "0")}.mp3`;

    console.log(
      `Processing queue: Attempting to download ${filename} from ${currentUrl}`,
    );

    const now = Date.now();
    const timeSinceLastDownload = now - lastDownloadTime;
    const delayNeeded = MIN_DOWNLOAD_DELAY_MS - timeSinceLastDownload;

    if (delayNeeded > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayNeeded));
    }

    try {
      await initiateSingleDownload(currentUrl, filename);
      lastDownloadTime = Date.now(); // Update time after initiating download
    } catch (error) {
      console.error(
        `Failed to download from queue: ${currentUrl}, Error: ${error}`,
      );
      // Decide whether to continue or stop on error
    }

    // Add a delay AFTER each download initiation, not just before the next one
    if (undownloaded_urls_queue.length > 0 && downloadsEnabled) {
      await new Promise((resolve) =>
        setTimeout(resolve, MIN_DOWNLOAD_DELAY_MS),
      );
    }
  }
  isProcessingQueue = false;
  if (!downloadsEnabled) {
    console.log(
      "Download queue processing paused because downloads were disabled.",
    );
  } else {
    console.log("Download queue processing complete.");
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "ENABLE_DOWNLOADS") {
    downloadsEnabled = true;
    console.log("Downloads enabled.");
    // Start processing the queue only if it's not already running
    processDownloadQueue(); // NEW: Call the queue processing function

    sendResponse({
      status: "downloads_enabled",
      queue_size: undownloaded_urls_queue.length,
    });
  } else if (
    request.type === "DISABLE_DOWNLOADS" ||
    request.type === "EXPORT_URLS_COMPLETE"
  ) {
    downloadsEnabled = false;
    console.log("Downloads disabled.");
    // If the queue is processing, this flag will eventually stop it.
    // If you need immediate halt, you'd need to manage promises/timeouts more aggressively.
    sendResponse({ status: "downloads_disabled" });
  }
  return true;
});
