#pragma once

/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  Vanguard-WMS · Phase 5 · Huffman Coding                        ║
 * ║                                                                  ║
 * ║  Purpose: Simulate IoT data compression for handheld scanner    ║
 * ║  payloads. JSON strings sent over BLE/radio benefit enormously  ║
 * ║  from Huffman coding because JSON keys repeat frequently.       ║
 * ║                                                                  ║
 * ║  ALGORITHM OVERVIEW:                                             ║
 * ║  1. Count character frequencies in the input string             ║
 * ║  2. Build a min-heap of leaf nodes (one per unique character)   ║
 * ║  3. Repeatedly extract the two lowest-frequency nodes and merge ║
 * ║     them into an internal node — until one root remains         ║
 * ║  4. Assign codes by walking the tree: left=0, right=1           ║
 * ║  5. Encode: replace each character with its bit-code            ║
 * ║  6. Decode: walk the tree bit-by-bit to reconstruct characters  ║
 * ║                                                                  ║
 * ║  COMPLEXITY:                                                     ║
 * ║    Build tree : O(n log n)  where n = unique characters (≤256)  ║
 * ║    Encode     : O(L)        where L = input length              ║
 * ║    Decode     : O(L × h)    where h = tree height ≤ 256         ║
 * ║                                                                  ║
 * ║  Memory: all nodes owned via unique_ptr, no raw new/delete.     ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

#include <string>
#include <unordered_map>
#include <map>
#include <vector>
#include <queue>
#include <memory>
#include <stdexcept>
#include <sstream>
#include <nlohmann/json.hpp>

namespace vanguard {

// ── Huffman Tree Node ──────────────────────────────────────────────────────

struct HuffNode {
    char                      ch;           // '\0' for internal nodes
    int                       freq;
    std::unique_ptr<HuffNode> left;
    std::unique_ptr<HuffNode> right;

    // Leaf constructor
    HuffNode(char c, int f)
        : ch(c), freq(f), left(nullptr), right(nullptr) {}

    // Internal node constructor
    HuffNode(int f, std::unique_ptr<HuffNode> l, std::unique_ptr<HuffNode> r)
        : ch('\0'), freq(f), left(std::move(l)), right(std::move(r)) {}

    bool is_leaf() const { return left == nullptr && right == nullptr; }
};

// ── Comparator for the min-heap ────────────────────────────────────────────

struct HuffNodeCmp {
    bool operator()(const HuffNode* a, const HuffNode* b) const {
        // Greater-than → min-heap (lowest frequency at top)
        if (a->freq != b->freq) return a->freq > b->freq;
        // Tie-break on character value for deterministic output
        return a->ch > b->ch;
    }
};

// ── Result structs ─────────────────────────────────────────────────────────

struct HuffmanEncodeResult {
    std::string                        bitstream;        // "010011101..."
    std::string                        original_text;
    std::unordered_map<char,std::string> codebook;       // char → bit-string
    int                                original_bits;    // original_text.size() * 8
    int                                compressed_bits;  // bitstream.size()
    double                             compression_ratio; // 0–1
    double                             space_saved_pct;
    int                                unique_chars;
    int                                tree_height;
};

struct HuffmanDecodeResult {
    std::string decoded_text;
    bool        success;
    std::string error;
};

// ── Main Huffman class ─────────────────────────────────────────────────────

class HuffmanCoder {
public:
    // ── Encode ──────────────────────────────────────────────────────────────

