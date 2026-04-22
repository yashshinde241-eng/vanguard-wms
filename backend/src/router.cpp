#include "router.h"
#include <iostream>
#include <chrono>
#include <iomanip>
#include <sstream>

namespace vanguard {

Router::Router(std::shared_ptr<InventoryEngine> engine)
    : engine_(std::move(engine)) {}

void Router::register_routes(crow::SimpleApp& app) {

    // CORS pre-flight
    CROW_ROUTE(app, "/api/<path>").methods(crow::HTTPMethod::OPTIONS)
    ([](const crow::request&, crow::response& res, const std::string&) {
        res.add_header("Access-Control-Allow-Origin",  "*");
        res.add_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.add_header("Access-Control-Allow-Headers", "Content-Type");
        res.code = 204; res.end();
    });

    // ──────────── PHASE 1 ────────────
    CROW_ROUTE(app, "/api/health").methods(crow::HTTPMethod::GET)
    ([this](const crow::request&) { return handle_health(); });

    CROW_ROUTE(app, "/api/products").methods(crow::HTTPMethod::GET)
    ([this](const crow::request&) { return handle_get_products(); });

    CROW_ROUTE(app, "/api/products").methods(crow::HTTPMethod::POST)
    ([this](const crow::request& req) { return handle_post_product(req); });

    // ──────────── PHASE 2 ────────────
    CROW_ROUTE(app, "/api/search").methods(crow::HTTPMethod::GET)
    ([this](const crow::request& req) { return handle_search(req); });

    CROW_ROUTE(app, "/api/sku/<string>").methods(crow::HTTPMethod::GET)
    ([this](const crow::request&, const std::string& sku) {
        return handle_sku_lookup(sku);
    });

    CROW_ROUTE(app, "/api/categories").methods(crow::HTTPMethod::GET)
    ([this](const crow::request&) { return handle_get_categories(); });

    CROW_ROUTE(app, "/api/dsa/stats").methods(crow::HTTPMethod::GET)
    ([this](const crow::request&) { return handle_get_dsa_stats(); });

    // ──────────── PHASE 3 ────────────
    CROW_ROUTE(app, "/api/nav/path").methods(crow::HTTPMethod::GET)
    ([this](const crow::request& req) { return handle_nav_path(req); });

    CROW_ROUTE(app, "/api/nav/shipping-matrix").methods(crow::HTTPMethod::GET)
    ([this](const crow::request&) { return handle_nav_shipping_matrix(); });

    CROW_ROUTE(app, "/api/nav/grid").methods(crow::HTTPMethod::GET)
    ([this](const crow::request&) { return handle_nav_grid_info(); });

    CROW_ROUTE(app, "/api/nav/block").methods(crow::HTTPMethod::POST)
    ([this](const crow::request& req) { return handle_nav_block(req); });

    // ──────────── PHASE 4 ────────────
    // POST /api/orders        — push a new order onto the Max-Heap
    CROW_ROUTE(app, "/api/orders").methods(crow::HTTPMethod::POST)
    ([this](const crow::request& req) { return handle_post_order(req); });

    // GET  /api/orders        — all active orders sorted by urgency
    CROW_ROUTE(app, "/api/orders").methods(crow::HTTPMethod::GET)
    ([this](const crow::request&) { return handle_get_orders(); });

    // GET  /api/orders/next   — pop highest-priority order (destructive)
    CROW_ROUTE(app, "/api/orders/next").methods(crow::HTTPMethod::GET)
    ([this](const crow::request&) { return handle_get_next_order(); });

    // POST /api/optimize-pack — 0/1 Knapsack on selected product IDs
    CROW_ROUTE(app, "/api/optimize-pack").methods(crow::HTTPMethod::POST)
    ([this](const crow::request& req) { return handle_post_optimize_pack(req); });

    std::cout << "[Router] Phase 4 routes:\n"
              << "  POST /api/orders\n"
              << "  GET  /api/orders\n"
              << "  GET  /api/orders/next\n"
              << "  POST /api/optimize-pack\n";
}

// ─────────────────── PHASE 1 ───────────────────────────────────────────────

crow::response Router::handle_health() {
    auto now  = std::chrono::system_clock::now();
    auto time = std::chrono::system_clock::to_time_t(now);
    std::ostringstream ts;
    ts << std::put_time(std::gmtime(&time), "%Y-%m-%dT%H:%M:%SZ");
    return json_response(200, {
        {"status","ok"},{"service","Vanguard-WMS"},
        {"version","4.0.0-phase4"},{"timestamp",ts.str()}
    });
}

crow::response Router::handle_get_products() {
    try {
        auto prods = engine_->all_products();
        nlohmann::json arr = nlohmann::json::array();
        for (const auto& p : prods) arr.push_back(product_to_json(p));
        return json_response(200,{{"success",true},{"count",(int)arr.size()},{"data",arr}});
    } catch (const std::exception& e) { return error_response(500, e.what()); }
}

crow::response Router::handle_post_product(const crow::request& req) {
    try {
        auto b = nlohmann::json::parse(req.body);
        for (auto& f : {"sku","name"})
            if (!b.contains(f) || b[f].get<std::string>().empty())
                return error_response(400, std::string("Missing: ") + f);
        auto p = engine_->add_product(
            b["sku"].get<std::string>(), b["name"].get<std::string>(),
            b.value("category","Uncategorised"),
            b.value("quantity",0), b.value("price",0.0),
            b.value("warehouse_x",0), b.value("warehouse_y",0));
        return json_response(201,{{"success",true},{"data",product_to_json(p)}});
    } catch (const nlohmann::json::parse_error&) {
        return error_response(400,"Invalid JSON");
    } catch (const std::runtime_error& e) {
        std::string m = e.what();
        return error_response(m.find("UNIQUE")!=std::string::npos?409:500,
                              m.find("UNIQUE")!=std::string::npos?"SKU already exists":m);
    }
}

// ─────────────────── PHASE 2 ───────────────────────────────────────────────

crow::response Router::handle_search(const crow::request& req) {
    const char* q = req.url_params.get("q");
    if (!q || !*q) return error_response(400,"Missing: q");
    auto t0 = std::chrono::steady_clock::now();
    auto res = engine_->search(q);
    auto us  = std::chrono::duration_cast<std::chrono::microseconds>(
                   std::chrono::steady_clock::now()-t0).count();
    nlohmann::json arr = nlohmann::json::array();
    for (const auto& p : res) arr.push_back(product_to_json(p));
    return json_response(200,{{"success",true},{"count",(int)arr.size()},{"elapsed_us",(int)us},{"data",arr}});
}

crow::response Router::handle_sku_lookup(const std::string& sku) {
    auto t0 = std::chrono::steady_clock::now();
    const Product* p = engine_->find_by_sku(sku);
    auto us = std::chrono::duration_cast<std::chrono::microseconds>(
                  std::chrono::steady_clock::now()-t0).count();
    if (!p) return error_response(404,"SKU not found: "+sku);
    return json_response(200,{{"success",true},{"elapsed_us",(int)us},{"data",product_to_json(*p)}});
}

crow::response Router::handle_get_categories() {
    return json_response(200,{{"success",true},{"data",engine_->categories_json()}});
}

crow::response Router::handle_get_dsa_stats() {
    auto s = engine_->stats();
    return json_response(200,{{"success",true},{"data",{
        {"avl",{{"height",s.avl_height},{"size",s.avl_size},
                {"theoretical_min_height",s.avl_theoretical_min_height}}},
        {"hash_table",{{"size",s.ht_size},{"capacity",s.ht_capacity},
                       {"load_factor",s.ht_load_factor},{"collisions",s.ht_collisions}}},
        {"lcrs",{{"node_count",s.lcrs_node_count}}},
        {"graph",{{"nodes",s.graph_nodes},{"obstacles",s.graph_obstacles},
                  {"walkable",s.graph_walkable},{"shipping_nodes",s.shipping_nodes}}},
        {"heap",{{"size",s.heap_size},{"height",s.heap_height},
                 {"total_pushed",s.heap_total_pushed},{"total_popped",s.heap_total_popped},
                 {"top_score",s.heap_top_score}}}
    }}});
}

// ─────────────────── PHASE 3 ───────────────────────────────────────────────

crow::response Router::handle_nav_path(const crow::request& req) {
    const char* s = req.url_params.get("start");
    const char* e = req.url_params.get("end");
    if (!s||!e) return error_response(400,"Missing: start and end");
    try {
        int start=std::stoi(s), end=std::stoi(e);
        auto t0 = std::chrono::steady_clock::now();
        auto r  = engine_->find_path(start,end);
        auto us = std::chrono::duration_cast<std::chrono::microseconds>(
                      std::chrono::steady_clock::now()-t0).count();
        auto pj = WarehouseGraph::path_to_json(r);
        pj["start"]=start; pj["end"]=end; pj["elapsed_us"]=(int)us;
        return json_response(r.reachable?200:404,{{"success",r.reachable},{"data",pj}});
    } catch (const std::exception& e2) { return error_response(400,e2.what()); }
}

crow::response Router::handle_nav_shipping_matrix() {
    return json_response(200,{{"success",true},{"data",engine_->shipping_matrix()}});
}

crow::response Router::handle_nav_grid_info() {
    return json_response(200,{{"success",true},{"data",engine_->grid_info()}});
}

crow::response Router::handle_nav_block(const crow::request& req) {
    try {
        auto b  = nlohmann::json::parse(req.body);
        int  nd = b.value("node",-1);
        auto ac = b.value("action",std::string("block"));
        if (nd<0||nd>99) return error_response(400,"node must be in [0,99]");
        if (ac=="block")        engine_->block_node(nd);
        else if (ac=="unblock") engine_->unblock_node(nd);
        else return error_response(400,"action must be block or unblock");
        return json_response(200,{{"success",true},{"node",nd},{"action",ac},
                                   {"grid",engine_->grid_info()}});
    } catch (...) { return error_response(400,"Invalid request"); }
}

// ─────────────────── PHASE 4 ───────────────────────────────────────────────

crow::response Router::handle_post_order(const crow::request& req) {
    try {
        auto b = nlohmann::json::parse(req.body);
        for (auto& f : {"order_ref","customer_name","sku"})
            if (!b.contains(f) || b[f].get<std::string>().empty())
                return error_response(400, std::string("Missing: ") + f);

        std::string type_str = b.value("shipping_type", std::string("STANDARD"));
        ShippingType stype   = shipping_type_from_str(type_str);

        Order o = engine_->push_order(
            b["order_ref"].get<std::string>(),
            b["customer_name"].get<std::string>(),
            b["sku"].get<std::string>(),
            b.value("quantity", 1),
            b.value("value",    0.0),
            stype
        );
        return json_response(201, {
            {"success", true},
            {"message", "Order pushed to heap"},
            {"data",    order_to_json(o)},
            {"heap_size", engine_->stats().heap_size}
        });
    } catch (const nlohmann::json::parse_error&) {
        return error_response(400, "Invalid JSON body");
    } catch (const std::exception& e) {
        return error_response(500, e.what());
    }
}

crow::response Router::handle_get_orders() {
    return json_response(200, {
        {"success", true},
        {"data",    engine_->orders_json()},
        {"stats",   engine_->orders_stats_json()}
    });
}

crow::response Router::handle_get_next_order() {
    if (engine_->orders_empty())
        return error_response(404, "No active orders in queue");
    try {
        Order o = engine_->pop_order();
        return json_response(200, {
            {"success",   true},
            {"message",   "Order extracted from heap"},
            {"data",      order_to_json(o)},
            {"remaining", engine_->stats().heap_size}
        });
    } catch (const std::exception& e) {
        return error_response(500, e.what());
    }
}

crow::response Router::handle_post_optimize_pack(const crow::request& req) {
    try {
        auto b = nlohmann::json::parse(req.body);
        if (!b.contains("product_ids") || !b["product_ids"].is_array())
            return error_response(400, "Missing: product_ids (array)");
        if (!b.contains("capacity_kg"))
            return error_response(400, "Missing: capacity_kg");

        std::vector<int> ids;
        for (const auto& id : b["product_ids"]) ids.push_back(id.get<int>());
        double cap = b["capacity_kg"].get<double>();

        auto t0  = std::chrono::steady_clock::now();
        auto res = engine_->optimise_packing(ids, cap);
        auto us  = std::chrono::duration_cast<std::chrono::microseconds>(
                       std::chrono::steady_clock::now() - t0).count();

        auto rj = Optimizer::result_to_json(res);
        rj["elapsed_us"] = (int)us;

        return json_response(200, {{"success", true}, {"data", rj}});

    } catch (const nlohmann::json::parse_error&) {
        return error_response(400, "Invalid JSON body");
    } catch (const std::invalid_argument& e) {
        return error_response(400, e.what());
    } catch (const std::exception& e) {
        return error_response(500, e.what());
    }
}

// ─────────────────── Helpers ───────────────────────────────────────────────

crow::response Router::json_response(int status, const nlohmann::json& body) {
    crow::response res(status, body.dump());
    res.add_header("Content-Type",                "application/json");
    res.add_header("Access-Control-Allow-Origin", "*");
    return res;
}

crow::response Router::error_response(int status, const std::string& msg) {
    return json_response(status, {{"success",false},{"error",msg}});
}

} // namespace vanguard
