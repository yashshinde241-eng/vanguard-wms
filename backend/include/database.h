#pragma once

/**
 * database.h — Phase 3
 * Product struct gains warehouse_x, warehouse_y coordinates (0-9 each).
 * The SQLite schema uses ALTER TABLE ... ADD COLUMN for safe migration —
 * existing databases are upgraded without data loss.
 */

#include <sqlite3.h>
#include <string>
#include <vector>
#include <stdexcept>
#include <nlohmann/json.hpp>

namespace vanguard {

struct Product {
    int         id;
    std::string sku;
    std::string name;
    std::string category;
    int         quantity;
    double      price;
    // ── Phase 3: warehouse grid coordinates ──────────────────────────────
    int         warehouse_x { 0 };   // column  (0–9)
    int         warehouse_y { 0 };   // row     (0–9)
};

class Database {
public:
    explicit Database(const std::string& db_path);
    ~Database();

    Database(const Database&)            = delete;
    Database& operator=(const Database&) = delete;

    void                 init_schema();
    std::vector<Product> get_all_products();
    Product              insert_product(const std::string& sku,
                                        const std::string& name,
                                        const std::string& category,
                                        int quantity, double price,
                                        int wx = 0, int wy = 0);

private:
    sqlite3* db_handle_;

    static int product_row_callback(void*  data,
                                    int    col_count,
                                    char** col_values,
                                    char** col_names);
};

// ── JSON serialisation ──────────────────────────────────────────────────────
inline nlohmann::json product_to_json(const Product& p) {
    return {
        {"id",          p.id},
        {"sku",         p.sku},
        {"name",        p.name},
        {"category",    p.category},
        {"quantity",    p.quantity},
        {"price",       p.price},
        {"warehouse_x", p.warehouse_x},
        {"warehouse_y", p.warehouse_y},
        // Derived: flat node id for the 10×10 grid
        {"node_id",     p.warehouse_y * 10 + p.warehouse_x}
    };
}

} // namespace vanguard
