#pragma once

/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  Vanguard-WMS · Phase 2 · AVL Tree                              ║
 * ║                                                                  ║
 * ║  A self-balancing Binary Search Tree keyed on Product::sku.     ║
 * ║  Guarantees O(log n) insert, search, and prefix-scan at all     ║
 * ║  times by enforcing the AVL balance invariant after every       ║
 * ║  mutation (|balance_factor| ≤ 1 at every node).                 ║
 * ║                                                                  ║
 * ║  All nodes are heap-allocated via unique_ptr — no raw           ║
 * ║  new/delete anywhere in this file.                               ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

#include "database.h"   // Product struct lives here
#include <memory>
#include <string>
#include <vector>
#include <algorithm>
#include <functional>

namespace vanguard {

// ── Internal node ──────────────────────────────────────────────────────────

struct AVLNode {
    Product                  product;
    int                      height { 1 };
    std::unique_ptr<AVLNode> left   { nullptr };
    std::unique_ptr<AVLNode> right  { nullptr };

    explicit AVLNode(const Product& p) : product(p) {}
};

// ── AVL Tree ───────────────────────────────────────────────────────────────

class AVLTree {
public:
    AVLTree() = default;

    // Non-copyable (unique_ptr ownership chain)
    AVLTree(const AVLTree&)            = delete;
    AVLTree& operator=(const AVLTree&) = delete;

    // ── Mutations ─────────────────────────────────────────────────────────

    /// Insert or update a product (keyed by sku).
    void insert(const Product& product) {
        root_ = insert_node(std::move(root_), product);
        ++size_;
    }

    // ── Queries ───────────────────────────────────────────────────────────

    /// Exact SKU search — O(log n).
    /// Returns nullptr if not found.
    const Product* search(const std::string& sku) const {
        const AVLNode* node = root_.get();
        while (node) {
            if (sku == node->product.sku)        return &node->product;
            else if (sku < node->product.sku)    node = node->left.get();
            else                                 node = node->right.get();
        }
        return nullptr;
    }

    /// Prefix search — returns all products whose SKU starts with `prefix`.
    /// Uses the BST ordering to prune entire subtrees, so it is much faster
    /// than a linear scan on large inventories.
    std::vector<Product> prefix_search(const std::string& prefix) const {
        std::vector<Product> results;
        prefix_collect(root_.get(), prefix, results);
        return results;
    }

    /// Full-text search across SKU and name (case-insensitive substring).
    /// O(n) but used only for the frontend search bar which is debounced.
    std::vector<Product> fulltext_search(const std::string& query) const {
        std::vector<Product> results;
        std::string q = to_lower(query);
        inorder(root_.get(), [&](const Product& p) {
            if (to_lower(p.sku).find(q)      != std::string::npos ||
                to_lower(p.name).find(q)     != std::string::npos ||
                to_lower(p.category).find(q) != std::string::npos)
            {
                results.push_back(p);
            }
        });
        return results;
    }

    // ── Stats exposed to the DSA Insights panel ───────────────────────────

    int  height()   const { return node_height(root_.get()); }
    int  size()     const { return size_; }
    bool empty()    const { return root_ == nullptr; }

    /// Collect all products in sorted (SKU) order.
    std::vector<Product> inorder_products() const {
        std::vector<Product> out;
        out.reserve(size_);
        inorder(root_.get(), [&](const Product& p) { out.push_back(p); });
        return out;
    }

private:
    std::unique_ptr<AVLNode> root_ { nullptr };
    int                      size_ { 0 };

    // ── Height helpers ─────────────────────────────────────────────────

    static int node_height(const AVLNode* n) {
        return n ? n->height : 0;
    }

    static void update_height(AVLNode* n) {
        if (n)
            n->height = 1 + std::max(node_height(n->left.get()),
                                     node_height(n->right.get()));
    }

    static int balance_factor(const AVLNode* n) {
        return n ? node_height(n->left.get()) - node_height(n->right.get()) : 0;
    }

    // ── Rotations ──────────────────────────────────────────────────────

