# icao-iata-trainer

A simple, game-like ICAO/IATA/CITY trainer with:
- Learn: Enter to check, Enter to go next (results logged in History sidebar)
- Rapid: Sprint 60s / Sprint 30s / Set of 30, with explicit expected answer type (ICAO CODE / IATA CODE / CITY / NAME)
- Map: click on a blank-ish map, shows error + line for 2 seconds, then auto-next (no Next button)
- History sidebar persists until you start a new game
- Scoreboard: GitHub Issues based (no backend)

## Packs
- Global (sample): ships a small sample database in `data/airports.sample.json`
- Wizz Network: uses `data/wizz_network_icao.txt` and intersects with current DB
- Wizz Bases: uses `data/wizz_bases_iata.txt` and intersects with current DB

## Full global dataset
Run GitHub Actions workflow **Build airport data** (manual) or wait for the nightly schedule.
It generates `data/airports.min.json` from OurAirports.

The app automatically prefers `data/airports.min.json` if present, and falls back to `data/airports.sample.json`.
