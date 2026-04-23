#pragma once

/**
 * Vanguard-WMS · Phase 5 · Inventory Engine
 *
 * Extends Phase 4 with:
 *   - HuffmanCoder  — IoT data compression
 *   - TSPSolver     — Multi-stop picker route optimisation
 *
 * All Phase 1-4 structures unchanged.
 */

#include "database.h"
#include "AVLTree.h"
#include "HashTable.h"
#include "LCRSTree.h"
#include "WarehouseGraph.h"
#include "PriorityQueue.h"
#include "Optimizer.h"
#include "Huffman.h"        // Phase 5
#include "TSPSolver.h"      // Phase 5

#include <memory>
#include <vector>
#include <string>
#include <iostream>
#include <iomanip>
#include <chrono>
#include <cmath>
#include <mutex>
#include <atomic>

namespace vanguard {

class InventoryEngine {
public:
    explicit InventoryEngine(std::shared_ptr<Database> db)
        : db_(std::move(db))
    {
        load_from_db();
        std::cout << "[Engine] Phase 5 efficiency suite ready.\n";
    }

    // ═══════════════════════════════════════════════════════════════════
    //  PHASES 1-4 API  (all unchanged)
    // ═══════════════════════════════════════════════════════════════════

    Product add_product(const std::string& sku, const std::string& name,
                        const std::string& category, int qty, double price,
                        int wx = 0, int wy = 0)
    {
        Product p = db_->insert_product(sku, name, category, qty, price, wx, wy);
        avl_.insert(p); ht_.insert(p); lcrs_.insert_category(p.category);
        return p;
    }

    std::vector<Product>  search(const std::string& q) const { return avl_.fulltext_search(q); }
    const Product*        find_by_sku(const std::string& s)  const { return ht_.find(s); }
    std::vector<Product>  all_products()                     const { return avl_.inorder_products(); }
    nlohmann::json        categories_json()                  const { return lcrs_.to_json(); }

    WarehouseGraph::PathResult find_path(int s, int e)  const { return wgraph_.dijkstra(s, e); }
    nlohmann::json             grid_info()              const { return wgraph_.grid_info_json(); }
    nlohmann::json             shipping_matrix()        const { return shipping_.matrix_json(); }
    void                       block_node(int n)              { wgraph_.block_node(n); }
    void                       unblock_node(int n)            { wgraph_.unblock_node(n); }

    Order push_order(std::string ref, std::string customer,
                     std::string sku, int qty, double value, ShippingType type)
    {
        int id = ++next_order_id_;
        Order o = Order::make(id, std::move(ref), std::move(customer),
                              std::move(sku), qty, value, type);
        std::lock_guard<std::mutex> lk(heap_mutex_);
        order_heap_.push(o);
        return o;
    }
    Order          pop_order()            { std::lock_guard<std::mutex> lk(heap_mutex_); return order_heap_.pop(); }
    nlohmann::json peek_order_json() const {
        std::lock_guard<std::mutex> lk(heap_mutex_);
        return order_heap_.empty() ? nlohmann::json(nullptr) : order_to_json(order_heap_.peek());
    }
    nlohmann::json orders_json()       const { std::lock_guard<std::mutex> lk(heap_mutex_); return order_heap_.all_json(); }
    nlohmann::json orders_stats_json() const { std::lock_guard<std::mutex> lk(heap_mutex_); return order_heap_.stats_json(); }
    bool           orders_empty()      const { std::lock_guard<std::mutex> lk(heap_mutex_); return order_heap_.empty(); }

