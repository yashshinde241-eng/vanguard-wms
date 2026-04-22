#include "database.h"
#include <iostream>
#include <sstream>

namespace vanguard {

Database::Database(const std::string& db_path) : db_handle_(nullptr) {
    int rc = sqlite3_open(db_path.c_str(), &db_handle_);
    if (rc != SQLITE_OK) {
        std::string err = sqlite3_errmsg(db_handle_);
        sqlite3_close(db_handle_);
        throw std::runtime_error("[DB] Failed to open: " + err);
    }
    std::cout << "[DB] Connected to SQLite at: " << db_path << "\n";
    char* em = nullptr;
    sqlite3_exec(db_handle_, "PRAGMA journal_mode=WAL;", nullptr, nullptr, &em);
    if (em) sqlite3_free(em);
}

Database::~Database() {
    if (db_handle_) { sqlite3_close(db_handle_); std::cout << "[DB] Closed.\n"; }
}

// ── Schema init — safe migration ───────────────────────────────────────────

void Database::init_schema() {
    // Create the table if it doesn't exist (Phase 1 base schema)
    const char* create_sql = R"(
        CREATE TABLE IF NOT EXISTS products (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            sku         TEXT    NOT NULL UNIQUE,
            name        TEXT    NOT NULL,
            category    TEXT    NOT NULL DEFAULT 'Uncategorised',
            quantity    INTEGER NOT NULL DEFAULT 0,
            price       REAL    NOT NULL DEFAULT 0.0
        );
        CREATE INDEX IF NOT EXISTS idx_products_sku      ON products(sku);
        CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
    )";

    char* em = nullptr;
    int rc = sqlite3_exec(db_handle_, create_sql, nullptr, nullptr, &em);
    if (rc != SQLITE_OK) {
        std::string err = em; sqlite3_free(em);
        throw std::runtime_error("[DB] Schema init failed: " + err);
    }

    // ── Phase 3 migration: add coordinate columns if they don't exist ──────
    // ALTER TABLE ADD COLUMN is a no-op if the column already exists in SQLite
    // — but SQLite actually errors on duplicate columns, so we check first.
    auto col_exists = [&](const std::string& col) -> bool {
        std::string query = "SELECT COUNT(*) FROM pragma_table_info('products') WHERE name='" + col + "';";
        sqlite3_stmt* stmt = nullptr;
        sqlite3_prepare_v2(db_handle_, query.c_str(), -1, &stmt, nullptr);
        sqlite3_step(stmt);
        int count = sqlite3_column_int(stmt, 0);
        sqlite3_finalize(stmt);
        return count > 0;
    };

    if (!col_exists("warehouse_x")) {
        sqlite3_exec(db_handle_,
            "ALTER TABLE products ADD COLUMN warehouse_x INTEGER NOT NULL DEFAULT 0;",
            nullptr, nullptr, nullptr);
        std::cout << "[DB] Migration: added warehouse_x column\n";
    }
    if (!col_exists("warehouse_y")) {
        sqlite3_exec(db_handle_,
            "ALTER TABLE products ADD COLUMN warehouse_y INTEGER NOT NULL DEFAULT 0;",
            nullptr, nullptr, nullptr);
        std::cout << "[DB] Migration: added warehouse_y column\n";
    }

    std::cout << "[DB] Schema ready (products table with coordinates).\n";
}

// ── Callback: one row → Product ────────────────────────────────────────────

int Database::product_row_callback(void*  data, int /*cols*/,
                                   char** vals, char** /*names*/) {
    auto* v = static_cast<std::vector<Product>*>(data);
    Product p;
    p.id          = vals[0] ? std::stoi(vals[0]) : 0;
    p.sku         = vals[1] ? vals[1] : "";
    p.name        = vals[2] ? vals[2] : "";
    p.category    = vals[3] ? vals[3] : "";
    p.quantity    = vals[4] ? std::stoi(vals[4]) : 0;
    p.price       = vals[5] ? std::stod(vals[5]) : 0.0;
    p.warehouse_x = vals[6] ? std::stoi(vals[6]) : 0;
    p.warehouse_y = vals[7] ? std::stoi(vals[7]) : 0;
    v->push_back(std::move(p));
    return 0;
}

std::vector<Product> Database::get_all_products() {
    std::vector<Product> products;
    const char* sql =
        "SELECT id,sku,name,category,quantity,price,warehouse_x,warehouse_y "
        "FROM products ORDER BY id ASC;";
    char* em = nullptr;
    int rc = sqlite3_exec(db_handle_, sql,
                          &Database::product_row_callback, &products, &em);
    if (rc != SQLITE_OK) {
        std::string err = em; sqlite3_free(em);
        throw std::runtime_error("[DB] get_all_products: " + err);
    }
    return products;
}

Product Database::insert_product(const std::string& sku,
                                  const std::string& name,
                                  const std::string& category,
                                  int quantity, double price,
                                  int wx, int wy) {
    const char* sql =
        "INSERT INTO products (sku,name,category,quantity,price,warehouse_x,warehouse_y) "
        "VALUES (?,?,?,?,?,?,?);";

    sqlite3_stmt* stmt = nullptr;
    if (sqlite3_prepare_v2(db_handle_, sql, -1, &stmt, nullptr) != SQLITE_OK)
        throw std::runtime_error("[DB] Prepare insert failed: " +
                                 std::string(sqlite3_errmsg(db_handle_)));

    sqlite3_bind_text  (stmt, 1, sku.c_str(),      -1, SQLITE_STATIC);
    sqlite3_bind_text  (stmt, 2, name.c_str(),     -1, SQLITE_STATIC);
    sqlite3_bind_text  (stmt, 3, category.c_str(), -1, SQLITE_STATIC);
    sqlite3_bind_int   (stmt, 4, quantity);
    sqlite3_bind_double(stmt, 5, price);
    sqlite3_bind_int   (stmt, 6, wx);
    sqlite3_bind_int   (stmt, 7, wy);

    int rc = sqlite3_step(stmt);
    sqlite3_finalize(stmt);

    if (rc != SQLITE_DONE)
        throw std::runtime_error("[DB] Insert failed: " +
                                 std::string(sqlite3_errmsg(db_handle_)));

    int64_t id = sqlite3_last_insert_rowid(db_handle_);
    return Product{ static_cast<int>(id), sku, name, category, quantity, price, wx, wy };
}

} // namespace vanguard
