"""
STEP 1a — Match company names to NSE trading symbols (run this ONCE).

Why this exists:
  Your stocks.json has company NAMES ("Colgate-Palmolive (India)").
  Price data sources need trading SYMBOLS ("COLPAL").
  This script matches the two automatically, and flags anything it's
  not confident about so you can fix it by hand in a spreadsheet.

Before running:
  1. Download NSE's official list of listed companies (free, public):
     https://nsearchives.nseindia.com/content/equity/EQUITY_L.csv
     Save it in this same folder as "EQUITY_L.csv".
  2. Install the two packages this needs:
     pip install pandas rapidfuzz

Run it with:
  python match_tickers.py

Output:
  ticker_map.csv — one row per company, with the best-guess symbol
  and a "confidence" score. Open this in Excel/Sheets and fix any
  row where confidence is below ~90 before moving to Step 1b.
"""

import json
import pandas as pd
from rapidfuzz import process, fuzz

STOCKS_JSON = "stocks.json"
NSE_LIST = "EQUITY_L.csv"
OUTPUT = "ticker_map.csv"


def clean_name(name: str) -> str:
    """Strip common suffixes that make matching harder."""
    junk = [
        " limited", " ltd.", " ltd", " (india)", " india", " incorporated",
        " inc.", " inc", " corporation", " corp.", " corp", " pvt",
        " private", " co.", " co ", "&", ",",
    ]
    n = f" {name.lower()} "
    for j in junk:
        n = n.replace(j, " ")
    return " ".join(n.split())


def main():
    with open(STOCKS_JSON, "r") as f:
        stocks = json.load(f)
    names = [s["name"] for s in stocks]

    nse = pd.read_csv(NSE_LIST)
    nse.columns = [c.strip() for c in nse.columns]
    # NSE's file has columns like SYMBOL, NAME OF COMPANY
    nse_names = nse["NAME OF COMPANY"].astype(str).tolist()
    nse_symbols = nse["SYMBOL"].astype(str).tolist()
    nse_clean_to_symbol = {
        clean_name(n): s for n, s in zip(nse_names, nse_symbols)
    }
    choices = list(nse_clean_to_symbol.keys())

    rows = []
    for name in names:
        cleaned = clean_name(name)
        match, score, _ = process.extractOne(
            cleaned, choices, scorer=fuzz.token_sort_ratio
        )
        symbol = nse_clean_to_symbol[match]
        rows.append({
            "company_name": name,
            "guessed_symbol": symbol,
            "confidence": round(score, 1),
        })

    out = pd.DataFrame(rows).sort_values("confidence")
    out.to_csv(OUTPUT, index=False)

    low_conf = (out["confidence"] < 90).sum()
    print(f"Done. Wrote {len(out)} rows to {OUTPUT}")
    print(f"{low_conf} rows scored below 90 confidence — please review those by hand.")
    print("Open ticker_map.csv, fix the 'guessed_symbol' column where needed, then save.")


if __name__ == "__main__":
    main()
