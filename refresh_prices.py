"""
STEP 1b — Daily price refresh (this is the script that runs automatically).

What it does:
  1. Reads ticker_map.csv (built once in Step 1a) to know each company's
     trading symbol.
  2. Fetches today's latest price and 52-week high for each symbol.
  3. Updates price, market cap (scaled from the price change), and
     "distance from 52-week high" in stocks.json.
  4. Leaves every fundamental (ROCE, growth, debt, PEG, Potential Score)
     untouched — those only change when a company reports results,
     so this script doesn't touch them.

This is meant to be run by GitHub Actions on a schedule (see
.github/workflows/daily-refresh.yml), but you can also run it by hand:

  pip install pandas yfinance
  python refresh_prices.py
"""

import json
import time
import pandas as pd
import yfinance as yf

STOCKS_JSON = "stocks.json"
TICKER_MAP = "ticker_map.csv"


def load_ticker_map():
    df = pd.read_csv(TICKER_MAP)
    return dict(zip(df["company_name"], df["guessed_symbol"]))


def fetch_price_data(symbol: str):
    """Returns (latest_price, fifty_two_week_high) or (None, None) on failure."""
    try:
        ticker = yf.Ticker(f"{symbol}.NS")
        hist = ticker.history(period="1y")
        if hist.empty:
            return None, None
        latest_price = float(hist["Close"].iloc[-1])
        fifty_two_week_high = float(hist["High"].max())
        return latest_price, fifty_two_week_high
    except Exception as e:
        print(f"  ! failed for {symbol}: {e}")
        return None, None


def main():
    with open(STOCKS_JSON, "r") as f:
        stocks = json.load(f)

    name_to_symbol = load_ticker_map()

    updated, skipped = 0, 0
    for stock in stocks:
        symbol = name_to_symbol.get(stock["name"])
        if not symbol or pd.isna(symbol):
            skipped += 1
            continue

        old_price = stock.get("price")
        new_price, fifty_two_high = fetch_price_data(symbol)

        if new_price is None:
            skipped += 1
            continue

        # Scale market cap by the price change (we don't have a live
        # shares-outstanding feed, and share count rarely changes day
        # to day, so this ratio is a reasonable approximation).
        if old_price and stock.get("mcap"):
            stock["mcap"] = round(stock["mcap"] * (new_price / old_price), 2)

        stock["price"] = round(new_price, 2)

        if fifty_two_high:
            stock["from52wHigh"] = round((fifty_two_high - new_price) / fifty_two_high, 4)

        updated += 1
        # Be polite to the free data source — avoid hammering it.
        time.sleep(0.3)

    with open(STOCKS_JSON, "w") as f:
        json.dump(stocks, f)

    print(f"Updated {updated} stocks, skipped {skipped} (no symbol match or fetch failed).")


if __name__ == "__main__":
    main()
