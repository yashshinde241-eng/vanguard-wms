#pragma once

/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  Vanguard-WMS · Phase 5 · TSP Solver                            ║
 * ║                                                                  ║
 * ║  Given a set of warehouse node IDs (product locations), finds   ║
 * ║  the shortest circular tour that visits all of them and returns  ║
 * ║  to the start (depot = node 0).                                  ║
 * ║                                                                  ║
 * ║  TWO ALGORITHMS — automatic selection by input size:            ║
 * ║                                                                  ║
 * ║  1. HELD-KARP DP  (n < 15 stops)                                ║
 * ║     Exact optimal solution.                                      ║
 * ║     Complexity: O(2ⁿ × n²) time,  O(2ⁿ × n) space             ║
 * ║     For n=14: 2^14 × 196 ≈ 3.2M operations — fast enough.      ║
 * ║                                                                  ║
 * ║  2. NEAREST NEIGHBOR GREEDY  (n ≥ 15 stops)                     ║
 * ║     Heuristic — typically 20–25% above optimal.                 ║
 * ║     Complexity: O(n²) time,  O(n) space                         ║
 * ║     Always terminates quickly even for large pick lists.         ║
 * ║                                                                  ║
 * ║  INTEGRATION:                                                    ║
 * ║     Pairwise distances between stops are computed via           ║
 * ║     WarehouseGraph::dijkstra() — so obstacle-aware real grid    ║
 * ║     distances are used, NOT Euclidean approximations.           ║
 * ║                                                                  ║
 * ║     The full stitched node-by-node path (every aisle cell       ║
 * ║     visited en route) is returned so the frontend can draw      ║
 * ║     the complete picker's loop on the 10×10 grid.               ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

#include "WarehouseGraph.h"
#include <vector>
#include <string>
#include <limits>
#include <algorithm>
#include <stdexcept>
#include <numeric>
#include <nlohmann/json.hpp>

namespace vanguard {

// ── TSP result ─────────────────────────────────────────────────────────────

struct TSPResult {
    // The optimal/heuristic order in which to visit the stops
    std::vector<int>  tour_order;       // node IDs of stops in visit order

    // The full stitched path through the warehouse grid
    // (each leg = Dijkstra result concatenated, depot at start and end)
    std::vector<int>  full_path;        // every cell node visited

    double            total_cost;       // sum of shortest-path costs between stops
    int               n_stops;          // number of product locations
    std::string       algorithm;        // "Held-Karp" or "Nearest Neighbor"
    bool              is_optimal;       // true only for Held-Karp
    int               dijkstra_calls;   // number of Dijkstra runs performed
};

// ── TSP Solver ─────────────────────────────────────────────────────────────

class TSPSolver {
public:
    static constexpr int HELD_KARP_LIMIT = 14;   // use exact algorithm below this
    static constexpr double INF = std::numeric_limits<double>::infinity();

    /**
     * solve() — main entry point.
     *
     * @param stops    Node IDs of product locations to visit (≥ 2)
     * @param depot    Starting/ending node (default = 0, warehouse entry)
     * @param graph    The warehouse graph for pairwise Dijkstra distances
     */
    static TSPResult solve(std::vector<int>       stops,
                           int                    depot,
                           const WarehouseGraph&  graph)
    {
        // Deduplicate stops
        std::sort(stops.begin(), stops.end());
        stops.erase(std::unique(stops.begin(), stops.end()), stops.end());
        // Remove depot if present (it's implicit start/end)
        stops.erase(std::remove(stops.begin(), stops.end(), depot), stops.end());

        if (stops.empty())
            throw std::invalid_argument("TSP: no stops provided (or all equal to depot)");
        if (stops.size() == 1) {
            // Trivial: depot → stop → depot
            return solve_trivial(stops[0], depot, graph);
        }

        // ── Build pairwise distance + path matrix between all nodes ──────
        // Nodes = { depot } ∪ stops
        // Index 0 = depot, indices 1..n = stops[0..n-1]
        int n = static_cast<int>(stops.size());
        std::vector<int> all_nodes;
        all_nodes.reserve(n + 1);
        all_nodes.push_back(depot);
        for (int s : stops) all_nodes.push_back(s);

        int total = static_cast<int>(all_nodes.size());  // n+1
        int dijkstra_calls = 0;

        // dist_mat[i][j]  = shortest path cost from all_nodes[i] to all_nodes[j]
        // path_mat[i][j]  = the actual node sequence for that leg
        std::vector<std::vector<double>>           dist_mat(total, std::vector<double>(total, INF));
        std::vector<std::vector<std::vector<int>>> path_mat(total,
            std::vector<std::vector<int>>(total));

        for (int i = 0; i < total; ++i) {
            for (int j = 0; j < total; ++j) {
                if (i == j) { dist_mat[i][j] = 0.0; path_mat[i][j] = {all_nodes[i]}; continue; }
                auto r = graph.dijkstra(all_nodes[i], all_nodes[j]);
                ++dijkstra_calls;
                dist_mat[i][j] = r.reachable ? r.cost : INF;
                path_mat[i][j] = r.path;
            }
        }

        // ── Choose algorithm ──────────────────────────────────────────────
        TSPResult result;
        result.n_stops        = n;
        result.dijkstra_calls = dijkstra_calls;

        std::vector<int> stop_indices(n);
        std::iota(stop_indices.begin(), stop_indices.end(), 1);  // indices 1..n

        if (n < HELD_KARP_LIMIT) {
            result.algorithm  = "Held-Karp DP (exact)";
            result.is_optimal = true;
            held_karp(n, dist_mat, stop_indices, result, all_nodes);
        } else {
            result.algorithm  = "Nearest Neighbor (heuristic)";
            result.is_optimal = false;
            nearest_neighbor(n, dist_mat, stop_indices, result, all_nodes);
        }

        // ── Stitch the full path ──────────────────────────────────────────
        stitch_path(result, all_nodes, path_mat);

        return result;
    }

