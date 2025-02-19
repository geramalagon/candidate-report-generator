import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css';

console.log('main.tsx is executing')

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement)
console.log('root element found:', !!root)

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
