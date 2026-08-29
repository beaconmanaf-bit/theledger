"""
STEP 1a — Match company names to NSE trading symbols (run this ONCE).
v2: understands abbreviated names like "H P C L" and "Kewal Kir.Cloth."

Why this exists:
  Your stocks.json has company NAMES, often heavily abbreviated
  ("H P C L", "Kewal Kir.Cloth."). Price data sources need trading
  SYMBOLS ("HINDPETRO", "KKCL"). This script matches the two by
  recognising that each abbreviated word is a PREFIX of the real
  word in the company's full name — the same way a human reader
  would expand "H P C L" into "Hindustan Petroleum Corp Ltd".

Before running:
  1. Download NSE's official list of listed companies (free, public):
     https://nsearchives.nseindia.com/content/equities/EQUITY_L.csv
     Save it in this same folder as "EQUITY_L.csv".
  2. Install the two packages this needs:
     pip install pandas rapidfuzz

Run it with:
  python match_tickers.py

Output:
  ticker_map.csv — one row per company, with the best-guess symbol
  and a "confidence" score (0-100). Open this in Excel/Sheets and
  fix any row where confidence is below ~80 before moving to Step 1b.
"""

import json
import re
import pandas as pd
from rapidfuzz import fuzz

STOCKS_JSON = "stocks.json"
NSE_LIST = "EQUITY_L.csv"
OUTPUT = "ticker_map.csv"


def tokenize(name: str):
    """Split a name into lowercase word-tokens, splitting on punctuation
    too (so "Kir.Cloth." becomes ["kir", "cloth"], not one blob)."""
    name = name.lower()
    name = re.sub(r'[.\-&,()/]', ' ', name)
    return [t for t in name.split() if t]


def abbrev_score(input_tokens, cand_tokens) -> float:
    """Score how well each input token matches, in order, as a PREFIX
    of some token in the candidate name. Returns 0..1."""
    if not input_tokens:
        return 0.0
    i = 0
    matched = 0
    for tok in input_tokens:
        while i < len(cand_tokens):
            c = cand_tokens[i]
            i += 1
            if tok == c or c.startswith(tok):
                matched += 1
                break
    return matched / len(input_tokens)


def main():
    with open(STOCKS_JSON, "r") as f:
        stocks = json.load(f)
    names = [s["name"] for s in stocks]

    nse = pd.read_csv(NSE_LIST)
    nse.columns = [c.strip() for c in nse.columns]
    nse_names = nse["NAME OF COMPANY"].astype(str).tolist()
    nse_symbols = nse["SYMBOL"].astype(str).tolist()
    nse_tokens = [tokenize(n) for n in nse_names]

    rows = []
    for name in names:
        in_tokens = tokenize(name)

        best_idx, best_score = -1, -1.0
        for idx, cand_tokens in enumerate(nse_tokens):
            score = abbrev_score(in_tokens, cand_tokens)
            if score > best_score:
                best_score, best_idx = score, idx

        # Cross-check with plain fuzzy matching too, and keep whichever
        # method is more confident — belt and braces.
        cleaned_input = " ".join(in_tokens)
        fuzzy_best_idx, fuzzy_best_score = -1, -1.0
        for idx, cand_tokens in enumerate(nse_tokens):
            score = fuzz.token_sort_ratio(cleaned_input, " ".join(cand_tokens)) / 100.0
            if score > fuzzy_best_score:
                fuzzy_best_score, fuzzy_best_idx = score, idx

        if best_score >= fuzzy_best_score:
            chosen_idx, chosen_score = best_idx, best_score
        else:
            chosen_idx, chosen_score = fuzzy_best_idx, fuzzy_best_score

        rows.append({
            "company_name": name,
            "guessed_symbol": nse_symbols[chosen_idx],
            "matched_full_name": nse_names[chosen_idx],
            "confidence": round(chosen_score * 100, 1),
        })

    out = pd.DataFrame(rows).sort_values("confidence")
    out.to_csv(OUTPUT, index=False)

    low_conf = (out["confidence"] < 80).sum()
    print(f"Done. Wrote {len(out)} rows to {OUTPUT}")
    print(f"{low_conf} rows scored below 80 confidence — please review those by hand.")
    print("Open ticker_map.csv, fix the 'guessed_symbol' column where needed, then save.")
    print("The 'matched_full_name' column shows what it matched against, to help you judge each row.")


if __name__ == "__main__":
    main()
