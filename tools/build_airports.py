#!/usr/bin/env python3
import csv, json, os, re, sys, urllib.request, datetime
from pathlib import Path

OURAIRPORTS_CSV_URL = os.environ.get("OURAIRPORTS_CSV_URL", "https://ourairports.com/data/airports.csv")

REPO_ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = REPO_ROOT / "data"

WIZZ_ICAO_FILE = DATA_DIR / "wizz_network_icao.txt"
WIZZ_BASE_IATA_FILE = DATA_DIR / "wizz_bases_iata.txt"

OUT_JSON = DATA_DIR / "airports.min.json"
OUT_PACKS = DATA_DIR / "packs.json"

def read_codes(path: Path):
    codes=[]
    if not path.exists():
        return codes
    for line in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        c = re.sub(r"[^A-Z0-9]", "", line.strip().upper())
        if c:
            codes.append(c)
    seen=set(); out=[]
    for c in codes:
        if c not in seen:
            seen.add(c); out.append(c)
    return out

def download(url: str, dest: Path):
    dest.parent.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(url, headers={"User-Agent":"icao-iata-trainer/1.0"})
    with urllib.request.urlopen(req, timeout=60) as r:
        dest.write_bytes(r.read())

def to_float(x):
    try:
        return float(x)
    except Exception:
        return None

def main():
    wizz_icao = set(read_codes(WIZZ_ICAO_FILE))
    wizz_base_iata = set(read_codes(WIZZ_BASE_IATA_FILE))

    tmp = DATA_DIR / "_ourairports_airports.csv"
    print(f"Downloading OurAirports airports.csv from {OURAIRPORTS_CSV_URL}")
    download(OURAIRPORTS_CSV_URL, tmp)

    airports=[]
    with tmp.open("r", encoding="utf-8", errors="ignore", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            ident = (row.get("ident") or "").strip().upper()
            iata = (row.get("iata_code") or "").strip().upper() or None

            # OurAirports: ident can be ICAO (often 4 chars), or other local ids.
            icao = ident if re.fullmatch(r"[A-Z0-9]{4}", ident or "") else None

            if not icao and not iata:
                continue

            name = (row.get("name") or "").strip() or None
            city = (row.get("municipality") or "").strip() or None
            country = (row.get("iso_country") or "").strip().upper() or None
            lat = to_float(row.get("latitude_deg"))
            lon = to_float(row.get("longitude_deg"))

            tags=[]
            if icao and icao in wizz_icao:
                tags.append("wizz-network")
            if iata and iata in wizz_base_iata:
                tags.append("wizz-base")

            airports.append({
                "icao": icao,
                "iata": iata,
                "name": name,
                "city": city,
                "country": country,
                "lat": lat,
                "lon": lon,
                "tags": tags
            })

    ds = {
        "generatedAt": datetime.datetime.utcnow().replace(microsecond=0).isoformat()+"Z",
        "source": "OurAirports airports.csv (public domain)",
        "airports": airports
    }

    OUT_JSON.write_text(json.dumps(ds, ensure_ascii=False, separators=(",",":"))+"\n", encoding="utf-8")

    packs = {
        "packs": [
            {"id":"global","name":"Global (all airports)","description":"All airports from OurAirports airports.csv","filter":"all"},
            {"id":"wizz-network","name":"Wizz Network (ICAO list)","description":f"Matches your airports.txt list (ICAO). Count: {sum('wizz-network' in a.get('tags',[]) for a in airports)}","filter":"tag:wizz-network"},
            {"id":"wizz-bases","name":"Wizz Bases (IATA list)","description":f"Matches your base.txt list (IATA). Count: {sum('wizz-base' in a.get('tags',[]) for a in airports)}","filter":"tag:wizz-base"},
        ]
    }
    OUT_PACKS.write_text(json.dumps(packs, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")

    print(f"Wrote {OUT_JSON} with {len(airports)} airports")
    print(f"Wrote {OUT_PACKS}")

if __name__ == "__main__":
    main()
