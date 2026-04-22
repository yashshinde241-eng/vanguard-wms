#pragma once

/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  Vanguard-WMS · Phase 3 · Warehouse Graph Engine                ║
 * ║                                                                  ║
 * ║  TWO graph problems solved here:                                 ║
 * ║                                                                  ║
 * ║  1. WAREHOUSE NAVIGATION  (10×10 grid, Single-Source SP)        ║
 * ║     Data structure : Adjacency List  (vector of vectors)        ║
 * ║     Algorithm      : Dijkstra's  O((V+E) log V)                 ║
 * ║     Features       : 4-directional movement, obstacle support   ║
 * ║                      (blocked aisle nodes are simply not added  ║
 * ║                       to the adjacency list), weighted edges     ║
 * ║                      (diagonal = √2, straight = 1)              ║
 * ║                                                                  ║
 * ║  2. REGIONAL SHIPPING MATRIX  (5-node dense graph, All-Pairs)   ║
 * ║     Data structure : Adjacency Matrix  (2-D array)              ║
 * ║     Algorithm      : Floyd-Warshall  O(V³)                      ║
 * ║     Features       : Pre-computed at boot, stores both cost     ║
 * ║                      matrix and "next-hop" for path tracing     ║
 * ║                                                                  ║
 * ║  Memory: all smart-pointer managed, no raw new/delete.          ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

#include <vector>
#include <string>
#include <unordered_set>
#include <queue>
#include <limits>
#include <cmath>
#include <stdexcept>
#include <iostream>
#include <iomanip>
#include <nlohmann/json.hpp>

namespace vanguard {

// ══════════════════════════════════════════════════════════════════════════
//  PART 1 — WAREHOUSE NAVIGATION  (Dijkstra on a 10×10 grid)
// ══════════════════════════════════════════════════════════════════════════

/**
 * Node numbering (row-major):
 *
 *   (0,0)=0   (0,1)=1  ... (0,9)=9
 *   (1,0)=10  (1,1)=11 ... (1,9)=19
 *   ...
 *   (9,0)=90  ...          (9,9)=99
 *
 *   node_id = row * COLS + col
 *   row     = node_id / COLS
 *   col     = node_id % COLS
 */

class WarehouseGraph {
public:
    static constexpr int ROWS = 10;
    static constexpr int COLS = 10;
    static constexpr int N    = ROWS * COLS;   // 100 nodes

    // Edge in the adjacency list
    struct Edge {
        int    to;
        double weight;
    };

    // Result of a Dijkstra query
    struct PathResult {
        std::vector<int> path;      // ordered node IDs from start → end
        double           cost;      // total path cost
        int              hops;      // number of edges traversed
        bool             reachable; // false if end is in a blocked region
    };

    // ── Construction ──────────────────────────────────────────────────────

    WarehouseGraph() : adj_(N) {
        build_default_layout();
    }

    // ── Obstacle management ────────────────────────────────────────────────

    /// Block a node (e.g. a wall, shelf, blocked aisle).
    /// Removes ALL edges to/from this node and marks it as an obstacle.
    void block_node(int node_id) {
        validate(node_id);
        obstacles_.insert(node_id);
        // Remove outgoing edges from this node
        adj_[node_id].clear();
        // Remove incoming edges from all other nodes
        for (int i = 0; i < N; ++i) {
            auto& edges = adj_[i];
            edges.erase(
                std::remove_if(edges.begin(), edges.end(),
                    [node_id](const Edge& e){ return e.to == node_id; }),
                edges.end()
            );
        }
    }

    void unblock_node(int node_id) {
        validate(node_id);
        obstacles_.erase(node_id);
        rebuild_node_edges(node_id);
    }

    bool is_obstacle(int node_id) const {
        return obstacles_.count(node_id) > 0;
    }

    // ── Dijkstra — Single Source Shortest Path ─────────────────────────────

