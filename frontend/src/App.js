import React, { useState, useEffect } from "react";
import { ToastContainer, toast } from "react-toastify";
import StockCard from "./components/StockCard";
import { RingLoader } from 'react-spinners';
import 'react-toastify/dist/ReactToastify.css';
import './App.css';

// Connect to WebSocket server
const socketUrl = "ws://localhost:8000/ws";

const App = () => {
  const [stockData, setStockData] = useState([]);
  const [tickers, setTickers] = useState("");
  const [socket, setSocket] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);

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
          // setStockData(data.stocks);
          setStockData((prevData) => {
            return data.stocks.map((latestStock) => {
              const existingStock = prevData.find(stock => stock.ticker === latestStock.ticker);
              
              if (existingStock) {
                // Calculate percentage change
                const priceChange = latestStock.price - existingStock.price;
                const changePercent = (priceChange / existingStock.price) * 100;
                const direction = priceChange > 0 ? "up" : priceChange < 0 ? "down" : "neutral";

                return { 
                  ...latestStock, 
                  change_percent: changePercent, 
                  direction: direction 
                };
              } else {
                return { 
                  ...latestStock, 
                  change_percent: 0, 
                  direction: "neutral" 
                };
              }
            });
          });
          setIsLoading(false);
        } else if (data.error) {
          toast.error(data.error);
          setIsLoading(false);
        } 
        else {
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
      setIsLoading(true);
      socket.send(tickers.trim().toUpperCase());
      setTickers("");
      console.log("Sent ticker:", tickers.trim().toUpperCase());
    } else {
      toast.error("Please provide a valid ticker and ensure the WebSocket is connected.");
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
          placeholder="Enter a single stock ticker (e.g., AAPL)"
        />
        <button
          className="submit-btn"
          onClick={handleTickerSubmit}
          disabled={!tickers.trim() || tickers.includes(",")}
        >
          Track Stock
        </button>
      </div>

      {isLoading ? (
        <div className="loader-container">
          <RingLoader size={50} color="#4b9cd3" loading={isLoading} />
        </div>
      ) : (
        stockData.length > 0 ? (
          <div className="stock-container">
            {stockData.map((stock) => (
              <StockCard
                key={stock.ticker}
                ticker={stock.ticker}
                price={stock.price}
                change_percent={stock.change_percent}
                direction={stock.direction}
              />
          ))}
        </div>
        ) : (
          <p>No stock data available.</p>
        )
      )}

      {/* Toast notifications container */}
      <ToastContainer position="top-right" autoClose={5000} hideProgressBar={false} newestOnTop closeButton />
    </div>
  );
};

export default App;
