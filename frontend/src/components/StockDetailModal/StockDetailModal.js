import React from "react";
import "./StockDetailModal.css";
import { Line } from "react-chartjs-2";
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from "chart.js";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

const StockDetailModal = ({ stock, onClose }) => {
  if (!stock) return null; // Ensure stock exists before rendering
  console.log("Stock:", stock);

  // Ensure price_history exists and is an array
  const priceHistory = Array.isArray(stock.price_history) ? stock.price_history : [];

  // Prepare chart data safely
  const chartData = {
    labels: priceHistory.map((entry) => entry.date).reverse(), // X-axis (Dates)
    datasets: [
      {
        label: `${stock.ticker} Price History`,
        data: priceHistory.map((entry) => parseFloat(entry.price)).reverse(), // Y-axis (Prices)
        borderColor: "#4b9cd3",
        backgroundColor: "rgba(75, 156, 211, 0.2)",
        fill: true,
      },
    ],
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <button className="close-btn" onClick={onClose}>×</button>
        <h2>{stock.name} ({stock.ticker})</h2>
        <p><strong>Current Price:</strong> ${stock.current_price ?? "N/A"}</p>
        <p><strong>Opening Price:</strong> ${stock.open_price ?? "N/A"}</p>
        <p><strong>High:</strong> ${stock.high_price ?? "N/A"} | <strong>Low:</strong> ${stock.low_price ?? "N/A"}</p>
        <p><strong>Market Cap:</strong> ${stock.market_cap ?? "N/A"}</p>
        <p><strong>P/E Ratio:</strong> {stock.pe_ratio ?? "N/A"}</p>

        <h3>Price History</h3>
        <div className="chart-container">
          {priceHistory.length > 0 ? (
            <Line data={chartData} />
          ) : (
            <p>No price history available.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default StockDetailModal;
