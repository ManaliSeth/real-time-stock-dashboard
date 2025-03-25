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
          setStockData(data.stocks);
          setIsLoading(false);
        } else if (data.error) {
          toast.error(data.error);
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
      setIsLoading(true);
      socket.send(tickers.trim());
      setTickers("");  // Clear the input field
      console.log("Sent ticker:", tickers.trim());
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
          placeholder="Enter a single stock ticker"
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
          <StockCard ticker={stockData[0].ticker} price={stockData[0].price} />
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
