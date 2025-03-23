import os
import asyncio
import requests
from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket

app = FastAPI()

load_dotenv()

# Alpha Vantage API key and endpoint
API_KEY = os.getenv("ALPHA_VANTAGE_API_KEY")
API_URL = "https://www.alphavantage.co/query"

# Function to fetch stock price from Alpha Vantage
def get_stock_price(symbol: str):
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
        return float(price)
    except KeyError:
        return None
    
# WebSocket connection handler
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            stock_price = get_stock_price("AAPL")  # Example for Apple stock
            if stock_price:
                await websocket.send_json({"ticker": "AAPL", "price": round(stock_price, 2)})
            else:
                await websocket.send_json({"error": "Failed to fetch stock price"})
            await asyncio.sleep(5)
    except Exception as e:
        print("WebSocket error:", e)

# Run the server: uvicorn main:app --reload
