import React from 'react'
import ReactDOM from 'react-dom/client'
import { ConfigProvider } from 'antd-mobile'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ConfigProvider>
      <App />
    </ConfigProvider>
  </React.StrictMode>,
)
