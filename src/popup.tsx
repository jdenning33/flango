import React from 'react';
import { createRoot } from 'react-dom/client';

// eslint-disable-next-line react-refresh/only-export-components
const Popup: React.FC = () => {
  // Function to handle the button click and send a message to the background script
  const handleButtonClick = () => {
    console.log('Start Translation');
    // Send a message to the background script to start the translation
    chrome.runtime.sendMessage({ action: 'startTranslation' });
    console.log('Sent message');
  };

  return (
    <div>
      <h1>Flango</h1>
      <button onClick={handleButtonClick}>Start Translation</button>
    </div>
  );
};

// Find the root element and create a root for React 18
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<Popup />);
}
