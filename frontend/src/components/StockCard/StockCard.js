import React from "react";
import "./StockCard.css";

const StockCard = ({ ticker, latest_intraday_price=0, change_percent=0, direction, onClick }) => {
  const isPositive = direction === "up";
  const isNegative = direction === "down";
  const arrow = isPositive ? "▲" : isNegative ? "▼" : "—";

  return (
    <div className="stock-card" onClick={() => onClick(ticker)}>
      <h2>{ticker}</h2>
      <div className="price-container">
        <span className="price">${Number(latest_intraday_price).toFixed(2)}</span>
        <span className={`change ${isPositive ? "positive" : isNegative ? "negative" : ""}`}>
          {arrow} {Number(change_percent).toFixed(2)}%
        </span>
      </div>
    </div>
  );
};

export default StockCard;
