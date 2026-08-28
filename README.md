# The Ledger — Live Price Setup (Step 1)

This turns your screener from a one-time snapshot into something that
updates its prices automatically, once a day, forever — with no
server to pay for or maintain.

You don't need to understand every line of code below. You just need
to follow the steps in order, once. After that, it runs itself.

---

## What's in this folder

| File | What it's for |
|---|---|
| `index.html` | Your screener app (same one as before, now loads live data) |
| `stocks.json` | The data file the app reads — this gets rewritten daily |
| `match_tickers.py` | One-time script: matches company names to stock symbols |
| `refresh_prices.py` | The daily script: fetches new prices |
| `.github/workflows/daily-refresh.yml` | Tells GitHub to run the script every day automatically |
| `requirements.txt` | List of Python add-ons the scripts need |

---

## Part A — One-time setup (do this once)

### A1. Create a new GitHub repository
1. Go to github.com, click the **+** in the top right → **New repository**.
2. Name it something like `the-ledger`. Make it **Public** (needed for free GitHub Pages hosting).
3. Click **Create repository**.

### A2. Upload this whole folder to that repository
The easiest way if you're not comfortable with git commands:
1. On your new repo's page, click **"uploading an existing file"**.
2. Drag in every file from this folder — **including the hidden `.github` folder**. If GitHub's uploader doesn't show hidden folders from your drag-and-drop, use **GitHub Desktop** (a free app) instead: open it, "Add local repository," point it at this folder, and click "Publish repository."

### A3. Turn on GitHub Pages (this makes your app a live website)
1. In your repo, go to **Settings → Pages**.
2. Under "Branch," choose `main` and `/ (root)`, then **Save**.
3. GitHub gives you a URL like `https://yourname.github.io/the-ledger/` — that's your live app.

### A4. Match company names to stock symbols (one-time)
This step needs to run somewhere with internet access — your own
computer is easiest.
1. Install Python if you don't have it (python.org — the installer is
   a normal "next, next, finish" process).
2. Download NSE's official company list:
   https://nsearchives.nseindia.com/content/equity/EQUITY_L.csv
   Save it into this same folder as `EQUITY_L.csv`.
3. Open a terminal / command prompt in this folder and run:
   ```
   pip install -r requirements.txt
   python match_tickers.py
   ```
4. This creates `ticker_map.csv`. Open it in Excel or Google Sheets.
   Most rows will already be correct. Check any row where the
   "confidence" column is below ~90 and fix the symbol by hand if needed —
   you can look up the correct symbol on nseindia.com by searching the
   company name.
5. Upload `ticker_map.csv` to your GitHub repo too (same drag-and-drop as A2).

That's the only manual review step in the whole system. Everything after this is automatic.

---

## Part B — Let it run itself

Once `ticker_map.csv` is in your repo, GitHub will automatically run
`refresh_prices.py` every weekday at 6:00 PM IST, using the schedule
already set up in `daily-refresh.yml`. Each run:
- fetches the latest price for every matched company
- updates `stocks.json` in your repo
- your live app at the GitHub Pages URL shows the new numbers next time it loads

### To test it right now instead of waiting until 6 PM:
1. In your repo, click the **Actions** tab.
2. Click **"Daily price refresh"** in the left sidebar.
3. Click **Run workflow** → **Run workflow** (green button).
4. Wait a minute, refresh the page — you should see a green checkmark.
5. Open your live app URL — prices should now be updated.

---

## What this does NOT do yet (on purpose)

- It does not refresh fundamentals (ROCE, growth, debt, PEG, Potential
  Score) — those only change quarterly, so they're a separate, smaller
  task for later.
- It does not add candlestick charts yet — that's Step 2, once this
  foundation is working reliably.
- It does not place trades or touch anyone's money — this is a
  read-only data screener, same as before.

## If something breaks

- **App shows a red error about stocks.json** — you're probably
  opening `index.html` directly from your computer instead of through
  the GitHub Pages URL. Browsers block that for security reasons; the
  GitHub Pages URL doesn't have this problem.
- **GitHub Action shows a red X** — click into it to see the error
  log. The most common cause is `ticker_map.csv` missing from the repo,
  or a company's symbol being wrong in that file.
