# LibbyDownloader

---

**HIGH RISK OF ACCOUNT SUSPENSION**

---

The following downloader has not been vetted for scale, use with caution. I have not been banned yet, but very possible that I will be.

Usage:

1. Copy files. `git clone https://github.com/diegotyner/LibbyDownloader`.
2. In your chromium browser, go to `chrome://extensions`. Here, select developer mode and then load unpacked, directing to the libby_extension folder.
3. After the extension is working, turning off "ask where to save each file..." will make using extension much easier (downloads will begin automatically and you won't be prompted for each mp3 snippet). Here is a [guide to turning it off I used](https://lifehacker.com/make-chrome-ask-where-to-save-downloaded-files-by-chang-1790840372). For me on brave it was slightly different, but mostly the same.
4. Navigate to your libby book on browser.
5. Go all the way to the start of the book (can click Table of Contents in the middle of UI to quickly navigate there).
6. Open up the extension, and **reload page** (this step is critical for capturing the first mp3 snippet request).
7. Click `Start Clicking` in the pop up, and keep the page open while it slowly captures network requests.
   - It is intentionally slow to avoid being flagged by Overdrive/Libby. Being flagged could result in account suspension, as many [similar softwares can attest to](https://github.com/PsychedelicPalimpsest/LibbyRip/issues/14)

Enjoy downloads! Soon I'll implement some python software for quickly implementing audiobook metadata. Ignore the `old` folder, those are unused first angles at downloading content.

