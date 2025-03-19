import React, { useState } from 'react';

const CopyButton = ({ text }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <button 
      onClick={handleCopy}
      className="copy-button"
      style={{
        padding: '8px 16px',
        backgroundColor: copied ? '#4CAF50' : '#2196F3',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        margin: '10px 0',
        transition: 'background-color 0.3s'
      }}
    >
      {copied ? 'Copied!' : 'Copy Raw API Response'}
    </button>
  );
};

export default CopyButton; 