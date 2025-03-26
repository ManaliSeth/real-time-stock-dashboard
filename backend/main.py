import os
import time
import asyncio
import requests
from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, HTTPException
from fastapi.websockets import WebSocketState

app = FastAPI()

load_dotenv()

# Alpha Vantage API key and endpoint
API_KEY = os.getenv("ALPHA_VANTAGE_API_KEY")
API_URL = "https://www.alphavantage.co/query"

# Cache dictionary to store stock prices
stock_cache = {}
cache_timeout = 3000  # Cache timeout in seconds

# Function to fetch stock price from Alpha Vantage
def get_stock_price(symbol: str):
    global last_request_time
    current_time = time.time()

    # Check if the stock price is already cached and if it's still valid
    if symbol in stock_cache:
        cached_data = stock_cache[symbol]
        if current_time - cached_data["timestamp"] < cache_timeout:
            return cached_data["price"]

    params = {
        "function": "TIME_SERIES_INTRADAY",
        "symbol": symbol,
        "interval": "5min",
        "apikey": API_KEY
    }
    response = requests.get(API_URL, params=params)
    data = response.json()

    # Check for valid data and extract the latest price
    try:
        latest_time = list(data["Time Series (5min)"].keys())[0]
        price = data["Time Series (5min)"][latest_time]["4. close"]
        # Cache the stock price with timestamp
        stock_cache[symbol] = {
            "price": float(price),
            "timestamp": current_time
        }
        return float(price)
    except KeyError:
        print("Error fetching data:", data)
        return None
    
# WebSocket connection handler
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        ticker = await websocket.receive_text()  # Receive ticker data from the client
        print("Tracking ticker:", ticker)
        
        if ticker: 
            requested_ticker = ticker.strip()
            print("Requested ticker:", requested_ticker)
        
            while websocket.client_state == WebSocketState.CONNECTED:
                price = get_stock_price(requested_ticker)
                if price is not None:
                    if requested_ticker in stock_cache:
                        prev_price = stock_cache[requested_ticker].get("price", None)
                        change_percent = ((price - prev_price) / prev_price) * 100 if prev_price else 0
                        direction = "up" if change_percent > 0 else "down" if change_percent < 0 else "neutral"
                    else:
                        change_percent = 0
                        direction = "neutral"

                    stock_data = {
                        "ticker": requested_ticker,
                        "price": round(price, 2),
                        "change_percent": round(change_percent, 2),
                        "direction": direction
                    }
        
                    await websocket.send_json({"stocks": [stock_data]})
                    print("Sent stock prices to WebSocket:", [stock_data])
                else:
                    await websocket.send_json({"error": "Could not fetch stock data for the provided ticker."})

                await asyncio.sleep(5) # Update every 5 sec
    except Exception as e:
        print("WebSocket error:", e)
    finally:
        print("Closing WebSocket connection")
        await websocket.close()

# Run the server: uvicorn main:app --reload
