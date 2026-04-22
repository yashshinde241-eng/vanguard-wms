#pragma once

/**
 * Vanguard-WMS · Phase 4 · 0/1 Knapsack Optimizer
 *
 * Classic bottom-up Dynamic Programming solution.
 *
 * PROBLEM:
 *   Given a set of n products, each with weight w_i and value v_i,
 *   and a box with capacity W kg, find the subset that maximises
 *   total value without exceeding W.
 *
 * COMPLEXITY: O(n × W) time, O(n × W) space for the DP table.
 *   (Space can be reduced to O(W) with a 1-D rolling array; we keep
 *    the 2-D table so we can do full traceback to recover which items
 *    were selected — required for the frontend "packed vs left-out" UI.)
 *
 * WEIGHT ENCODING:
 *   Product weights are derived from price: weight_kg = ceil(price / 500).
 *   This gives a meaningful spread without adding a weight field to the DB.
 *   Callers may override by passing an explicit weights vector.
 *
 * PRECISION:
 *   The DP table works in integer grams (capacity × 1000).
 *   Weight in grams = ceil(price / 0.5).  This avoids floating-point
 *   rounding in the DP recurrence.
 */

#include "database.h"
#include <vector>
#include <string>
#include <algorithm>
#include <cmath>
#include <stdexcept>
#include <nlohmann/json.hpp>

namespace vanguard {

// ── KnapsackItem — what the optimizer operates on ─────────────────────────

struct KnapsackItem {
    int         product_id;
    std::string sku;
    std::string name;
    int         weight_g;   // weight in grams (integer for exact DP)
    double      value;      // monetary value (₹)
    int         quantity;   // used for display only; each item counts as 1 unit
};

// ── KnapsackResult ────────────────────────────────────────────────────────

struct KnapsackResult {
    std::vector<KnapsackItem> packed;       // items selected by DP
    std::vector<KnapsackItem> left_out;     // items NOT selected
    double                    total_value;  // sum of packed item values
    int                       total_weight_g; // sum of packed weights (grams)
    int                       capacity_g;   // box capacity in grams
    double                    efficiency;   // total_weight / capacity (0–1)
    int                       n_items;      // number of candidate items
    long long                 dp_ops;       // n × W (for DSA insights)
};

// ── Optimizer ─────────────────────────────────────────────────────────────

class Optimizer {
public:
    /**
     * solve() — 0/1 Knapsack via bottom-up DP.
     *
     * @param capacity_kg  Box capacity in kilograms (converted to grams internally)
     * @param items        Candidate items to pack
     * @returns            KnapsackResult with packed/left_out breakdown
     *
     * DP RECURRENCE:
     *   dp[i][w] = maximum value using items 0..i-1 with capacity w grams
     *
     *   Base case:  dp[0][w] = 0  for all w
     *
     *   For item i (1-indexed), weight w_i, value v_i:
     *     if w_i > w:   dp[i][w] = dp[i-1][w]         (item too heavy, skip)
     *     else:         dp[i][w] = max(dp[i-1][w],     (skip item)
     *                                  dp[i-1][w-w_i] + v_i)  (take item)
     *
     * TRACEBACK:
     *   Walk backwards from dp[n][W] to identify which items were selected.
     */
    static KnapsackResult solve(double capacity_kg,
                                const std::vector<KnapsackItem>& items)
    {
        if (capacity_kg <= 0)
            throw std::invalid_argument("Capacity must be positive");
        if (items.empty()) {
            return KnapsackResult{ {}, {}, 0.0, 0,
                static_cast<int>(capacity_kg * 1000), 0.0, 0, 0 };
        }

        int W = static_cast<int>(std::round(capacity_kg * 1000.0)); // capacity in grams
        int n = static_cast<int>(items.size());

        // Clamp to prevent runaway memory usage (max 50kg = 50,000g × 200 items = 10M cells)
        if (W > 50000)
            throw std::invalid_argument("Capacity exceeds 50 kg maximum");
        if (n > 200)
            throw std::invalid_argument("Too many items (max 200)");

        // ── Build DP table ─────────────────────────────────────────────
        // dp[i][w] = best value with first i items and capacity w grams
        // Using vector<vector> — each row is items 0..i-1
        std::vector<std::vector<double>> dp(n + 1, std::vector<double>(W + 1, 0.0));

        for (int i = 1; i <= n; ++i) {
            int    wi = items[i-1].weight_g;
            double vi = items[i-1].value;

            for (int w = 0; w <= W; ++w) {
                // Option 1: skip item i
                dp[i][w] = dp[i-1][w];

                // Option 2: include item i (only if it fits)
                if (wi <= w) {
                    double take_val = dp[i-1][w - wi] + vi;
                    if (take_val > dp[i][w])
                        dp[i][w] = take_val;
                }
            }
        }

        // ── Traceback to find which items are packed ───────────────────
        std::vector<bool> selected(n, false);
        int w = W;
        for (int i = n; i >= 1; --i) {
            // If value changed between row i and i-1, item i was included
            if (dp[i][w] != dp[i-1][w]) {
                selected[i-1] = true;
                w -= items[i-1].weight_g;
            }
        }

        // ── Assemble result ────────────────────────────────────────────
        KnapsackResult result;
        result.capacity_g   = W;
        result.n_items      = n;
        result.dp_ops       = static_cast<long long>(n) * W;
        result.total_value  = dp[n][W];
        result.total_weight_g = 0;

        for (int i = 0; i < n; ++i) {
            if (selected[i]) {
                result.packed.push_back(items[i]);
                result.total_weight_g += items[i].weight_g;
            } else {
                result.left_out.push_back(items[i]);
            }
        }

        result.efficiency = W > 0
            ? static_cast<double>(result.total_weight_g) / W
            : 0.0;

        return result;
    }

    // ── Build KnapsackItem from a Product ──────────────────────────────────
    // Weight is derived: price / 500 kg, min 100g, max 10,000g (10 kg/item)
    static KnapsackItem from_product(const Product& p) {
        int weight_g = static_cast<int>(std::ceil(p.price / 500.0) * 1000.0);
        weight_g     = std::clamp(weight_g, 100, 10000);
        return KnapsackItem {
            p.id, p.sku, p.name,
            weight_g,
            p.price,
            p.quantity
        };
    }

    // ── JSON serialisers ───────────────────────────────────────────────────

    static nlohmann::json item_to_json(const KnapsackItem& item) {
        return {
            {"product_id", item.product_id},
            {"sku",        item.sku},
            {"name",       item.name},
            {"weight_g",   item.weight_g},
            {"weight_kg",  item.weight_g / 1000.0},
            {"value",      item.value}
        };
    }

    static nlohmann::json result_to_json(const KnapsackResult& r) {
        nlohmann::json packed_arr = nlohmann::json::array();
        for (const auto& i : r.packed)    packed_arr.push_back(item_to_json(i));

        nlohmann::json left_arr = nlohmann::json::array();
        for (const auto& i : r.left_out)  left_arr.push_back(item_to_json(i));

        return {
            {"packed",          packed_arr},
            {"left_out",        left_arr},
            {"total_value",     r.total_value},
            {"total_weight_g",  r.total_weight_g},
            {"total_weight_kg", r.total_weight_g / 1000.0},
            {"capacity_g",      r.capacity_g},
            {"capacity_kg",     r.capacity_g / 1000.0},
            {"efficiency",      r.efficiency},
            {"n_items",         r.n_items},
            {"dp_ops",          r.dp_ops},
            {"algorithm",       "0/1 Knapsack O(n×W)"}
        };
    }
};

} // namespace vanguard
