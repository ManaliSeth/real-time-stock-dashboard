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
        requested_tickers = []  # List of tickers that the client wants to track

        while websocket.client_state == WebSocketState.CONNECTED:
            data = await websocket.receive_text()  # Receive ticker data from the client
            print("Received tickers from client:", data)
            
            if data: 
                requested_tickers = data.split(",") 
                print("Requested tickers:", requested_tickers)

            # Fetch stock data for each requested ticker
            stock_data = []
            for ticker in requested_tickers:
                ticker = ticker.strip()
                price = get_stock_price(ticker)

                if price is not None:
                    stock_data.append({"ticker": ticker, "price": round(price, 2)})
            
            # Log data before sending to client
            print("Sending stock data to WebSocket:", stock_data)

            if stock_data:
                await websocket.send_json({"stocks": stock_data})
                print("Sent stock prices to WebSocket:", stock_data)

            await asyncio.sleep(5)
    except Exception as e:
        print("WebSocket error:", e)
    finally:
        print("Closing WebSocket connection")
        await websocket.close()

# Run the server: uvicorn main:app --reload
