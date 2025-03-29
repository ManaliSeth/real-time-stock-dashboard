import os
import json
import redis
import asyncio
import requests
from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, HTTPException
from fastapi.websockets import WebSocketState, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

load_dotenv()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Alpha Vantage API key and endpoint
API_KEY = os.getenv("ALPHA_VANTAGE_API_KEY")
API_URL = "https://www.alphavantage.co/query"

# Redis connection
def connect_redis():
    try:
        redis_client = redis.Redis(host="localhost", port=6379, db=0, decode_responses=True)
        redis_client.ping()
        print("Redis connected successfully!")
        return redis_client
    except redis.exceptions.ConnectionError:
        print("Redis connection failed! Falling back to no cache.")
        return None

redis_client = connect_redis()

CACHE_EXPIRY = 3000  # Cache timeout in seconds

# Fetch stock price from Alpha Vantage
def fetch_stock_price(symbol: str):
    try:
        params = {
            "function": "TIME_SERIES_INTRADAY",
            "symbol": symbol,
            "interval": "5min",
            "apikey": API_KEY
        }
        response = requests.get(API_URL, params=params)
        response.raise_for_status()
        data = response.json()

        latest_time = list(data["Time Series (5min)"].keys())[0]
        price = round(float(data["Time Series (5min)"][latest_time]["4. close"]), 2)
        return price
    except requests.exceptions.RequestException as e:
        print(f"Request error: {e}")
        return None
    except ValueError as ve:
        print(f"Value error: {e}")
        return None
    except KeyError as e:
        print(f"Key error: {e}")        
        return None

# Search stock symbols from Alpha Vantage
def search_stock_symbols(query: str):
    print(f"Searching for: {query}")  # Debugging

    cache_key = f"search:{query}"
    if redis_client:
        cached_results = redis_client.get(cache_key)
        if cached_results:
            return json.loads(cached_results)

    params = {
        "function": "SYMBOL_SEARCH",
        "keywords": query,
        "apikey": API_KEY
    }
    response = requests.get(API_URL, params=params)
    data = response.json()

    print("Alpha Vantage API Response:", data)  # Debugging

    # Return a list of matching symbols and names
    try:
        matches = data.get("bestMatches", [])
        results = [{"symbol": match["1. symbol"], "name": match["2. name"], "exchange": match["4. region"]} for match in matches]

        # Cache results
        if redis_client:
            redis_client.setex(cache_key, CACHE_EXPIRY, json.dumps(results))

        return results
    except KeyError as e:
        print(f"Key error while processing symbol search: {e}")
        return []
    except json.JSONDecodeError as e:
        print(f"Error decoding JSON response: {e}")
        return []

# WebSocket connection handler with batch requests
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    ticker = None
    prev_price = None

    try:
        while websocket.client_state == WebSocketState.CONNECTED:
            try:
                new_ticker = await asyncio.wait_for(websocket.receive_text(), timeout=1)
                new_ticker = new_ticker.strip().upper()

                if new_ticker != ticker:
                    ticker = new_ticker 
                    prev_price = None
                    print(f"Tracking ticker: {ticker}")

            except asyncio.TimeoutError:
                pass

            # Fetch stock price for the current ticker
            if ticker:
                price = fetch_stock_price(ticker)

                if price:
                    change_percent = ((price - prev_price) / prev_price) * 100 if prev_price else 0
                    direction = "up" if change_percent > 0 else "down" if change_percent < 0 else "neutral"
                    prev_price = price

                    # Fetch additional stock details
                    stock_details = await get_stock_details(ticker)

                    stock_data = {
                        "ticker": ticker,
                        "price": round(price, 2),
                        "change_percent": round(change_percent, 2),
                        "direction": direction,
                        "name": stock_details["name"],
                        "current_price": stock_details["current_price"],
                        "open_price": stock_details["open_price"],
                        "high_price": stock_details["high_price"],
                        "low_price": stock_details["low_price"],
                        "market_cap": stock_details["market_cap"],
                        "pe_ratio": stock_details["pe_ratio"],
                        "price_history": stock_details["price_history"]
                    }

                    await websocket.send_json({"stocks": [stock_data]})
                    print("Sent stock prices to WebSocket:", [stock_data])
                else:
                    await websocket.send_json({"error": "Could not fetch stock data for the provided ticker."})

                await asyncio.sleep(5)  # Update every 5 seconds
    except WebSocketDisconnect:
        print("WebSocket disconnected")
        await websocket.close()
    except Exception as e:
        print(f"Error: {e}")
        await websocket.close()

# Search Autosuggest
@app.get("/search")
async def search(query: str):
    if not query:
        raise HTTPException(status_code=400, detail="Search query is required.")
    
    # Search stock symbols based on the query
    results = search_stock_symbols(query)
    if not results:
        return {"message": "No results found"}
    return {"results": results}

# Stock details
@app.get("/stock-details")
async def get_stock_details(ticker: str):
    try:
        # Fetch stock overview (company info, market cap, P/E ratio)
        overview_url = f"{API_URL}?function=OVERVIEW&symbol={ticker}&apikey={API_KEY}"
        overview_response = requests.get(overview_url)
        overview_data = overview_response.json()

        # Fetch historical stock prices (daily)
        history_url = f"{API_URL}?function=TIME_SERIES_DAILY&symbol={ticker}&apikey={API_KEY}"
        history_response = requests.get(history_url)
        history_data = history_response.json()

        if "Time Series (Daily)" not in history_data or "MarketCapitalization" not in overview_data:
            raise HTTPException(status_code=404, detail="Stock data not found")

        # Extract relevant details
        latest_date = list(history_data["Time Series (Daily)"].keys())[0]
        latest_prices = history_data["Time Series (Daily)"][latest_date]

        stock_details = {
            "ticker": ticker,
            "name": overview_data.get("Name", "N/A"),
            "current_price": latest_prices["4. close"],
            "open_price": latest_prices["1. open"],
            "high_price": latest_prices["2. high"],
            "low_price": latest_prices["3. low"],
            "market_cap": overview_data.get("MarketCapitalization", "N/A"),
            "pe_ratio": overview_data.get("PERatio", "N/A"),
            "price_history": [
                {"date": date, "price": data["4. close"]}
                for date, data in list(history_data["Time Series (Daily)"].items())[:10]  # Last 10 days
            ]
        }

        return stock_details

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Run the server: uvicorn main:app --reload
