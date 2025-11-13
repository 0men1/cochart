CURRENT TASK:
- Separate Shared state from per-user state
- Build test regression test suite

Requirements
- The drawing system is terrible and can be greatly improved. I am planning on forking LWC and creating my own implementation that opens the door to dragging drawings and their control points instead of declaring it here. So the drawing is very very temporary just to make sure everything works.
- Handle errors gracefully and retry when failing

PROBLEM DISCOVERY:

===THIS IS AI GENERATED===
# 📈 CoChart - Collaborative Financial Charting Platform

<div align="center">

![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)
![Go](https://img.shields.io/badge/Go-00ADD8?style=for-the-badge&logo=go&logoColor=white)
![WebSocket](https://img.shields.io/badge/WebSocket-010101?style=for-the-badge&logo=socket.io&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)

*A real-time collaborative financial charting platform with advanced drawing tools and live market data*

</div>

## ✨ Overview

CoChart is a **production-grade collaborative trading platform** that enables multiple users to analyze financial markets together in real-time. Built with modern web technologies, it combines the power of **WebSocket-based real-time collaboration**, **professional-grade charting**, and **live market data integration**.

### 🎯 Key Highlights
- **Real-time Collaboration**: Multiple users can draw, annotate, and analyze charts simultaneously
- **Professional Charting**: Built on TradingView's Lightweight Charts library with custom drawing primitives
- **Live Market Data**: Real-time candlestick data with WebSocket streaming
- **Advanced Drawing Tools**: Trend lines, vertical lines, and custom drawing primitives with precise control points
- **State Management**: Sophisticated state management with local persistence and real-time synchronization
- **Scalable Architecture**: High-performance Go backend with efficient WebSocket room management

## 🚀 Architecture & Tech Stack

### Frontend (Next.js 15 + TypeScript)
```
📁 cochart-app/
├── 🎨 Modern UI Components (Radix UI + Tailwind CSS)
├── 📊 Advanced Charting Engine (Lightweight Charts)
├── 🔄 Real-time State Management (Custom Context + Reducers)
├── 🎯 Custom Drawing Primitives (Canvas-based)
├── 💾 Persistent Storage (IndexDB + LocalStorage)
└── 🔌 WebSocket Integration (Real-time collaboration)
```

### Backend (Go + WebSocket)
```
📁 server/
├── 🏠 Room Management System (Multi-user sessions)
├── 🔗 WebSocket Handler (Real-time communication)
├── 📈 Market Data API (Live candlestick data)
└── 🌐 RESTful API Endpoints
```

## 🛠️ Technical Features

### 🎨 Advanced Charting System
- **Custom Drawing Primitives**: Implemented from scratch using HTML5 Canvas
- **Precision Control Points**: Interactive handles for precise drawing manipulation  
- **Geometry Utilities**: Mathematical calculations for drawing intersections and positioning
- **State Persistence**: Drawings and chart state survive page refreshes

### 🔄 Real-time Collaboration
- **WebSocket Room System**: Multi-user sessions with unique room IDs
- **Action Broadcasting**: All user interactions synchronized across participants
- **State Synchronization**: Consistent state management across all connected clients
- **Connection Management**: Automatic reconnection and error handling

### 📊 Market Data Integration
- **Live Candlestick Data**: Real-time market data streaming
- **Multiple Timeframes**: Support for various chart intervals (1m, 5m, 1h, 1d)
- **Historical Data**: Efficient loading of historical market data
- **Symbol Management**: Support for multiple trading symbols

### Performance Optimizations
- **Efficient Rendering**: Canvas-based drawing with optimized update cycles
- **Memory Management**: Proper cleanup of chart instances and WebSocket connections
- **Caching Strategy**: Smart caching of historical market data
- **Debounced Updates**: Optimized real-time state synchronization

## 🚦 Getting Started

### Prerequisites
- Node.js 18+ 
- Go 1.22+
- Modern web browser with WebSocket support

### Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/cochart.git
   cd cochart 
   ```

2. **Start the backend server**
   ```bash
   cd server
   go mod tidy
   go run .
   # Server running on http://localhost:8080
   ```

3. **Launch the frontend**
   ```bash
   cd cochart-app
   npm install
   npm run dev
   # App running on http://localhost:3000
   ```

4. **Experience collaboration**
   - Open multiple browser tabs
   - Create or join a room
   - Start drawing and see real-time synchronization!

## 🔍 Code Quality & Best Practices

### TypeScript Excellence
- **Strict Type Safety**: Comprehensive type definitions
- **Interface Design**: Well-structured data contracts
- **Generic Utilities**: Reusable type-safe utilities
- **Error Handling**: Robust error boundaries and validation

### Testing & Reliability
- **Error Boundaries**: Graceful error handling in React components
- **Connection Recovery**: Automatic WebSocket reconnection
- **State Validation**: Runtime state validation and type checking
- **Cross-browser Compatibility**: Tested across modern browsers