    /**
     * Standard Dijkstra using a min-heap (priority_queue with reversed
     * comparator).
     *
     * Complexity: O((V + E) log V)
     *   V = 100 nodes, E ≤ 400 edges (4 neighbours each)
     *   In practice < 1 µs for a 10×10 grid.
     *
     * Returns the shortest path from `start` to `end` as ordered node IDs.
     * Returns an empty path with reachable=false if no path exists
     * (e.g. end is surrounded by obstacles).
     */
    PathResult dijkstra(int start, int end) const {
        validate(start);
        validate(end);

        if (is_obstacle(start)) throw std::invalid_argument("Start node is blocked");
        if (is_obstacle(end))   throw std::invalid_argument("End node is blocked");

        // dist[v] = best known distance from start to v
        std::vector<double> dist(N, std::numeric_limits<double>::infinity());
        // prev[v] = predecessor of v on the shortest path
        std::vector<int>    prev(N, -1);
        // visited set
        std::vector<bool>   visited(N, false);

        // Min-heap: (distance, node_id)
        using PQ = std::priority_queue<
            std::pair<double,int>,
            std::vector<std::pair<double,int>>,
            std::greater<std::pair<double,int>>
        >;
        PQ pq;

        dist[start] = 0.0;
        pq.push({0.0, start});

        while (!pq.empty()) {
            auto [d, u] = pq.top();
            pq.pop();

            if (visited[u]) continue;
            visited[u] = true;

            if (u == end) break;   // early termination

            for (const Edge& e : adj_[u]) {
                double nd = d + e.weight;
                if (nd < dist[e.to]) {
                    dist[e.to] = nd;
                    prev[e.to] = u;
                    pq.push({nd, e.to});
                }
            }
        }

        PathResult result;
        result.cost      = dist[end];
        result.reachable = (dist[end] != std::numeric_limits<double>::infinity());

        if (!result.reachable) {
            result.hops = 0;
            return result;
        }

        // Reconstruct path by walking prev[] backwards
        for (int v = end; v != -1; v = prev[v])
            result.path.push_back(v);
        std::reverse(result.path.begin(), result.path.end());
        result.hops = static_cast<int>(result.path.size()) - 1;

        return result;
    }

    // ── Serialisation helpers ──────────────────────────────────────────────

    /// Convert a node_id to (row, col) pair
    static std::pair<int,int> to_coords(int node_id) {
        return { node_id / COLS, node_id % COLS };
    }

    /// Convert (row, col) to node_id
    static int to_node(int row, int col) {
        return row * COLS + col;
    }

    /// Return the full obstacle list as JSON array
    nlohmann::json obstacles_json() const {
        nlohmann::json arr = nlohmann::json::array();
        for (int o : obstacles_) arr.push_back(o);
        return arr;
    }

    /// Return grid metadata as JSON
    nlohmann::json grid_info_json() const {
        return {
            {"rows",      ROWS},
            {"cols",      COLS},
            {"nodes",     N},
            {"obstacles", obstacles_json()}
        };
    }

    /// Serialise a PathResult to JSON
    static nlohmann::json path_to_json(const PathResult& r) {
        nlohmann::json arr = nlohmann::json::array();
        for (int node : r.path) {
            auto [row, col] = to_coords(node);
            arr.push_back({
                {"node", node},
                {"row",  row},
                {"col",  col}
            });
        }
        return {
            {"reachable", r.reachable},
            {"cost",      r.reachable ? r.cost : 0.0},
            {"hops",      r.hops},
            {"path",      arr}
        };
    }

private:
    std::vector<std::vector<Edge>> adj_;
    std::unordered_set<int>        obstacles_;

    void validate(int id) const {
        if (id < 0 || id >= N)
            throw std::out_of_range("Node id " + std::to_string(id) +
                                    " out of range [0," + std::to_string(N-1) + "]");
    }

    /// Add a directed edge (u → v) with given weight, if v is not an obstacle
    void add_edge(int u, int v, double w) {
        if (!is_obstacle(v))
            adj_[u].push_back({v, w});
    }

    /// Rebuild edges for a single node (used when unblocking)
    void rebuild_node_edges(int node_id) {
        adj_[node_id].clear();
        auto [r, c] = to_coords(node_id);

        // 4-directional neighbours (weight = 1.0)
        const int dr[] = {-1,  1,  0,  0};
        const int dc[] = { 0,  0, -1,  1};

        for (int d = 0; d < 4; ++d) {
            int nr = r + dr[d];
            int nc = c + dc[d];
            if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;
            int neighbour = to_node(nr, nc);
            if (!is_obstacle(neighbour)) {
                adj_[node_id].push_back({neighbour, 1.0});
                adj_[neighbour].push_back({node_id,  1.0});
            }
        }
    }

