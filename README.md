# ✅ Personal Organiser

A fast capture-first to-do app for work and personal stuff, built as a single
self-contained HTML page — no server, no accounts, no install required (but
installable if you want it).

Type or speak an item, and it's on your list in seconds. The **dashboard**
shows everything by when it was added, plus smarter views for what's actually
due.

## Quick add

- **Type it** in the bar at the bottom, or tap 🎤 and **say it** (uses your
  browser's built-in speech recognition — Chrome/Edge on desktop and Android
  work well; Safari/iOS support is partial, so the mic button hides itself if
  your browser doesn't support it).
- Pick **💼 Work** or **🏠 Personal** with the toggle above the input — it
  remembers your last choice.
- The app parses natural language as you type, and shows you what it picked
  up before you hit add:
  - **Dates** — `today`, `tomorrow`, `tonight`, weekday names (`friday`,
    `next mon`), or `in 3 days` / `in 2 weeks`.
  - **Times** — `3pm`, `at 9:30am`, `15:00`.
  - **Priority** — end with `!` or `!!`, or say `urgent`/`important`, to mark
    it high priority.
  - **Repeats** — `daily`, `weekly`, `monthly` (or `every day` / `every
    week` / `every month`).
  - **Tags** — any `#word` in your text becomes a tag.
  - Example: `"submit expenses friday !! #finance"` → due next Friday, high
    priority, tagged `#finance`.

## Dashboard

- **Today** — everything overdue or due today, overdue items on top.
- **Upcoming** — everything scheduled ahead, plus anything with no date yet.
- **All** — every open item, **newest added first** — the running log of
  what you've thrown at the app, regardless of when it's due.
- **Done** — completed items, most recently finished first.
- A **stats strip** up top: added today, added this week, completed this
  week, and how many are overdue.
- Filter chips (**All / Work / Personal**) narrow any of the views above.
- Items untouched for 5+ days (configurable) get a **"Stuck"** flag, so
  things don't quietly rot in the list.

## Other features

- **Snooze** — bump anything a day with one tap, right from the list.
- **Recurring tasks** — mark daily/weekly/monthly; completing one
  automatically creates the next occurrence.
- **Edit anything** — text, category, priority, due date/time, and repeat,
  from the ✏️ button on any card.
- **Notifications** — optional browser notifications when something becomes
  due, while the app is open (see limitations below).
- **Installable & offline** — served over HTTPS it's a full PWA: "Add to
  Home Screen" gives a real app icon, full-screen launch, and offline support
  via a service worker.
- **Backup** — *Export JSON* downloads everything; *Import JSON* restores it
  (replacing what's currently stored). Or set up Google Sheets sync below for
  an always-up-to-date off-device copy.

## Data & privacy

Your tasks live in your browser's `localStorage` on your device, and — if you
enable it — in your own Google Sheet. Nothing is sent anywhere else.

### A note on multiple devices

Like most localStorage-based apps, each device keeps its own separate list —
there's no account tying them together. The Google Sheets sync (below) is a
**one-way backup**: each device pushes its own copy, replacing what's on the
sheet. If you use the app on more than one device, treat the sheet as a
read-only combined view, and use **Export/Import JSON** to move your list
between devices if you need to.

## Google Sheets sync setup

Push every task to your own Google Sheet automatically — a live backup and a
way to see your list outside the app. Syncs a few seconds after each change.

1. Go to [sheets.new](https://sheets.new) and create a blank spreadsheet.
2. **Extensions → Apps Script**. Delete the placeholder code and paste in the
   full contents of [`google-apps-script/Code.gs`](google-apps-script/Code.gs)
   from this repo. Save.
3. **Deploy → New deployment** → ⚙️ next to "Select type" → **Web app**.
   Set **Execute as: Me**, **Who has access: Anyone**.
4. **Deploy**, approve the permissions prompt (Google will warn the app is
   unverified — click *Advanced → Go to … (unsafe)*; it's your own script
   reading your own sheet), and copy the **Web app URL** (ends in `/exec`).
5. In the app, open **⚙️ Settings → Google Sheets backup**, paste the URL,
   and tap **Save & test**.

Your sheet gets two tabs:

- **Task Log** — one row per task (added, category, text, priority, due
  date, repeat, tags, status, completed date), newest addition on top.
- **Backup** — a full JSON snapshot, chunked across cells. If you ever need
  to restore from it, join the cells in column A into one `.json` file and
  use **Import JSON**.

Note: the `/exec` URL is unguessable but effectively a "write to my sheet"
key — don't share it.

## Running it

It's a single static page — any static host works, or just open
`index.html` directly in a browser. Served over HTTPS, "Add to Home Screen"
gives a real app icon, full-screen launch, and offline support.

## Known limitations

- **Notifications only fire while the app is open** — this is a static page
  with no backend, so there's no server to push a notification when your
  phone's browser is closed. If you need real background reminders, that's
  the next thing to build (would need a small push service).
- **Voice input quality** depends entirely on the browser's built-in speech
  recognition — accuracy varies by browser and accent, and it needs an
  internet connection on most browsers (the recognition itself is often
  cloud-based even though nothing else in the app is).
- **No real multi-device sync** — see the note above.
