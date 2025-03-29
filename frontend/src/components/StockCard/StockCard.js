import React from "react";

const StockCard = ({ ticker, price, change_percent, direction, onClick }) => {
  const isPositive = direction === "up";
  const isNegative = direction === "down";
  const arrow = isPositive ? "▲" : isNegative ? "▼" : "—";

  return (
    <div className="stock-card" onClick={() => onClick(ticker)}>
      <h2>{ticker}</h2>
      <div className="price-container">
        <span className="price">${price.toFixed(2)}</span>
        <span className={`change ${isPositive ? "positive" : isNegative ? "negative" : ""}`}>
          {arrow} {change_percent.toFixed(2)}%
        </span>
      </div>
    </div>
  );
};

export default StockCard;