    // ── JSON serialisation ─────────────────────────────────────────────────

    static nlohmann::json result_to_json(const TSPResult& r) {
        nlohmann::json tour = nlohmann::json::array();
        for (int n : r.tour_order) {
            auto [row, col] = WarehouseGraph::to_coords(n);
            tour.push_back({ {"node",n}, {"row",row}, {"col",col} });
        }

        nlohmann::json full = nlohmann::json::array();
        for (int n : r.full_path) {
            auto [row, col] = WarehouseGraph::to_coords(n);
            full.push_back({ {"node",n}, {"row",row}, {"col",col} });
        }

        return {
            {"tour_order",     tour},
            {"full_path",      full},
            {"total_cost",     r.total_cost},
            {"n_stops",        r.n_stops},
            {"algorithm",      r.algorithm},
            {"is_optimal",     r.is_optimal},
            {"dijkstra_calls", r.dijkstra_calls},
            {"full_path_len",  (int)r.full_path.size()}
        };
    }

private:
    // ── Trivial single-stop case ──────────────────────────────────────────

    static TSPResult solve_trivial(int stop, int depot, const WarehouseGraph& graph) {
        TSPResult r;
        r.n_stops        = 1;
        r.algorithm      = "Trivial (1 stop)";
        r.is_optimal     = true;
        r.dijkstra_calls = 2;
        r.tour_order     = { depot, stop, depot };

        auto leg1 = graph.dijkstra(depot, stop);
        auto leg2 = graph.dijkstra(stop,  depot);
        r.total_cost = (leg1.reachable ? leg1.cost : INF)
                     + (leg2.reachable ? leg2.cost : INF);

        r.full_path = leg1.path;
        if (!leg2.path.empty())
            r.full_path.insert(r.full_path.end(),
                               leg2.path.begin() + 1, leg2.path.end());
        return r;
    }

