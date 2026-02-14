# icao-iata-trainer

A tiny, mobile-friendly airport code trainer that runs on **GitHub Pages**.

Modes:
- **Learn (SRS)** — Again/Hard/Good/Easy spaced repetition
- **Rapid-Fire** — 60-second drill
- **Map Quiz** — blind map (click the airport location)

Packs:
- **Global** (full OurAirports dataset)
- **Wizz Network** (ICAO list)
- **Wizz Bases** (IATA list)

## Data sources & licensing

- Airport dataset is built from **OurAirports airports.csv**, released to the **Public Domain**. citeturn0search0turn0search3
- Map uses **OpenStreetMap** tiles and includes the required attribution. citeturn0search10turn0search16

## Your Wizz lists

- `data/wizz_network_icao.txt` contains **159** ICAO codes (from your `airports.txt`). fileciteturn0file0
- `data/wizz_bases_iata.txt` contains **35** IATA codes (from your `base.txt`). fileciteturn0file1

## First-time setup (GitHub Pages)

1. Create a GitHub repo named `icao-iata-trainer`
2. Upload this project into the repo (see “Upload from phone” below)
3. In the repo: **Settings → Pages**
   - Source: **Deploy from a branch**
   - Branch: **main**
   - Folder: **/(root)**

Open the Pages URL and you’re live.

## Build the full *Global* dataset (one click)

On first upload, the app works immediately for codes, but map/name enrichment needs the full dataset:

- Go to **Actions → Build OurAirports dataset → Run workflow**
- After it finishes, `data/airports.min.json` + `data/packs.json` will be committed automatically.

## Upload from phone (iOS)

### Option A — easiest (recommended): upload the ZIP via mobile browser
The GitHub iOS app is great for browsing/editing, but bulk file uploads are simplest in the mobile web UI.

1. Create the repo in the GitHub app.
2. Open the repo in Safari/Chrome (tap “…” → **Open in Browser**).
3. Tap **Add file → Upload files** and select all files from the extracted ZIP.

### Option B — app-only (minimal): create just `index.html`
If you insist on app-only: you can create files one-by-one (painful).  
Minimum required to see something:
- `index.html`
- `assets/styles.css`
- `assets/app.js` + other JS modules
- `data/airports.sample.json` + `data/packs.json`

(So realistically Option A is the practical phone workflow.)

## Dev notes

- All progress is stored in `localStorage` (no backend).
- Map Quiz renders only the *target* + your click — it stays fast even with global datasets.
