import React from 'react';

const StockCard = ({ ticker, price }) => {
  return (
    <div className="stock-card">
      <h2>{ticker}</h2>
      <p>Price: ${price}</p>
    </div>
  );
};

export default StockCard;
