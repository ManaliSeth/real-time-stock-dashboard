import React, { useState, useEffect } from "react";
import StockCard from "./components/StockCard";
import './App.css';

// Connect to WebSocket server
const socketUrl = "ws://localhost:8000/ws";

const App = () => {
  const [stockData, setStockData] = useState([]);
  const [tickers, setTickers] = useState("");  // Store the user's input tickers
  const [socket, setSocket] = useState(null);
  const [isLoading, setIsLoading] = useState(true);  // For loading state
  const [isConnected, setIsConnected] = useState(false);  // Track WebSocket connection status

  // Handle stock data updates from the WebSocket
  useEffect(() => {
    const ws = new WebSocket(socketUrl);
    setSocket(ws);

    ws.onopen = () => {
      console.log("WebSocket connected");
      setIsConnected(true);
      setIsLoading(false);
    };

    ws.onmessage = (event) => {
      console.log("Raw WebSocket message:", event.data);
      
      try {
        const data = JSON.parse(event.data);
        console.log("Parsed data from WebSocket:", data);
    
        if (data.stocks && Array.isArray(data.stocks)) {
          console.log("Received stocks:", data.stocks);

          // Compare current stock data with previous to avoid unnecessary updates
          setStockData((prevData) => {
            const updatedData = data.stocks.filter((newStock) => {
              // Update only if price is different or new stock
              const existingStock = prevData.find(stock => stock.ticker === newStock.ticker);
              return !existingStock || existingStock.price !== newStock.price;
            });
            
            if (updatedData.length > 0) {
              console.log("Updating state with new stock data:", updatedData);
            }

            // Append the new data or modify existing stocks
            const mergedData = [
              ...prevData.filter(stock => !updatedData.some(newStock => newStock.ticker === stock.ticker)),
              ...updatedData
            ];
    
            return mergedData;
          });
    
          setIsLoading(false);
        } else {
          console.log("Unexpected data format:", data);
        }
      } catch (error) {
        console.error("Error parsing WebSocket message:", error, event.data);
      }
    };
    
    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      setIsLoading(false);
    };

    ws.onclose = () => {
      console.log("WebSocket disconnected. Attempting to reconnect...");
      setIsConnected(false);
      setTimeout(() => {
        setSocket(new WebSocket(socketUrl)); // Reconnect with a new WebSocket
      }, 5000); // Retry connection after 5 seconds
    };

    return () => {
      ws.close(); // Cleanup on component unmount
    };
  }, []);

  // Send ticker data to WebSocket
  const handleTickerSubmit = () => {
    if (tickers.trim() && socket && isConnected) {
      // Only send message if WebSocket is connected
      setIsLoading(true);

      const tickerArray = tickers.split(",").map(ticker => ticker.trim());
      socket.send(JSON.stringify(tickerArray));
      socket.send(tickers);

      console.log("Sent tickers to WebSocket:", tickers);
      setTickers("");
    } else {
      console.error("WebSocket is not open or invalid tickers");
    }
  };

  return (
    <div className="App">
      <h1 className="title">Real-Time Stock Market Dashboard</h1>
      <div className="form-container">
        <input
          className="ticker-input"
          type="text"
          value={tickers}
          onChange={(e) => setTickers(e.target.value)}
          placeholder="Enter stock tickers (comma separated)"
        />
        <button className="submit-btn" onClick={handleTickerSubmit}>
          Track Stocks
        </button>
      </div>

      {isLoading ? (
        <p>Loading Stocks Data...</p>
      ) : (
        stockData.length > 0 ? (
          stockData.map(({ ticker, price }) => (
            <StockCard key={ticker} ticker={ticker} price={price} />
          ))
        ) : (
          <p>No stock data available.</p>
        )
      )}

    </div>
  );
};

export default App;
