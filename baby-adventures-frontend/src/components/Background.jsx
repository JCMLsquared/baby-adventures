import React from 'react';
import './Background.css';

const Background = () => {
  return (
    <div className="background-container">
      <div className="floating-elements">
        <div className="floating-element star" />
        <div className="floating-element heart" />
        <div className="floating-element cloud" />
        <div className="floating-element balloon" />
        <div className="floating-element star" />
        <div className="floating-element heart" />
        <div className="floating-element cloud" />
        <div className="floating-element balloon" />
      </div>
    </div>
  );
};

export default Background; 