#pragma once

/**
 * Vanguard-WMS · Phase 4 · Priority Queue (Max-Heap)
 *
 * A binary max-heap over Order objects keyed on urgency_score.
 *
 * HEAP INVARIANT: parent.urgency >= child.urgency for every node.
 * Stored as a flat std::vector (classic array-based heap).
 *   parent(i)     = (i-1)/2
 *   left_child(i) = 2i+1
 *   right_child(i)= 2i+2
 *
 * Complexity:
 *   push  → O(log n)  bubble-up
 *   pop   → O(log n)  swap root + sift-down
 *   peek  → O(1)      root is always max
 *
 * Urgency Score:
 *   type_weight  = {URGENT=100, EXPRESS=50, STANDARD=10, ECONOMY=1} × 10
 *   value_bonus  = log1p(value) × 2
 *   qty_bonus    = sqrt(quantity)
 *   age_bonus    = minutes_since_created × 0.1
 *   urgency      = type_weight + value_bonus + qty_bonus + age_bonus
 */

#include <vector>
#include <string>
#include <stdexcept>
#include <algorithm>
#include <chrono>
#include <cmath>
#include <nlohmann/json.hpp>

namespace vanguard {

// ── Shipping type ──────────────────────────────────────────────────────────

enum class ShippingType { ECONOMY = 1, STANDARD = 10, EXPRESS = 50, URGENT = 100 };

inline std::string shipping_type_str(ShippingType t) {
    switch (t) {
        case ShippingType::URGENT:   return "URGENT";
        case ShippingType::EXPRESS:  return "EXPRESS";
        case ShippingType::STANDARD: return "STANDARD";
        default:                     return "ECONOMY";
    }
}

inline ShippingType shipping_type_from_str(const std::string& s) {
    if (s == "URGENT")  return ShippingType::URGENT;
    if (s == "EXPRESS") return ShippingType::EXPRESS;
    if (s == "ECONOMY") return ShippingType::ECONOMY;
    return ShippingType::STANDARD;
}

// ── Order struct ───────────────────────────────────────────────────────────

struct Order {
    int          id;
    std::string  order_ref;
    std::string  customer_name;
    std::string  sku;
    int          quantity;
    double       value;
    ShippingType shipping_type;
    int64_t      created_at_sec;
    double       urgency_score;

    // Factory: construct and score immediately
    static Order make(int id_,
                      std::string ref,
                      std::string customer,
                      std::string sku_,
                      int qty,
                      double val,
                      ShippingType type)
    {
        Order o;
        o.id             = id_;
        o.order_ref      = std::move(ref);
        o.customer_name  = std::move(customer);
        o.sku            = std::move(sku_);
        o.quantity       = qty;
        o.value          = val;
        o.shipping_type  = type;
        o.created_at_sec = std::chrono::duration_cast<std::chrono::seconds>(
                               std::chrono::system_clock::now().time_since_epoch()).count();
        o.urgency_score  = o.compute_score();
        return o;
    }

    // Static score (no age) — used at creation time
    double compute_score() const {
        double type_w     = static_cast<double>(static_cast<int>(shipping_type)) * 10.0;
        double value_bonus = std::log1p(value) * 2.0;
        double qty_bonus   = std::sqrt(static_cast<double>(quantity));
        return type_w + value_bonus + qty_bonus;
    }

    // Live score includes age bonus — used at pop/peek time
    double live_score() const {
        auto now = std::chrono::duration_cast<std::chrono::seconds>(
                       std::chrono::system_clock::now().time_since_epoch()).count();
        double age_min = static_cast<double>(now - created_at_sec) / 60.0;
        return compute_score() + age_min * 0.1;
    }
};

// ── JSON helper ────────────────────────────────────────────────────────────

inline nlohmann::json order_to_json(const Order& o) {
    return {
        {"id",            o.id},
        {"order_ref",     o.order_ref},
        {"customer_name", o.customer_name},
        {"sku",           o.sku},
        {"quantity",      o.quantity},
        {"value",         o.value},
        {"shipping_type", shipping_type_str(o.shipping_type)},
        {"created_at",    o.created_at_sec},
        {"urgency_score", o.live_score()}
    };
}

// ── OrderHeap: binary max-heap ─────────────────────────────────────────────

class OrderHeap {
public:
    OrderHeap() = default;

    // push — append + bubble-up  O(log n)
    void push(Order order) {
        heap_.push_back(std::move(order));
        bubble_up(static_cast<int>(heap_.size()) - 1);
        ++total_pushed_;
    }

    // pop — extract max: swap root with last, remove last, sift-down  O(log n)
    Order pop() {
        if (heap_.empty())
            throw std::underflow_error("OrderHeap::pop on empty heap");

        // Refresh all live scores before extracting so age is current
        for (auto& o : heap_) o.urgency_score = o.live_score();
        // Re-build heap after score refresh
        for (int i = (static_cast<int>(heap_.size()) - 2) / 2; i >= 0; --i)
            sift_down(i);

        Order top = heap_.front();
        std::swap(heap_.front(), heap_.back());
        heap_.pop_back();
        if (!heap_.empty()) sift_down(0);
        ++total_popped_;
        return top;
    }

    // peek — O(1)
    const Order& peek() const {
        if (heap_.empty())
            throw std::underflow_error("OrderHeap::peek on empty heap");
        return heap_.front();
    }

    bool empty()          const { return heap_.empty(); }
    int  size()           const { return static_cast<int>(heap_.size()); }
    int  total_pushed()   const { return total_pushed_; }
    int  total_popped()   const { return total_popped_; }

    // Return all orders sorted by live urgency descending (copy, not destructive)
    nlohmann::json all_json() const {
        std::vector<Order> sorted = heap_;
        for (auto& o : sorted) o.urgency_score = o.live_score();
        std::sort(sorted.begin(), sorted.end(),
            [](const Order& a, const Order& b){
                return a.urgency_score > b.urgency_score;
            });
        nlohmann::json arr = nlohmann::json::array();
        for (const auto& o : sorted) arr.push_back(order_to_json(o));
        return arr;
    }

    nlohmann::json stats_json() const {
        int h = heap_.empty() ? 0
              : static_cast<int>(std::floor(std::log2(heap_.size()))) + 1;
        return {
            {"size",         size()},
            {"height",       h},
            {"total_pushed", total_pushed_},
            {"total_popped", total_popped_},
            {"top_score",    heap_.empty() ? 0.0 : heap_.front().urgency_score}
        };
    }

private:
    std::vector<Order> heap_;
    int total_pushed_ {0};
    int total_popped_ {0};

    static int parent(int i)      { return (i - 1) / 2; }
    static int left_child(int i)  { return 2 * i + 1; }
    static int right_child(int i) { return 2 * i + 2; }
    int sz() const { return static_cast<int>(heap_.size()); }

    void bubble_up(int i) {
        while (i > 0) {
            int p = parent(i);
            if (heap_[i].urgency_score > heap_[p].urgency_score) {
                std::swap(heap_[i], heap_[p]);
                i = p;
            } else break;
        }
    }

    void sift_down(int i) {
        while (true) {
            int largest = i;
            int l = left_child(i), r = right_child(i);
            if (l < sz() && heap_[l].urgency_score > heap_[largest].urgency_score)
                largest = l;
            if (r < sz() && heap_[r].urgency_score > heap_[largest].urgency_score)
                largest = r;
            if (largest == i) break;
            std::swap(heap_[i], heap_[largest]);
            i = largest;
        }
    }
};

} // namespace vanguard
