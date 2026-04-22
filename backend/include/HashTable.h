#pragma once

/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  Vanguard-WMS · Phase 2 · Hash Table                            ║
 * ║                                                                  ║
 * ║  Open-addressing hash table with linear probing.                ║
 * ║  Key   : Product::sku  (std::string)                            ║
 * ║  Value : Product                                                 ║
 * ║                                                                  ║
 * ║  Design choices:                                                 ║
 * ║  • djb2 hash function — fast, low collision rate on SKU data.   ║
 * ║  • Load factor threshold 0.65 — triggers resize + rehash.       ║
 * ║  • Tombstone deletion — keeps probe chains intact.              ║
 * ║  • Exposes collision_count() for the DSA Insights panel.        ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

#include "database.h"
#include <string>
#include <vector>
#include <optional>
#include <stdexcept>
#include <cstdint>

namespace vanguard {

class HashTable {
public:
    // Start with 64 buckets; doubles on resize.
    explicit HashTable(std::size_t initial_capacity = 64)
        : buckets_(initial_capacity), size_(0), collision_count_(0) {}

    // ── Mutations ─────────────────────────────────────────────────────────

    /// Insert or overwrite the product for the given SKU.
    void insert(const Product& product) {
        if (load_factor() >= LOAD_FACTOR_THRESHOLD)
            rehash(buckets_.size() * 2);

        std::size_t idx = probe_insert(product.sku);
        if (!buckets_[idx].occupied) {
            ++size_;
        }
        buckets_[idx].product  = product;
        buckets_[idx].occupied = true;
        buckets_[idx].deleted  = false;
    }

    /// Mark slot as deleted (tombstone). O(1) amortised.
    bool remove(const std::string& sku) {
        std::size_t idx = probe_find(sku);
        if (idx == NPOS) return false;
        buckets_[idx].deleted  = true;
        buckets_[idx].occupied = false;
        --size_;
        return true;
    }

    // ── Queries ───────────────────────────────────────────────────────────

    /// O(1) average lookup. Returns nullptr on miss.
    const Product* find(const std::string& sku) const {
        std::size_t idx = probe_find_const(sku);
        if (idx == NPOS) return nullptr;
        return &buckets_[idx].product;
    }

    // ── Stats ─────────────────────────────────────────────────────────────

    std::size_t size()            const { return size_; }
    std::size_t capacity()        const { return buckets_.size(); }
    double      load_factor()     const { return static_cast<double>(size_) / buckets_.size(); }
    std::size_t collision_count() const { return collision_count_; }
    bool        empty()           const { return size_ == 0; }

    /// Reset the collision counter (called after initial bulk-load).
    void reset_collision_count() { collision_count_ = 0; }

private:
    static constexpr double      LOAD_FACTOR_THRESHOLD = 0.65;
    static constexpr std::size_t NPOS = std::size_t(-1);

    struct Bucket {
        Product     product  {};
        bool        occupied { false };
        bool        deleted  { false };
    };

    std::vector<Bucket> buckets_;
    std::size_t         size_;
    mutable std::size_t collision_count_;

    // ── djb2 hash function ─────────────────────────────────────────────

    /// djb2 — Daniel J. Bernstein's classic string hasher.
    /// hash = 5381; for each char c: hash = hash * 33 ^ c
    static std::size_t djb2(const std::string& key) {
        std::size_t hash = 5381;
        for (unsigned char c : key)
            hash = ((hash << 5) + hash) ^ c;   // hash * 33 XOR c
        return hash;
    }

    std::size_t home_slot(const std::string& key) const {
        return djb2(key) % buckets_.size();
    }

    // ── Linear probe — insert path ─────────────────────────────────────

    std::size_t probe_insert(const std::string& sku) {
        std::size_t idx        = home_slot(sku);
        std::size_t tombstone  = NPOS;
        std::size_t probes     = 0;

        while (true) {
            Bucket& b = buckets_[idx];

            if (!b.occupied && !b.deleted) {
                // Empty slot — use it, or the earlier tombstone if we found one
                return (tombstone != NPOS) ? tombstone : idx;
            }
            if (b.deleted && tombstone == NPOS) {
                tombstone = idx;   // remember first tombstone for reuse
            }
            if (b.occupied && b.product.sku == sku) {
                return idx;        // update existing key
            }

            ++probes;
            if (probes > 1) ++collision_count_;
            idx = (idx + 1) % buckets_.size();
        }
    }

    // ── Linear probe — find path (mutable) ────────────────────────────

    std::size_t probe_find(const std::string& sku) {
        std::size_t idx    = home_slot(sku);
        std::size_t probes = 0;

        while (probes < buckets_.size()) {
            const Bucket& b = buckets_[idx];
            if (!b.occupied && !b.deleted) return NPOS;   // true empty — stop
            if (b.occupied && b.product.sku == sku) return idx;
            idx = (idx + 1) % buckets_.size();
            ++probes;
        }
        return NPOS;
    }

    // ── Linear probe — find path (const) ──────────────────────────────

    std::size_t probe_find_const(const std::string& sku) const {
        std::size_t idx    = home_slot(sku);
        std::size_t probes = 0;

        while (probes < buckets_.size()) {
            const Bucket& b = buckets_[idx];
            if (!b.occupied && !b.deleted) return NPOS;
            if (b.occupied && b.product.sku == sku) return idx;
            idx = (idx + 1) % buckets_.size();
            ++probes;
        }
        return NPOS;
    }

    // ── Rehash ─────────────────────────────────────────────────────────

    void rehash(std::size_t new_capacity) {
        std::vector<Bucket> old = std::move(buckets_);
        buckets_.assign(new_capacity, Bucket{});
        size_ = 0;
        // collision_count_ intentionally preserved across resize

        for (const auto& b : old) {
            if (b.occupied) {
                std::size_t idx = probe_insert(b.product.sku);
                buckets_[idx] = b;
                ++size_;
            }
        }
    }
};

} // namespace vanguard
