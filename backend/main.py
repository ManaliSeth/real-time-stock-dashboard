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

# Rate-limiting
last_request_time = 0
rate_limit_interval = 60  # in seconds (1 minute)

# Cache dictionary to store stock prices
stock_cache = {}
cache_timeout = 30  # Cache timeout in seconds

# Function to fetch stock price from Alpha Vantage
def get_stock_price(symbol: str):
    global last_request_time
    
    # Check if it's been enough time since the last request
    current_time = time.time()
    if current_time - last_request_time < rate_limit_interval:
        raise HTTPException(status_code=429, detail="Too many requests, please try again later.")
    
    last_request_time = current_time

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
        raise HTTPException(status_code=500, detail="Failed to fetch stock price data")
    
# WebSocket connection handler
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        while websocket.client_state == WebSocketState.CONNECTED:
            stock_price = get_stock_price("AAPL")  # Example for Apple stock
            if stock_price:
                try:
                    await websocket.send_json({"ticker": "AAPL", "price": round(stock_price, 2)})
                    print("Sent stock price to WebSocket")
                except Exception as send_error:
                    print("Error sending stock price:", send_error)
            else:
                await websocket.send_json({"error": "Failed to fetch stock price"})
            await asyncio.sleep(5)
    except Exception as e:
        print("WebSocket error:", e)
    finally:
        print("Closing WebSocket connection")
        await websocket.close()

# Run the server: uvicorn main:app --reload
