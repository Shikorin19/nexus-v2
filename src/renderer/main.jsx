import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './globals.css';

// StrictMode désactivé — double-mount en dev interfère avec AudioContext / MediaRecorder
ReactDOM.createRoot(document.getElementById('root')).render(<App />);
