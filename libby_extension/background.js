const urls = [];
let lastDownloadTime = 0; // To enforce minimum delay between *downloads*
const MIN_DOWNLOAD_DELAY_MS = 5000;

// listening for media requests
// chrome.webRequest.onCompleted.addListener(
//   (details) => {
//     if (details.url.includes("audioclips.cdn.overdrive.com")) {
//       console.log("Caught audio clip URL:", details.url);
//     } else {
//       console.log("Uncaught request:", details.url);
//     }
//   },
//   { urls: ["<all_urls>"] }, // host_permissions must include this
// );

// listening for redirect requests
chrome.webRequest.onBeforeRedirect.addListener(
  (details) => {
    console.log("Redirect detected:");
    // console.log("From: ", details.url);
    // console.log("To: ", details.redirectUrl);
    if (!urls.includes(details.redirectUrl)) {
      urls.push(details.redirectUrl);
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
  chrome.downloads.download(
    {
      url: url,
      filename: filename,
      saveAs: false, // Set to true if you want a save dialog for each file
    },
    (downloadId) => {
      if (chrome.runtime.lastError) {
        console.error(
          `Download failed for ${filename}:`,
          chrome.runtime.lastError.message,
        );
      } else if (downloadId === undefined) {
        console.error(
          `Download failed for ${filename}: downloadId undefined (URL: ${url})`,
        );
      } else {
        console.log(`Download started for ${filename} (ID: ${downloadId}).`);
      }
    },
  );
}

// Export download when finished
// chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
//   if (msg.type === "EXPORT_URLS") {
//     const blob = new Blob([JSON.stringify(urls, null, 2)], {
//       type: "application/json",
//     });
//     const url = URL.createObjectURL(blob);
//     chrome.downloads.download(
//       {
//         url,
//         filename: "libby_urls.json",
//       },
//       () => {
//         if (chrome.runtime.lastError) {
//           console.error("Download error:", chrome.runtime.lastError);
//           sendResponse({
//             status: "download_failed",
//             error: chrome.runtime.lastError.message,
//           });
//         } else {
//           console.log("Download initiated successfully.");
//           URL.revokeObjectURL(url);
//           urls.length = 0; // Resets the array to empty
//           console.log("URLs array cleared.");
//           sendResponse({ status: "download_successful" }); // Inform sender
//         }
//       },
//     );
//   }
// });
