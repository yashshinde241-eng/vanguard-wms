cmake_minimum_required(VERSION 3.20)
project(VanguardWMS VERSION 2.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

if(NOT CMAKE_BUILD_TYPE)
    set(CMAKE_BUILD_TYPE Release CACHE STRING "Build type" FORCE)
endif()

message(STATUS "Build type: ${CMAKE_BUILD_TYPE}")
message(STATUS "Compiler:   ${CMAKE_CXX_COMPILER_ID} ${CMAKE_CXX_COMPILER_VERSION}")

# ── Compiler flags ────────────────────────────────────────────────────────
if(MSVC)
    add_compile_options(/W3 /MP)
    if(CMAKE_BUILD_TYPE STREQUAL "Debug")
        add_compile_options(/Od /Zi /RTC1)
    else()
        add_compile_options(/O2 /DNDEBUG)
    endif()
    add_compile_definitions(
        _WIN32_WINNT=0x0A00
        WIN32_LEAN_AND_MEAN
        NOMINMAX
        _CRT_SECURE_NO_WARNINGS
    )
else()
    add_compile_options(-Wall -Wextra)
    if(CMAKE_BUILD_TYPE STREQUAL "Debug")
        add_compile_options(-g -O0)
    else()
        add_compile_options(-O2 -DNDEBUG)
    endif()
endif()

# ── Dependencies (all via vcpkg) ──────────────────────────────────────────
#
#  vcpkg install crow nlohmann-json sqlite3 asio
#
find_package(Crow          CONFIG REQUIRED)
find_package(nlohmann_json CONFIG REQUIRED)
find_package(SQLite3       REQUIRED)
find_package(asio          CONFIG REQUIRED)

# ── Source files ─────────────────────────────────────────────────────────
# NOTE: AVLTree.h, HashTable.h, LCRSTree.h, Engine.h are all header-only.
# Only the .cpp files that changed need to be listed here.
set(SOURCES
    src/main.cpp
    src/database.cpp   # unchanged from Phase 1
    src/router.cpp     # updated for Phase 2
)

add_executable(vanguard_engine ${SOURCES})

target_include_directories(vanguard_engine
    PRIVATE
        ${CMAKE_CURRENT_SOURCE_DIR}/include
)

target_link_libraries(vanguard_engine
    PRIVATE
        Crow::Crow
        nlohmann_json::nlohmann_json
        SQLite::SQLite3
        asio::asio
)

target_compile_definitions(vanguard_engine
    PRIVATE
        CROW_USE_STANDALONE_ASIO
        ASIO_STANDALONE
)

if(WIN32)
    target_link_libraries(vanguard_engine PRIVATE ws2_32 mswsock)
endif()

install(TARGETS vanguard_engine DESTINATION bin)
message(STATUS "Phase 2 configured. Build: cmake --build build --config Release")
