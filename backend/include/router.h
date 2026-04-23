#pragma once

#include "Engine.h"
#include <crow.h>
#include <memory>

namespace vanguard {

class Router {
public:
    explicit Router(std::shared_ptr<InventoryEngine> engine);
    void register_routes(crow::SimpleApp& app);

private:
    std::shared_ptr<InventoryEngine> engine_;

    // Phase 1
    crow::response handle_health();
    crow::response handle_get_products();
    crow::response handle_post_product(const crow::request& req);

    // Phase 2
    crow::response handle_search(const crow::request& req);
    crow::response handle_sku_lookup(const std::string& sku);
    crow::response handle_get_categories();
    crow::response handle_get_dsa_stats();

    // Phase 3
    crow::response handle_nav_path(const crow::request& req);
    crow::response handle_nav_shipping_matrix();
    crow::response handle_nav_grid_info();
    crow::response handle_nav_block(const crow::request& req);

    // Phase 4
    crow::response handle_post_order(const crow::request& req);
    crow::response handle_get_orders();
    crow::response handle_get_next_order();
    crow::response handle_post_optimize_pack(const crow::request& req);

    // Phase 5 (new)
    crow::response handle_efficiency_compress(const crow::request& req);
    crow::response handle_nav_tsp(const crow::request& req);

    static crow::response json_response(int status, const nlohmann::json& body);
    static crow::response error_response(int status, const std::string& message);
};

} // namespace vanguard
