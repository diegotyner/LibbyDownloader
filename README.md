# LibbyDownloader

---

**HIGH RISK OF ACCOUNT SUSPENSION**

---

The following downloader has not been vetted for scale, use with caution. I have not been banned yet, but very possible that I will be. _Always use in ways that don't associate your account with 'botlike behavior'_ (don't just scrape the book and leave, build good credit by leaving the book running anyway).

## Installation:

1. Copy files in some destination folder. `git clone https://github.com/diegotyner/LibbyDownloader`.
2. In your chromium browser, go to `chrome://extensions`. Here, select developer mode and then load unpacked, directing to the libby_extension folder.
3. After the extension is working, turning off "ask where to save each file..." will make using extension much easier (downloads will begin automatically and you won't be prompted for each mp3 snippet). Here is a [guide to turning it off I used](https://lifehacker.com/make-chrome-ask-where-to-save-downloaded-files-by-chang-1790840372). For me on brave it was slightly different, but mostly the same.

## Usage:

1. Navigate to your libby book on browser.
2. Go all the way to the start of the book (can click Table of Contents in the middle of UI to quickly navigate there).
3. Open up the extension, and clear history (removes cached snippets, ensures good ordering of downloads)
4. **Reload page** (this step is critical for capturing the first mp3 snippet request, otherwise libby won't reset it).
5. Set your desired interval between requests (longer is safer), and click `Start Clicking` in the pop up. Keep the page open while it slowly captures network requests.
   - It is intentionally slow to avoid being flagged by Overdrive/Libby. Being flagged could result in account suspension, as many [similar softwares can attest to](https://github.com/PsychedelicPalimpsest/LibbyRip/issues/14)

Enjoy downloads! Ignore the `old` folder, those are unused first angles at downloading content.

Future directions:

- Software for quickly implementing audiobook metadata.
- Splitting mp3s into chapter tracks, shouldn't be too hard to do based on the Libby table of contents menu.

IMMEDIATE next steps:

- [ ] Add a "passive listening" mode where the auto-clicker is not active
      (remedies the 'skipping snippets' issue). Open questions: audio element
      selector (iframe/shadow DOM?), auto-advance via `ended` event vs fully
      manual, coexist as toggle with click-mode or replace it. `SET_MODE`
      message + `backgroundState.mode` plumbing already in place; content.ts
      logic not started.
- [ ] Build out mode toggle UI in App.tsx (deferred during rewrite; message
      types and background handler exist, popup has no UI for it yet).
- [ ] Live capture/skip log in popup — show a running log of sniffed chapters
      as they happen, e.g. "Just saw snippet 4" → "...2nd time" → "Just saw
      snippet 6". Needs a new background → popup broadcast message (e.g.
      `CHAPTER_SEEN`), fired from `onBeforeRedirect`. Popup needs new local
      state to accumulate the log, not just current counts.
- [ ] Review cover image download: `.jpg`-only extension guard added during
      TS rewrite is a behavior change from v1 (which accepted any URL).
      Confirm Libby only serves `.jpg`, or loosen the check.
- [ ] Decide fate of `DOWNLOAD_FIRST_PART` recovery/retry logic, and whether
      chapter keys need namespacing per book title to avoid collisions.
- [ ] Display on popup current book title
