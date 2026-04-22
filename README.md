# ⚡ Vanguard-WMS — Phase 1: Foundation

> **High-Performance Memory-First Warehouse Engine**  
> C++20 Logic Engine (Crow) · SQLite3 · React 18 + Vite · Glassmorphism UI  
> Lead Developer: Yash Shinde

---

## 📁 Directory Structure

```
vanguard-wms/
├── backend/
│   ├── include/
│   │   ├── database.h          # DB class + Product struct + JSON helpers
│   │   └── router.h            # HTTP route declarations
│   ├── src/
│   │   ├── main.cpp            # Entry point — wires DB + Router + Crow
│   │   ├── database.cpp        # SQLite3 implementation
│   │   └── router.cpp          # All API handler implementations
│   ├── data/                   # SQLite .db file lives here (auto-created)
│   └── CMakeLists.txt          # CMake build (auto-fetches Crow, json, asio)
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Dashboard.jsx       # Main page — search, toolbar, table
│   │   │   ├── Sidebar.jsx         # Left nav with phase indicators
│   │   │   ├── StatusBar.jsx       # Header — engine status, stat pills
│   │   │   ├── ProductTable.jsx    # Animated inventory table
│   │   │   ├── StatsRow.jsx        # 4-card KPI row
│   │   │   └── AddProductModal.jsx # Glassmorphism insert form
│   │   ├── hooks/
│   │   │   └── useApi.js           # useProducts, useHealth, createProduct
│   │   ├── App.jsx                 # Root layout — sidebar + main area
│   │   ├── main.jsx                # ReactDOM entry
│   │   └── index.css               # Tailwind + glassmorphism utilities
│   ├── index.html
│   ├── vite.config.js              # Dev proxy → localhost:8080
│   ├── tailwind.config.js          # Dark, neon palette, Orbitron font
│   ├── postcss.config.js
│   └── package.json
│
└── README.md
```

---

## 🖥️ Backend — C++ Logic Engine

### Prerequisites

| Tool         | Version   | Install |
|-------------|-----------|---------|
| GCC / Clang | ≥ 12      | `sudo apt install build-essential` |
| CMake        | ≥ 3.20    | `sudo apt install cmake` |
| SQLite3      | any       | `sudo apt install libsqlite3-dev` |
| Git          | any       | `sudo apt install git` |

> **Windows (MSVC):** Use Visual Studio 2022 + CMake GUI.  
> **macOS:** `brew install cmake sqlite3`

### 1 — Install system dependencies

```bash
# Ubuntu / Debian
sudo apt update
sudo apt install -y build-essential cmake libsqlite3-dev git

# macOS
brew install cmake sqlite3

# Fedora / RHEL
sudo dnf install -y gcc-c++ cmake sqlite-devel git
```

> Crow, nlohmann/json, and standalone Asio are **auto-downloaded** by CMake's
> `FetchContent` — no manual installation needed.

### 2 — Configure & Compile

```bash
# From the project root
cd backend

# Configure (downloads dependencies on first run — needs internet)
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release

# Compile (uses all CPU cores)
cmake --build build --parallel

# Binary is at: backend/build/vanguard_engine
```

#### Debug build (with AddressSanitizer)

```bash
cmake -S . -B build-debug -DCMAKE_BUILD_TYPE=Debug
cmake --build build-debug --parallel
```

### 3 — Run the engine

```bash
# From backend/ directory (data/ folder is created automatically)
./build/vanguard_engine
```

Expected output:
```
  ██╗   ██╗ █████╗ ███╗   ██╗ ██████╗ ██╗   ██╗ █████╗ ██████╗ ██████╗
  ...
[DB]     Connected to SQLite at: ./data/vanguard.db
[DB]     Schema initialised (products table ready).
[Router] Routes registered:
           GET  /api/health
           GET  /api/products
           POST /api/products
[Server] Starting Vanguard-WMS on port 8080 with 4 threads...
[Server] API base: http://localhost:8080/api
```

### API Endpoints

| Method | Endpoint        | Description              |
|--------|----------------|--------------------------|
| GET    | `/api/health`   | Server heartbeat + version |
| GET    | `/api/products` | Fetch all products from DB |
| POST   | `/api/products` | Insert a new product       |

#### Test with curl

```bash
# Health check
curl http://localhost:8080/api/health | jq

# Get all products
curl http://localhost:8080/api/products | jq

# Add a product
curl -X POST http://localhost:8080/api/products \
  -H "Content-Type: application/json" \
  -d '{"sku":"WH-001","name":"Industrial Servo Motor","category":"Electronics","quantity":42,"price":1299.99}' | jq

# Add another
curl -X POST http://localhost:8080/api/products \
  -H "Content-Type: application/json" \
  -d '{"sku":"WH-002","name":"Hydraulic Piston Arm","category":"Mechanical","quantity":7,"price":4599.00}' | jq
```

---

## 🌐 Frontend — React Dashboard

### Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | ≥ 18 | https://nodejs.org |
| npm | ≥ 9  | Bundled with Node |

### 4 — Install dependencies

```bash
cd frontend
npm install
```

### 5 — Run the dev server

```bash
npm run dev
```

Open **http://localhost:5173** in your browser.

> The Vite dev server **proxies** all `/api` calls to `localhost:8080` automatically —
> no CORS configuration needed during development.

### 6 — Production build

```bash
npm run build
# Output: frontend/dist/  (serve with nginx or any static host)
```

---

## 🚀 Running Both Together (Quick Start)

Open **two terminal windows**:

```bash
# Terminal 1 — C++ Engine
cd backend
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release && cmake --build build --parallel
./build/vanguard_engine

# Terminal 2 — React Dashboard
cd frontend
npm install && npm run dev
```

Then visit → **http://localhost:5173**

---

## 🧠 Architecture Notes

### Why Memory-First?

On startup the C++ engine connects to SQLite and initialises the schema.
In **Phase 2**, all records will be loaded into in-memory DSA structures
at boot (see the `// FUTURE PHASE HOOK` comment in `main.cpp`):

```
SQLite (disk)  ──boot──▶  AVL Tree + Hash Table + Max-Heap (RAM)
                           │
React Dashboard ◀── API ──┘  O(log n) search, O(1) SKU lookup
```

### DSA Roadmap

| Phase | Feature          | Structure             |
|-------|------------------|-----------------------|
| 1     | CRUD + REST API  | SQLite + Crow         |
| 2     | Fast Search      | AVL Tree (by name)    |
| 2     | SKU Lookup       | Hash Table (O(1))     |
| 2     | Priority Orders  | Max-Heap              |
| 3     | Pathfinding      | Graph + Dijkstra's    |
| 3     | Global Shipping  | Floyd-Warshall        |
| 4     | Packing Optim.   | 0/1 Knapsack DP       |
| 5     | Autocomplete     | Trie / LCS            |

---

## 🛠️ Troubleshooting

| Problem | Solution |
|---------|----------|
| `SQLite3 not found` | `sudo apt install libsqlite3-dev` |
| `cmake: command not found` | `sudo apt install cmake` |
| `FetchContent` network error | Check internet; corporate proxies may need `CMAKE_...PROXY` vars |
| React shows "ENGINE OFFLINE" | Start the C++ backend first on port 8080 |
| Port 8080 in use | Edit `SERVER_PORT` in `main.cpp` and `target` in `vite.config.js` |
| `SKU already exists` (409) | Each SKU must be unique — try a different value |

---

*Vanguard-WMS · Phase 1 Foundation · Built with C++20 + React 18*
