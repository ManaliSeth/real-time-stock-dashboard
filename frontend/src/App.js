import React, { useState, useEffect, useCallback, useRef } from "react";
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
  const [searchResults, setSearchResults] = useState([]);
  const [selectedTicker, setSelectedTicker] = useState("");
  const searchTimeoutRef = useRef(null);
  const [isTyping, setIsTyping] = useState(false);
  const [isTracking, setIsTracking] = useState(false);

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
          setStockData((prevData) => {
            const updatedStocks = data.stocks.map((latestStock) => {
              const existingStock = prevData.find(stock => stock.ticker === latestStock.ticker);

              return existingStock
                ? { ...latestStock, change_percent: latestStock.change_percent, direction: latestStock.direction }
                : latestStock;
            });
            return updatedStocks;
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

    ws.onclose = (event) => {
      console.log("WebSocket disconnected:", event);
    setIsConnected(false);
    setIsTracking(false);
    };

    return () => {
      ws.close();
    };
  }, []);

  // Handle change in ticker input
  const handleSearchChange = useCallback((e) => {
    const query = e.target.value;
    setTickers(query);
    setIsTyping(true);

    if (isTracking) {
      setIsTracking(false);
    }

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    
    if (query.length > 1) {
      searchTimeoutRef.current = setTimeout(async () => {
        try {
          const response = await fetch(`http://localhost:8000/search?query=${query}`);
          const data = await response.json();
          console.log("Search results:", data.results); // Debugging
          setSearchResults(data.results);
        } catch (error) {
          console.error("Error fetching search results:", error);
        }
      },1000); // 1000ms debounce time
    } else {
      setSearchResults([]);
    }
  }, [isTracking]);

  // Handle ticker selection from autosuggest
  const handleSelectTicker = (ticker) => {
    setSelectedTicker(ticker);
    setTickers(ticker); 
    setSearchResults([]);
    setIsTyping(false);
  };

  // Send ticker data to WebSocket
  const handleTickerSubmit = () => {
    const tickerToSend = selectedTicker || tickers.trim().toUpperCase();
    
    if (tickerToSend && socket && isConnected) {
      setIsLoading(true);
      setStockData([]);
      socket.send(tickerToSend); 
      setSelectedTicker(null); 
      setTickers("");          
      setSearchResults([]);
      setIsTyping(false);
      setIsTracking(true);
      console.log("Sent ticker:", tickerToSend);
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
          onChange={handleSearchChange}
          placeholder="Search stock by ticker (e.g., AAPL)"
        />
        {searchResults.length > 0 && !isTracking &&(
          <div className="search-suggestions">
            {searchResults.map((result) => (
              <div
                key={result.symbol}
                className="suggestion-item"
                onClick={() => handleSelectTicker(result.symbol)}
              >
                {result.symbol} - {result.name}
              </div>
            ))}
          </div>
        )}
        <button
          className="submit-btn"
          onClick={handleTickerSubmit}
          disabled={!tickers.trim() || isTracking}
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
              <StockCard key={stock.ticker} {...stock} />
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
