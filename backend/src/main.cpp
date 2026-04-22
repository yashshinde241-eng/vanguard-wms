/**
 * Vanguard-WMS · Phase 4: Dispatch Commander
 * Lead Developer: Yash Shinde
 */
#include "database.h"
#include "Engine.h"
#include "router.h"
#include <crow.h>
#include <iostream>
#include <iomanip>
#include <memory>
#include <filesystem>

static constexpr uint16_t   PORT    = 8080;
static constexpr unsigned   THREADS = 4;
static const    std::string DB_PATH = "./data/vanguard.db";

int main() {
    std::cout << R"(
  ██╗   ██╗ █████╗ ███╗   ██╗ ██████╗ ██╗   ██╗ █████╗ ██████╗ ██████╗
  ██║   ██║██╔══██╗████╗  ██║██╔════╝ ██║   ██║██╔══██╗██╔══██╗██╔══██╗
  ██║   ██║███████║██╔██╗ ██║██║  ███╗██║   ██║███████║██████╔╝██║  ██║
  ╚██╗ ██╔╝██╔══██║██║╚██╗██║██║   ██║██║   ██║██╔══██║██╔══██╗██║  ██║
   ╚████╔╝ ██║  ██║██║ ╚████║╚██████╔╝╚██████╔╝██║  ██║██║  ██║██████╔╝
    ╚═══╝  ╚═╝  ╚═╝╚═╝  ╚═══╝ ╚═════╝  ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝
  WMS Logic Engine  ·  Phase 4: Dispatch Commander  ·  C++20 / Crow
)" << "\n";

    try { std::filesystem::create_directories("./data"); }
    catch (const std::exception& e) {
        std::cerr << "[FATAL] " << e.what() << "\n"; return 1;
    }

    std::shared_ptr<vanguard::Database> db;
    try {
        db = std::make_shared<vanguard::Database>(DB_PATH);
        db->init_schema();
    } catch (const std::exception& e) {
        std::cerr << "[FATAL] DB: " << e.what() << "\n"; return 1;
    }

    std::shared_ptr<vanguard::InventoryEngine> engine;
    try {
        std::cout << "[Engine] Booting Phase 4 Dispatch Engine...\n";
        engine = std::make_shared<vanguard::InventoryEngine>(db);
        auto s = engine->stats();
        std::cout << "[Engine] ✓ AVL Tree       h=" << s.avl_height << " n=" << s.avl_size << "\n"
                  << "[Engine] ✓ Hash Table     load=" << std::fixed << std::setprecision(2)
                  << s.ht_load_factor << "\n"
                  << "[Engine] ✓ Warehouse Grid walkable=" << s.graph_walkable << "\n"
                  << "[Engine] ✓ Shipping Graph " << s.shipping_nodes << " regions\n"
                  << "[Engine] ✓ Order Heap     ready (0 orders)\n"
                  << "[Engine] ✓ Knapsack Opt   ready (0/1 DP)\n\n";
    } catch (const std::exception& e) {
        std::cerr << "[FATAL] Engine: " << e.what() << "\n"; return 1;
    }

    crow::SimpleApp app;
    app.loglevel(crow::LogLevel::Warning);

    vanguard::Router router(engine);
    router.register_routes(app);

    std::cout << "[Server] Listening on port " << PORT << "\n"
              << "[Server] http://localhost:" << PORT << "/api\n\n";

    app.port(PORT).multithreaded().concurrency(THREADS).run();
    return 0;
}