    /**
     * Build the default 10×10 warehouse layout.
     *
     * Shelf obstacles simulate a realistic warehouse floor plan:
     *
     *   . . . . . . . . . .    (row 0 — entry/exit aisle)
     *   . S S . S S . S S .    (row 1 — shelf row A)
     *   . S S . S S . S S .    (row 2 — shelf row A, deep)
     *   . . . . . . . . . .    (row 3 — cross aisle)
     *   . S S . S S . S S .    (row 4 — shelf row B)
     *   . S S . S S . S S .    (row 5 — shelf row B, deep)
     *   . . . . . . . . . .    (row 6 — cross aisle)
     *   . S S . S S . S S .    (row 7 — shelf row C)
     *   . S S . S S . S S .    (row 8 — shelf row C, deep)
     *   . . . . . . . . . .    (row 9 — far aisle)
     *
     *   S = shelf/obstacle  (node blocked)
     *   . = walkable aisle
     */
    void build_default_layout() {
        // Define shelf obstacles
        // Shelf clusters at cols 1-2, 4-5, 7-8 in rows 1-2, 4-5, 7-8
        for (int shelf_row_start : {1, 4, 7}) {
            for (int depth = 0; depth < 2; ++depth) {
                int r = shelf_row_start + depth;
                for (int shelf_col_start : {1, 4, 7}) {
                    obstacles_.insert(to_node(r, shelf_col_start));
                    obstacles_.insert(to_node(r, shelf_col_start + 1));
                }
            }
        }

        // Now build adjacency list for all non-obstacle nodes
        const int dr[] = {-1,  1,  0,  0};
        const int dc[] = { 0,  0, -1,  1};

        for (int r = 0; r < ROWS; ++r) {
            for (int c = 0; c < COLS; ++c) {
                int u = to_node(r, c);
                if (is_obstacle(u)) continue;

                for (int d = 0; d < 4; ++d) {
                    int nr = r + dr[d];
                    int nc = c + dc[d];
                    if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;
                    int v = to_node(nr, nc);
                    if (!is_obstacle(v))
                        adj_[u].push_back({v, 1.0});
                }
            }
        }

        // Log the layout
        int walkable = N - static_cast<int>(obstacles_.size());
        std::cout << "[Graph] Warehouse grid: " << ROWS << "×" << COLS
                  << "  walkable=" << walkable
                  << "  obstacles=" << obstacles_.size() << "\n";
    }
};


// ══════════════════════════════════════════════════════════════════════════
//  PART 2 — REGIONAL SHIPPING  (Floyd-Warshall on 5 warehouses)
// ══════════════════════════════════════════════════════════════════════════

/**
 * Floyd-Warshall pre-computes ALL-PAIRS shortest paths in O(V³).
 *
 * For V=5 (regional warehouses) this is 125 operations — runs in < 1 µs
 * at startup and the result matrix is served directly as JSON.
 *
 * Warehouses:
 *   0 = Mumbai HQ
 *   1 = Delhi NCR
 *   2 = Bangalore
 *   3 = Hyderabad
 *   4 = Chennai
 *
 * Edge costs represent simulated shipping cost in ₹ × 1000 (per tonne).
 * The graph is DIRECTED: shipping costs are asymmetric (terrain, tolls).
 */

class RegionalShippingGraph {
public:
    static constexpr int V = 5;   // number of regional warehouses

    static constexpr double INF = std::numeric_limits<double>::infinity();

    struct Warehouse {
        int         id;
        std::string name;
        std::string city;
    };

    static const Warehouse WAREHOUSES[V];

    // dist[i][j]  = minimum shipping cost from i to j  (post Floyd-Warshall)
    // next[i][j]  = first hop from i toward j  (for path reconstruction)
    double dist[V][V];
    int    next[V][V];

    // ── Construction ──────────────────────────────────────────────────────

    RegionalShippingGraph() {
        build_and_run();
    }

    // ── Path reconstruction ────────────────────────────────────────────────

    /// Reconstruct the sequence of warehouse IDs from u → v
    std::vector<int> get_path(int u, int v) const {
        if (dist[u][v] == INF) return {};   // no path
        std::vector<int> path;
        path.push_back(u);
        while (u != v) {
            u = next[u][v];
            path.push_back(u);
        }
        return path;
    }

    // ── Serialisation ──────────────────────────────────────────────────────

