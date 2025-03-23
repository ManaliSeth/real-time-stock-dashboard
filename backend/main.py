from fastapi import FastAPI, WebSocket
import random
import asyncio

app = FastAPI()

# WebSocket connection handler
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            stock_price = round(random.uniform(100, 500), 2)  # Simulate stock price
            await websocket.send_json({"ticker": "AAPL", "price": stock_price})
            await asyncio.sleep(2)  # Simulate 2-second price update interval
    except Exception as e:
        print("WebSocket error:", e)

# Run the server: uvicorn main:app --reload
