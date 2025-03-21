import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import App from './App'
import EncodingTestPage from './EncodingTestPage'
import Layout from './components/Layout'
import './index.css';

console.log('main.tsx is executing')

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement)
console.log('root element found:', !!root)

root.render(
  <React.StrictMode>
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/encoding-test" element={<EncodingTestPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  </React.StrictMode>
)
