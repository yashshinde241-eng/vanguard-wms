#pragma once

/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  Vanguard-WMS · Phase 2 · LCRS Category Tree                    ║
 * ║                                                                  ║
 * ║  Left-Child Right-Sibling representation of an n-ary tree.      ║
 * ║                                                                  ║
 * ║  LCRS encoding turns any n-ary tree into a binary tree by:      ║
 * ║    left  → first child of this node                             ║
 * ║    right → next sibling (same parent)                           ║
 * ║                                                                  ║
 * ║  This makes it memory-efficient: each node needs exactly two    ║
 * ║  pointers regardless of how many children it has.               ║
 * ║                                                                  ║
 * ║  Category paths are slash-delimited strings:                    ║
 * ║    "Electronics/Mobile/Chargers"                                ║
 * ║    "Mechanical/Hydraulics"                                       ║
 * ║                                                                  ║
 * ║  The root node is a virtual sentinel ("__ROOT__").              ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

#include <string>
#include <vector>
#include <memory>
#include <sstream>
#include <nlohmann/json.hpp>

namespace vanguard {

// ── LCRS Node ─────────────────────────────────────────────────────────────

struct LCRSNode {
    std::string              name;
    int                      product_count { 0 };   // products in this exact node
    std::unique_ptr<LCRSNode> left_child   { nullptr };   // first child
    std::unique_ptr<LCRSNode> right_sibling{ nullptr };   // next sibling

    explicit LCRSNode(std::string n) : name(std::move(n)) {}
};

// ── LCRS Tree ─────────────────────────────────────────────────────────────

class LCRSTree {
public:
    LCRSTree() : root_(std::make_unique<LCRSNode>("__ROOT__")) {}

    // Non-copyable
    LCRSTree(const LCRSTree&)            = delete;
    LCRSTree& operator=(const LCRSTree&) = delete;

    // ── Mutations ─────────────────────────────────────────────────────────

    /// Insert a category path such as "Electronics/Mobile/Chargers".
    /// Creates intermediate nodes if they don't exist.
    /// Increments product_count at the leaf node.
    void insert_category(const std::string& path) {
        auto segments = split(path, '/');
        if (segments.empty()) return;

        LCRSNode* current = root_.get();
        for (const auto& seg : segments) {
            current = find_or_create_child(current, seg);
        }
        ++current->product_count;
    }

    // ── Queries ───────────────────────────────────────────────────────────

    /// Recursively serialise the entire tree (excluding the virtual root)
    /// into a nested JSON array suitable for the React CategorySidebar.
    ///
    /// Each node becomes:
    ///   { "name": "Electronics", "count": 5, "children": [ ... ] }
    nlohmann::json to_json() const {
        nlohmann::json arr = nlohmann::json::array();
        LCRSNode* child = root_->left_child.get();
        while (child) {
            arr.push_back(node_to_json(child));
            child = child->right_sibling.get();
        }
        return arr;
    }

    /// Returns the flat list of all top-level category names.
    std::vector<std::string> top_level_categories() const {
        std::vector<std::string> out;
        LCRSNode* child = root_->left_child.get();
        while (child) {
            out.push_back(child->name);
            child = child->right_sibling.get();
        }
        return out;
    }

    int node_count() const { return count_nodes(root_.get()) - 1; } // -1 for root sentinel

private:
    std::unique_ptr<LCRSNode> root_;

    // ── Child management ───────────────────────────────────────────────

    /// Find child with matching name, or append a new child.
    /// LCRS: children are stored as a linked list via right_sibling.
    LCRSNode* find_or_create_child(LCRSNode* parent,
                                    const std::string& name) {
        // Walk sibling chain of parent's first child
        if (!parent->left_child) {
            parent->left_child = std::make_unique<LCRSNode>(name);
            return parent->left_child.get();
        }

        LCRSNode* sib = parent->left_child.get();
        while (true) {
            if (sib->name == name) return sib;   // found existing
            if (!sib->right_sibling) break;      // reached end of sibling chain
            sib = sib->right_sibling.get();
        }

        // Append new sibling at end of chain
        sib->right_sibling = std::make_unique<LCRSNode>(name);
        return sib->right_sibling.get();
    }

    // ── Serialisation ──────────────────────────────────────────────────

    static nlohmann::json node_to_json(const LCRSNode* node) {
        nlohmann::json obj;
        obj["name"]  = node->name;
        obj["count"] = node->product_count;

        nlohmann::json children = nlohmann::json::array();
        LCRSNode* child = node->left_child.get();
        while (child) {
            children.push_back(node_to_json(child));
            child = child->right_sibling.get();
        }
        obj["children"] = children;
        return obj;
    }

    // ── Utility ────────────────────────────────────────────────────────

    static std::vector<std::string> split(const std::string& s, char delim) {
        std::vector<std::string> parts;
        std::istringstream ss(s);
        std::string token;
        while (std::getline(ss, token, delim)) {
            if (!token.empty()) parts.push_back(token);
        }
        return parts;
    }

    static int count_nodes(const LCRSNode* node) {
        if (!node) return 0;
        return 1 + count_nodes(node->left_child.get())
                 + count_nodes(node->right_sibling.get());
    }
};

} // namespace vanguard