    KnapsackResult optimise_packing(const std::vector<int>& pids, double cap) const {
        std::vector<KnapsackItem> items;
        for (int pid : pids) {
            auto products = avl_.inorder_products();
            for (const auto& p : products)
                if (p.id == pid) { items.push_back(Optimizer::from_product(p)); break; }
        }
        if (items.empty()) throw std::runtime_error("No valid products found");
        return Optimizer::solve(cap, items);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  PHASE 5 — Huffman Compression
    // ═══════════════════════════════════════════════════════════════════

    /**
     * compress() — Huffman-encode an arbitrary string (typically JSON payload).
     * Returns full encode result including bitstream, codebook, and statistics.
     */
    HuffmanEncodeResult compress(const std::string& data) const {
        return HuffmanCoder::encode(data);
    }

    /**
     * decompress() — Decode a bitstream back to original text using codebook.
     */
    HuffmanDecodeResult decompress(
            const std::string& bitstream,
            const std::unordered_map<char,std::string>& codebook) const
    {
        return HuffmanCoder::decode(bitstream, codebook);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  PHASE 5 — TSP Multi-Stop Route
    // ═══════════════════════════════════════════════════════════════════

    /**
     * solve_tsp() — given a list of product IDs, looks up their warehouse
     * coordinates, then runs the TSP solver to find the optimal picker tour.
     *
     * @param product_ids  Products to collect (must have warehouse_x, warehouse_y)
     * @param depot_node   Starting/ending node (default 0 = entry point)
     */
    TSPResult solve_tsp(const std::vector<int>& product_ids,
                        int depot_node = 0) const
    {
        // Convert product IDs to grid node IDs
        std::vector<int> stop_nodes;
        stop_nodes.reserve(product_ids.size());

        auto all = avl_.inorder_products();
        for (int pid : product_ids) {
            for (const auto& p : all) {
                if (p.id == pid) {
                    int node = p.warehouse_y * 10 + p.warehouse_x;
                    stop_nodes.push_back(node);
                    break;
                }
            }
        }

        if (stop_nodes.empty())
            throw std::runtime_error("TSP: no valid product locations found");

        return TSPSolver::solve(stop_nodes, depot_node, wgraph_);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  DSA STATS  (extended with Phase 5 fields)
    // ═══════════════════════════════════════════════════════════════════

    struct Stats {
        int    avl_height, avl_size;
        double avl_theoretical_min_height;
        int    ht_size, ht_capacity;
        double ht_load_factor;
        int    ht_collisions, lcrs_node_count;
        int    graph_nodes, graph_obstacles, graph_walkable, shipping_nodes;
        int    heap_size, heap_height;
        int    heap_total_pushed, heap_total_popped;
        double heap_top_score;
        // Phase 5 (no persistent state — algorithms are stateless)
        // Stats are reported per-request in the API response
    };

    Stats stats() const {
        int n = avl_.size();
        double min_h = n > 0 ? std::floor(std::log2(n + 1.0)) : 0.0;
        int obs = static_cast<int>(wgraph_.obstacles_json().size());
        auto hs = order_heap_.stats_json();
        return Stats {
            avl_.height(), n, min_h,
            (int)ht_.size(), (int)ht_.capacity(), ht_.load_factor(),
            (int)ht_.collision_count(), lcrs_.node_count(),
            WarehouseGraph::N, obs, WarehouseGraph::N - obs,
            RegionalShippingGraph::V,
            hs["size"].get<int>(), hs["height"].get<int>(),
            hs["total_pushed"].get<int>(), hs["total_popped"].get<int>(),
            hs["top_score"].get<double>()
        };
    }

private:
    std::shared_ptr<Database>  db_;
    AVLTree    avl_;
    HashTable  ht_;
    LCRSTree   lcrs_;
    WarehouseGraph        wgraph_;
    RegionalShippingGraph shipping_;
    OrderHeap              order_heap_;
    mutable std::mutex     heap_mutex_;
    std::atomic<int>       next_order_id_ {0};

    void load_from_db() {
        auto t0 = std::chrono::steady_clock::now();
        for (const auto& p : db_->get_all_products()) {
            avl_.insert(p); ht_.insert(p); lcrs_.insert_category(p.category);
        }
        ht_.reset_collision_count();
        auto us = std::chrono::duration_cast<std::chrono::microseconds>(
                      std::chrono::steady_clock::now() - t0).count();
        std::cout << "[Engine] Loaded " << avl_.size() << " products in " << us << " µs\n";
    }
};

} // namespace vanguard