    /// Right rotation around `y`:
    ///
    ///      y                x
    ///     / \              / \
    ///    x   T3    →    T1   y
    ///   / \                 / \
    ///  T1  T2             T2  T3
    static std::unique_ptr<AVLNode> rotate_right(std::unique_ptr<AVLNode> y) {
        std::unique_ptr<AVLNode> x  = std::move(y->left);
        std::unique_ptr<AVLNode> T2 = std::move(x->right);

        x->right = std::move(y);
        x->right->left = std::move(T2);

        update_height(x->right.get());
        update_height(x.get());
        return x;
    }

    /// Left rotation around `x`:
    ///
    ///    x                  y
    ///   / \                / \
    ///  T1   y     →       x   T3
    ///      / \           / \
    ///     T2  T3        T1  T2
    static std::unique_ptr<AVLNode> rotate_left(std::unique_ptr<AVLNode> x) {
        std::unique_ptr<AVLNode> y  = std::move(x->right);
        std::unique_ptr<AVLNode> T2 = std::move(y->left);

        y->left = std::move(x);
        y->left->right = std::move(T2);

        update_height(y->left.get());
        update_height(y.get());
        return y;
    }

    // ── Rebalance ──────────────────────────────────────────────────────

    /// Apply the correct rotation(s) to restore the AVL invariant.
    /// Called bottom-up as the call stack unwinds after insertion.
    static std::unique_ptr<AVLNode> rebalance(std::unique_ptr<AVLNode> node) {
        update_height(node.get());
        int bf = balance_factor(node.get());

        // Left-Left → single right rotation
        if (bf > 1 && balance_factor(node->left.get()) >= 0)
            return rotate_right(std::move(node));

        // Left-Right → left rotate child, then right rotate root
        if (bf > 1 && balance_factor(node->left.get()) < 0) {
            node->left = rotate_left(std::move(node->left));
            return rotate_right(std::move(node));
        }

        // Right-Right → single left rotation
        if (bf < -1 && balance_factor(node->right.get()) <= 0)
            return rotate_left(std::move(node));

        // Right-Left → right rotate child, then left rotate root
        if (bf < -1 && balance_factor(node->right.get()) > 0) {
            node->right = rotate_right(std::move(node->right));
            return rotate_left(std::move(node));
        }

        return node;   // already balanced
    }

    // ── Recursive insert ───────────────────────────────────────────────

    static std::unique_ptr<AVLNode> insert_node(std::unique_ptr<AVLNode> node,
                                                 const Product& product) {
        if (!node)
            return std::make_unique<AVLNode>(product);

        if (product.sku < node->product.sku)
            node->left  = insert_node(std::move(node->left),  product);
        else if (product.sku > node->product.sku)
            node->right = insert_node(std::move(node->right), product);
        else
            node->product = product;   // update in-place on duplicate SKU

        return rebalance(std::move(node));
    }

    // ── Traversals ─────────────────────────────────────────────────────

    static void inorder(const AVLNode* node,
                        const std::function<void(const Product&)>& fn) {
        if (!node) return;
        inorder(node->left.get(),  fn);
        fn(node->product);
        inorder(node->right.get(), fn);
    }

    /// Prune subtrees that cannot possibly contain the prefix.
    static void prefix_collect(const AVLNode*       node,
                                const std::string&  prefix,
                                std::vector<Product>& results) {
        if (!node) return;

        const std::string& sku = node->product.sku;

        // If this node's SKU starts with the prefix, collect it and
        // recurse into BOTH children (siblings may also match).
        if (sku.substr(0, prefix.size()) == prefix) {
            results.push_back(node->product);
            prefix_collect(node->left.get(),  prefix, results);
            prefix_collect(node->right.get(), prefix, results);
        }
        // BST property: if prefix < sku, go left only
        else if (prefix < sku) {
            prefix_collect(node->left.get(),  prefix, results);
        }
        // Otherwise go right
        else {
            prefix_collect(node->right.get(), prefix, results);
        }
    }

    // ── Utility ────────────────────────────────────────────────────────

    static std::string to_lower(std::string s) {
        std::transform(s.begin(), s.end(), s.begin(),
                       [](unsigned char c){ return std::tolower(c); });
        return s;
    }
};

} // namespace vanguard