    /**
     * encode() — full pipeline: frequency count → tree build → codebook → bitstream.
     *
     * @param data  Input string (any bytes; typically JSON)
     * @returns     HuffmanEncodeResult with bitstream + all statistics
     */
    static HuffmanEncodeResult encode(const std::string& data) {
        if (data.empty())
            throw std::invalid_argument("Cannot encode empty string");

        // ── Step 1: Count frequencies ─────────────────────────────────────
        std::unordered_map<char,int> freq;
        for (char c : data) freq[c]++;

        // ── Step 2: Build min-heap of leaf nodes ──────────────────────────
        // We own all nodes via a vector, then pass raw pointers to the heap.
        std::vector<std::unique_ptr<HuffNode>> node_pool;
        node_pool.reserve(freq.size());

        std::priority_queue<HuffNode*, std::vector<HuffNode*>, HuffNodeCmp> pq;

        for (auto& [ch, f] : freq) {
            node_pool.push_back(std::make_unique<HuffNode>(ch, f));
            pq.push(node_pool.back().get());
        }

        // Edge case: single unique character
        if (pq.size() == 1) {
            HuffNode* only = pq.top(); pq.pop();
            // Create a fake root with the single leaf as left child
            auto leaf = std::make_unique<HuffNode>(only->ch, only->freq);
            auto root = std::make_unique<HuffNode>(
                only->freq,
                std::make_unique<HuffNode>(only->ch, only->freq),
                nullptr
            );
            // Build result with "0" for every character
            std::unordered_map<char,std::string> codebook;
            codebook[only->ch] = "0";
            std::string bits(data.size(), '0');
            HuffmanEncodeResult r;
            r.bitstream        = bits;
            r.original_text    = data;
            r.codebook         = codebook;
            r.original_bits    = static_cast<int>(data.size()) * 8;
            r.compressed_bits  = static_cast<int>(bits.size());
            r.compression_ratio= static_cast<double>(r.compressed_bits) / r.original_bits;
            r.space_saved_pct  = (1.0 - r.compression_ratio) * 100.0;
            r.unique_chars     = 1;
            r.tree_height      = 1;
            return r;
        }

        // ── Step 3: Build Huffman tree ─────────────────────────────────────
        // Repeatedly merge the two minimum-frequency nodes.
        // We need to track the merged nodes' ownership too.
        std::vector<std::unique_ptr<HuffNode>> merged_pool;

        while (pq.size() > 1) {
            // Pop two lowest-frequency nodes
            HuffNode* a = pq.top(); pq.pop();
            HuffNode* b = pq.top(); pq.pop();

            // We need to move them into a new internal node.
            // Find and extract their unique_ptrs from the pools.
            auto ua = extract_from_pool(node_pool,   a);
            if (!ua) ua = extract_from_pool(merged_pool, a);
            auto ub = extract_from_pool(node_pool,   b);
            if (!ub) ub = extract_from_pool(merged_pool, b);

            auto internal = std::make_unique<HuffNode>(
                a->freq + b->freq,
                std::move(ua),
                std::move(ub)
            );
            pq.push(internal.get());
            merged_pool.push_back(std::move(internal));
        }

        // The remaining raw pointer is the root — find its owning unique_ptr
        HuffNode* root_raw = pq.top();
        auto root_ptr = extract_from_pool(merged_pool, root_raw);
        if (!root_ptr) root_ptr = extract_from_pool(node_pool, root_raw);

        // ── Step 4: Generate codebook via DFS ─────────────────────────────
        std::unordered_map<char,std::string> codebook;
        int tree_h = 0;
        build_codebook(root_ptr.get(), "", codebook, tree_h);

        // ── Step 5: Encode the input string ───────────────────────────────
        std::string bitstream;
        bitstream.reserve(data.size() * 4);  // rough upper-bound
        for (char c : data) bitstream += codebook.at(c);

        // ── Assemble result ────────────────────────────────────────────────
        HuffmanEncodeResult result;
        result.bitstream        = std::move(bitstream);
        result.original_text    = data;
        result.codebook         = std::move(codebook);
        result.original_bits    = static_cast<int>(data.size()) * 8;
        result.compressed_bits  = static_cast<int>(result.bitstream.size());
        result.compression_ratio= static_cast<double>(result.compressed_bits)
                                  / result.original_bits;
        result.space_saved_pct  = (1.0 - result.compression_ratio) * 100.0;
        result.unique_chars     = static_cast<int>(freq.size());
        result.tree_height      = tree_h;
        return result;
    }

    // ── Decode ──────────────────────────────────────────────────────────────