    // ── Held-Karp DP ──────────────────────────────────────────────────────
    /**
     * Classic bitmask DP for exact TSP.
     *
     * State:  dp[S][i] = minimum cost to reach node i having visited
     *                     exactly the set S of stop-indices (bitmask).
     *         S is a bitmask over indices 1..n (stops only; depot = index 0).
     *
     * Recurrence:
     *   dp[S][i] = min over all j ∈ S \ {i} of
     *              dp[S \ {i}][j] + dist[j][i]
     *
     * Base case:
     *   dp[{i}][i] = dist[0][i]   for each stop i
     *
     * Answer:
     *   min over all i of dp[full_mask][i] + dist[i][0]
     */
    static void held_karp(int n,
                           const std::vector<std::vector<double>>& dist,
                           const std::vector<int>&                 stop_idxs,
                           TSPResult&                              result,
                           const std::vector<int>&                 all_nodes)
    {
        int full_mask = (1 << n) - 1;

        // dp[mask][i] and parent[mask][i] for reconstruction
        std::vector<std::vector<double>> dp(1 << n,
            std::vector<double>(n + 1, INF));
        std::vector<std::vector<int>> parent(1 << n,
            std::vector<int>(n + 1, -1));

        // Base: start from depot (index 0) to each stop
        for (int i = 0; i < n; ++i) {
            int mask    = 1 << i;
            int stop_i  = stop_idxs[i];   // index into all_nodes
            dp[mask][i] = dist[0][stop_i];
            parent[mask][i] = 0;           // came from depot
        }

        // Fill DP
        for (int mask = 1; mask <= full_mask; ++mask) {
            for (int i = 0; i < n; ++i) {
                if (!(mask & (1 << i))) continue;      // i not in mask
                if (dp[mask][i] == INF)  continue;

                int prev_mask = mask ^ (1 << i);       // mask without i
                for (int j = 0; j < n; ++j) {
                    if (mask & (1 << j)) continue;     // j already visited
                    int new_mask = mask | (1 << j);
                    int si = stop_idxs[i], sj = stop_idxs[j];
                    double new_cost = dp[mask][i] + dist[si][sj];
                    if (new_cost < dp[new_mask][j]) {
                        dp[new_mask][j] = new_cost;
                        parent[new_mask][j] = i;
                    }
                }
            }
        }

        // Find best final stop (last before returning to depot)
        double best = INF;
        int    last = -1;
        for (int i = 0; i < n; ++i) {
            if (dp[full_mask][i] == INF) continue;
            double total = dp[full_mask][i] + dist[stop_idxs[i]][0];
            if (total < best) { best = total; last = i; }
        }

        if (last == -1) {
            // No valid tour — fall back to nearest neighbor
            nearest_neighbor(n, dist, stop_idxs, result, all_nodes);
            return;
        }

        // Reconstruct tour by tracing parent pointers
        std::vector<int> stop_visit_order;
        int mask = full_mask, cur = last;
        while (cur != 0 && mask != 0) {
            stop_visit_order.push_back(stop_idxs[cur]);
            int prev = parent[mask][cur];
            mask ^= (1 << cur);
            cur = prev;
        }
        std::reverse(stop_visit_order.begin(), stop_visit_order.end());

        // tour_order = depot → stops in order → depot
        result.tour_order.push_back(all_nodes[0]);  // depot
        for (int idx : stop_visit_order)
            result.tour_order.push_back(all_nodes[idx]);
        result.tour_order.push_back(all_nodes[0]);  // return to depot
        result.total_cost = best;
    }

    // ── Nearest Neighbor Greedy ───────────────────────────────────────────
    /**
     * Start at depot. Repeatedly visit the nearest unvisited stop.
     * Return to depot at the end.
     *
     * O(n²) — fast for large pick lists.
     */
    static void nearest_neighbor(int n,
                                   const std::vector<std::vector<double>>& dist,
                                   const std::vector<int>&                 stop_idxs,
                                   TSPResult&                              result,
                                   const std::vector<int>&                 all_nodes)
    {
        std::vector<bool> visited(n, false);
        int    current    = 0;   // depot index
        double total_cost = 0.0;

        result.tour_order.push_back(all_nodes[0]);  // start at depot

        for (int step = 0; step < n; ++step) {
            double best_dist = INF;
            int    best_j    = -1;

            for (int j = 0; j < n; ++j) {
                if (visited[j]) continue;
                double d = dist[current][stop_idxs[j]];
                if (d < best_dist) { best_dist = d; best_j = j; }
            }

            if (best_j == -1) break;   // no reachable unvisited stops

            visited[best_j] = true;
            total_cost += best_dist;
            current     = stop_idxs[best_j];
            result.tour_order.push_back(all_nodes[current]);
        }

        // Return to depot
        total_cost += dist[current][0];
        result.tour_order.push_back(all_nodes[0]);
        result.total_cost = total_cost;
    }

    // ── Stitch full grid path from tour_order ─────────────────────────────
    static void stitch_path(TSPResult&                                        result,
                             const std::vector<int>&                           all_nodes,
                             const std::vector<std::vector<std::vector<int>>>& path_mat)
    {
        if (result.tour_order.size() < 2) return;

        // Build node_id → index map for path_mat lookup
        std::unordered_map<int,int> node_to_idx;
        for (int i = 0; i < static_cast<int>(all_nodes.size()); ++i)
            node_to_idx[all_nodes[i]] = i;

        result.full_path.clear();
        result.full_path.push_back(result.tour_order.front());

        for (int i = 0; i + 1 < static_cast<int>(result.tour_order.size()); ++i) {
            int from = result.tour_order[i];
            int to   = result.tour_order[i + 1];

            auto it_f = node_to_idx.find(from);
            auto it_t = node_to_idx.find(to);
            if (it_f == node_to_idx.end() || it_t == node_to_idx.end()) continue;

            const auto& leg = path_mat[it_f->second][it_t->second];
            // Append leg (skip first node — already in full_path)
            for (int k = 1; k < static_cast<int>(leg.size()); ++k)
                result.full_path.push_back(leg[k]);
        }
    }
};

} // namespace vanguard
