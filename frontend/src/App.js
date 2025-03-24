import React, { useState, useEffect } from "react";
import StockCard from "./components/StockCard";

// Connect to WebSocket server
const socketUrl = "ws://localhost:8000/ws";
let socket = new WebSocket(socketUrl);

const App = () => {
  const [stockData, setStockData] = useState({ ticker: "", price: 0 });
  const [socket, setSocket] = useState(null);

  // Listen for stock data from the WebSocket
  useEffect(() => {
    let ws = new WebSocket(socketUrl);
    setSocket(ws);

    ws.onopen = () => {
      console.log("WebSocket connected");
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log("Received data from WebSocket:", data); // Log data here
      if (data.ticker && data.price) {
        setStockData({
          ticker: data.ticker,
          price: data.price,
        });
      } else if (data.error) {
        console.log("Error:", data.error);
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    ws.onclose = () => {
      console.log("WebSocket disconnected. Attempting to reconnect...");
      setTimeout(() => {
        setSocket(new WebSocket(socketUrl)); // Reconnect with a new WebSocket
      }, 5000); // Retry connection after 5 seconds
    };

    return () => {
      ws.close(); // Cleanup on component unmount
    };
  }, []); // Runs only once

  return (
    <div className="App">
      <h1>Real-Time Stock Market Dashboard</h1>
      <StockCard ticker={stockData.ticker} price={stockData.price} />
    </div>
  );
};

export default App;