    /**
     * decode() — reconstructs original text from a bitstream + codebook.
     *
     * We reverse the codebook (bit-string → char) and use a greedy prefix scan.
     * This is equivalent to tree-walking but avoids re-building the tree.
     */
    static HuffmanDecodeResult decode(
            const std::string& bitstream,
            const std::unordered_map<char,std::string>& codebook)
    {
        HuffmanDecodeResult result;

        if (bitstream.empty()) {
            result.decoded_text = "";
            result.success      = true;
            return result;
        }

        // Build reverse map: bit-string → char
        // Using std::map (sorted) so prefix lookups are efficient
        std::map<std::string,char> reverse;
        for (auto& [ch, code] : codebook) reverse[code] = ch;

        std::string decoded;
        std::string buffer;
        buffer.reserve(16);

        for (char bit : bitstream) {
            if (bit != '0' && bit != '1') {
                result.success = false;
                result.error   = "Invalid character in bitstream: only '0' and '1' allowed";
                return result;
            }
            buffer += bit;
            auto it = reverse.find(buffer);
            if (it != reverse.end()) {
                decoded += it->second;
                buffer.clear();
            }
            // Safety cap: if buffer exceeds 256 bits without a match,
            // the codebook and bitstream are mismatched
            if (buffer.size() > 256) {
                result.success = false;
                result.error   = "Bitstream/codebook mismatch — no matching code after 256 bits";
                return result;
            }
        }

        if (!buffer.empty()) {
            result.success = false;
            result.error   = "Bitstream ended with unmatched bits: " + buffer;
            return result;
        }

        result.decoded_text = std::move(decoded);
        result.success      = true;
        return result;
    }

    // ── JSON serialisation ─────────────────────────────────────────────────

    static nlohmann::json encode_result_to_json(const HuffmanEncodeResult& r) {
        // Codebook: serialise char keys as printable strings
        nlohmann::json cb = nlohmann::json::object();
        for (auto& [ch, code] : r.codebook) {
            std::string key;
            if (ch == '\n')      key = "\\n";
            else if (ch == '\t') key = "\\t";
            else if (ch == '\r') key = "\\r";
            else if (ch == ' ')  key = "SPACE";
            else                 key = std::string(1, ch);
            cb[key] = code;
        }

        // Truncate bitstream for display (first 256 bits + "...")
        std::string display_bits = r.bitstream.size() > 256
            ? r.bitstream.substr(0, 256) + "...[" + std::to_string(r.bitstream.size()) + " bits total]"
            : r.bitstream;

        return {
            {"original_chars",    (int)r.original_text.size()},
            {"original_bits",     r.original_bits},
            {"compressed_bits",   r.compressed_bits},
            {"compression_ratio", r.compression_ratio},
            {"space_saved_pct",   r.space_saved_pct},
            {"unique_chars",      r.unique_chars},
            {"tree_height",       r.tree_height},
            {"codebook",          cb},
            {"bitstream_preview", display_bits},
            {"algorithm",         "Huffman Coding O(n log n)"}
        };
    }

private:
    // ── DFS to assign codes ────────────────────────────────────────────────
    static void build_codebook(const HuffNode*                       node,
                                const std::string&                    prefix,
                                std::unordered_map<char,std::string>& codebook,
                                int&                                  max_depth)
    {
        if (!node) return;
        int depth = static_cast<int>(prefix.size());
        if (depth > max_depth) max_depth = depth;

        if (node->is_leaf()) {
            // Assign code; if root itself is a leaf (single char), use "0"
            codebook[node->ch] = prefix.empty() ? "0" : prefix;
            return;
        }
        build_codebook(node->left.get(),  prefix + "0", codebook, max_depth);
        build_codebook(node->right.get(), prefix + "1", codebook, max_depth);
    }

    // ── Extract a unique_ptr from a pool by raw pointer ───────────────────
    static std::unique_ptr<HuffNode> extract_from_pool(
            std::vector<std::unique_ptr<HuffNode>>& pool,
            const HuffNode* target)
    {
        for (auto it = pool.begin(); it != pool.end(); ++it) {
            if (it->get() == target) {
                auto ptr = std::move(*it);
                pool.erase(it);
                return ptr;
            }
        }
        return nullptr;
    }
};

} // namespace vanguard
