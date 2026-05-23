# Switzerland Trip Tracker

A shared expense tracker PWA for three people travelling together. Expenses entered on any device sync to a shared Google Sheet in real time.

## Features

- Add, edit, and delete expenses in INR or CHF
- Automatic CHF → INR conversion at a configurable rate
- Budget ring gauge showing overall spend vs. budget
- Per-category spend bars with warning thresholds
- Shared Google Sheets backend — all three users stay in sync
- Works offline; syncs when back online
- Installable as a home screen app (PWA) on iOS and Android

## Tech Stack

- **Frontend** — React 18 (CDN), JSX via Babel standalone, vanilla CSS
- **Backend** — Google Apps Script deployed as a Web App
- **Storage** — Google Sheets (server), localStorage (offline cache)
- **Hosting** — GitHub Pages, deployed via GitHub Actions
- **PWA** — Service Worker + Web App Manifest

## Getting Started

### Prerequisites

- A Google account with a Google Sheet set up (see Sheet structure below)
- Google Apps Script deployed as a Web App ([setup instructions](Code.gs))
- A GitHub account with the repo set to public

### Sheet Structure

The Google Sheet needs three tabs:

| Tab | Purpose |
|-----|---------|
| `Sheet1` | Budget categories — columns: Category, Category Type (Fixed/Variable), Budgeted Amount, Comments, Actual Amount |
| `Expenses` | Auto-created by the app on first write |
| `Settings` | Auto-created by the app on first write |

### Local Development

```bash
git clone https://github.com/YOUR_USERNAME/exp-tracker.git
cd exp-tracker
```

Edit `index.html` and set the real values:
```js
window.TRACKER_API_URL = 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec';
window.TRACKER_SECRET  = 'your-secret-here';
```

Then serve locally:
```bash
python3 -m http.server 8080
```

> **Important:** Do not commit `index.html` with real values. Run `git update-index --skip-worktree index.html` after editing to prevent accidental commits.

### Deployment

Secrets are injected at deploy time via GitHub Actions and are never stored in the repository.

1. Add two secrets in **GitHub repo → Settings → Secrets and variables → Actions**:
   - `TRACKER_API_URL` — your Apps Script Web App URL
   - `TRACKER_SECRET` — a random secret string (generate with `python3 -c "import secrets; print(secrets.token_urlsafe(24))"`)

2. Set the same secret in **Apps Script → Project Settings → Script Properties**:
   - Key: `TRACKER_SECRET`, Value: same string as above

3. Enable **GitHub Pages** with source set to **GitHub Actions** (repo Settings → Pages)

4. Push to `main` — GitHub Actions deploys automatically

### Installing on Mobile

Open the GitHub Pages URL in Safari (iOS) or Chrome (Android) → tap the share/menu button → **Add to Home Screen**.

## Project Structure

```
├── index.html              # Entry point — loads scripts, wires React root
├── store.js                # State management, Google Sheets sync, localStorage cache
├── compass-app.jsx         # Main UI — dashboard, add expense, history
├── tweaks-panel.jsx        # Settings drawer (CHF rate, warning threshold)
├── Code.gs                 # Google Apps Script backend (lives in Apps Script, not deployed via git)
├── sw.js                   # Service worker for offline caching
├── manifest.json           # PWA manifest
├── .github/
│   └── workflows/
│       └── deploy.yml      # GitHub Actions deploy pipeline
└── HOW_IT_WORKS.md         # Full codebase walkthrough for developers
```

## Documentation

For a detailed explanation of how every file works, the full data flow, and the security model, see **[HOW_IT_WORKS.md](HOW_IT_WORKS.md)**.

## License

Private — for personal use by Asha, Ajit & Nishant.