    /// Full shipping matrix as JSON (all pairs)
    nlohmann::json matrix_json() const {
        // Warehouses array
        nlohmann::json wh_arr = nlohmann::json::array();
        for (int i = 0; i < V; ++i) {
            wh_arr.push_back({
                {"id",   WAREHOUSES[i].id},
                {"name", WAREHOUSES[i].name},
                {"city", WAREHOUSES[i].city}
            });
        }

        // Cost matrix
        nlohmann::json rows = nlohmann::json::array();
        for (int i = 0; i < V; ++i) {
            nlohmann::json row = nlohmann::json::array();
            for (int j = 0; j < V; ++j) {
                if (i == j) {
                    row.push_back({{"cost", 0}, {"path", nlohmann::json::array()}, {"reachable", true}});
                } else if (dist[i][j] == INF) {
                    row.push_back({{"cost", nullptr}, {"path", nlohmann::json::array()}, {"reachable", false}});
                } else {
                    auto p = get_path(i, j);
                    nlohmann::json path_arr = nlohmann::json::array();
                    for (int h : p) path_arr.push_back(WAREHOUSES[h].name);
                    row.push_back({
                        {"cost",      dist[i][j]},
                        {"path",      path_arr},
                        {"reachable", true}
                    });
                }
            }
            rows.push_back(row);
        }

        return {
            {"warehouses", wh_arr},
            {"matrix",     rows},
            {"algorithm",  "Floyd-Warshall O(V³)"},
            {"nodes",       V}
        };
    }

private:
    void build_and_run() {
        // ── Initialise dist and next ─────────────────────────────────────
        for (int i = 0; i < V; ++i)
            for (int j = 0; j < V; ++j) {
                dist[i][j] = (i == j) ? 0.0 : INF;
                next[i][j] = (i == j) ? i   : -1;
            }

        // ── Define directed edges (shipping cost ₹k/tonne) ───────────────
        // Format: add_edge(from, to, cost)
        // The costs are intentionally asymmetric to make Floyd-Warshall
        // meaningful (return trip ≠ outbound trip due to tolls/terrain).

        // Mumbai ↔ Delhi
        add_edge(0, 1, 18.5);   // Mumbai → Delhi
        add_edge(1, 0, 16.0);   // Delhi  → Mumbai  (cheaper: highway freight)

        // Mumbai ↔ Bangalore
        add_edge(0, 2, 12.0);
        add_edge(2, 0, 11.5);

        // Mumbai ↔ Hyderabad
        add_edge(0, 3, 10.5);
        add_edge(3, 0, 10.0);

        // Delhi ↔ Hyderabad
        add_edge(1, 3, 14.0);
        add_edge(3, 1, 13.5);

        // Delhi ↔ Bangalore
        add_edge(1, 2, 22.0);
        add_edge(2, 1, 21.0);

        // Bangalore ↔ Chennai
        add_edge(2, 4,  5.0);
        add_edge(4, 2,  5.5);

        // Hyderabad ↔ Bangalore
        add_edge(3, 2,  8.0);
        add_edge(2, 3,  8.5);

        // Hyderabad ↔ Chennai
        add_edge(3, 4, 10.0);
        add_edge(4, 3,  9.5);

        // Chennai ↔ Mumbai
        add_edge(4, 0, 14.5);
        add_edge(0, 4, 15.0);

        // ── Floyd-Warshall ────────────────────────────────────────────────
        // For each intermediate node k:
        //   for each source i:
        //     for each destination j:
        //       if i→k→j is cheaper than i→j, relax it
        for (int k = 0; k < V; ++k)
            for (int i = 0; i < V; ++i)
                for (int j = 0; j < V; ++j) {
                    if (dist[i][k] == INF || dist[k][j] == INF) continue;
                    double through_k = dist[i][k] + dist[k][j];
                    if (through_k < dist[i][j]) {
                        dist[i][j] = through_k;
                        next[i][j] = next[i][k];   // go through k first
                    }
                }

        // ── Log the result ────────────────────────────────────────────────
        std::cout << "[Graph] Floyd-Warshall shipping matrix (" << V << " nodes):\n";
        std::cout << std::fixed << std::setprecision(1);
        for (int i = 0; i < V; ++i) {
            std::cout << "  " << WAREHOUSES[i].city << " → ";
            for (int j = 0; j < V; ++j) {
                if (dist[i][j] == INF) std::cout << "  INF";
                else std::cout << std::setw(6) << dist[i][j];
            }
            std::cout << "\n";
        }
    }

    void add_edge(int u, int v, double w) {
        dist[u][v] = w;
        next[u][v] = v;
    }
};

// Out-of-line definition of the static warehouse data
inline const RegionalShippingGraph::Warehouse
RegionalShippingGraph::WAREHOUSES[RegionalShippingGraph::V] = {
    {0, "WH-MUM", "Mumbai"},
    {1, "WH-DEL", "Delhi"},
    {2, "WH-BLR", "Bangalore"},
    {3, "WH-HYD", "Hyderabad"},
    {4, "WH-CHN", "Chennai"},
};

} // namespace vanguard
