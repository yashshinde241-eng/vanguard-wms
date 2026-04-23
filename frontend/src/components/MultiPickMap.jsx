/**
 * MultiPickMap.jsx — Phase 5
 *
 * Extends the Phase 3 WarehouseMap concept with:
 *   1. Multi-select mode — check products in the panel to build a pick list
 *   2. TSP solver call — when ≥2 products selected, runs Held-Karp or
 *      Nearest Neighbor on the backend
 *   3. Picker's Loop — draws the full stitched TSP path on the 10×10 grid
 *      using a distinct amber/neon color separate from single Dijkstra paths
 *   4. Tour summary — stop order, total cost, algorithm used
 *
 * All tile rendering logic is self-contained (no dependency on Phase 3 file).
 */

import { useState, useCallback }   from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Route, Package, CheckCircle2, Loader2,
  RotateCcw, Zap, GitBranch, AlertTriangle
} from 'lucide-react'
import { useGridInfo, useProducts, solveTSP } from '../hooks/useApi'

const ROWS = 10
const COLS = 10

// ── Tile types and styles ──────────────────────────────────────────────────

const TILE = {
  WALKABLE: 'walkable',
  OBSTACLE: 'obstacle',
  TSP_PATH: 'tsp_path',   // amber TSP loop
  TSP_STOP: 'tsp_stop',   // stop in the tour (product location)
  PRODUCT:  'product',    // product not in current pick list
  DEPOT:    'depot',      // entry/depot node
}

const TILE_STYLE = {
  [TILE.WALKABLE]: 'bg-white/[0.03] border-white/[0.05]',
  [TILE.OBSTACLE]: 'bg-[#b347ff]/10 border-[#b347ff]/20',
  [TILE.TSP_PATH]: 'bg-[#ffb800]/20 border-[#ffb800]/35',
  [TILE.TSP_STOP]: 'bg-[#ffb800]/35 border-[#ffb800]/70',
  [TILE.PRODUCT]:  'bg-[#00f5ff]/8  border-[#00f5ff]/20',
  [TILE.DEPOT]:    'bg-[#00ff88]/15 border-[#00ff88]/30',
}

// ── Grid cell ──────────────────────────────────────────────────────────────

function MapCell({ nodeId, tileType, stopIndex, isDepot, productSku, animDelay }) {
  const style    = TILE_STYLE[tileType] ?? TILE_STYLE[TILE.WALKABLE]
  const isTspPath = tileType === TILE.TSP_PATH
  const isStop    = tileType === TILE.TSP_STOP

  return (
    <motion.div
      initial={isTspPath || isStop ? { scale: 0.4, opacity: 0 } : false}
      animate={isTspPath || isStop ? { scale: 1,   opacity: 1 } : {}}
      transition={isTspPath ? { delay: animDelay, duration: 0.1 } : {}}
      className={`relative border rounded-sm flex items-center justify-center select-none
                  ${style} transition-colors duration-75`}
      style={{ aspectRatio: '1' }}
      title={isStop ? `Stop ${stopIndex}: ${productSku ?? nodeId}` : `Node ${nodeId}`}
    >
      {/* Obstacle shelf */}
      {tileType === TILE.OBSTACLE && (
        <div className="w-full h-full flex items-center justify-center opacity-25">
          <div className="w-2/3 h-1/2 bg-[#b347ff]/40 rounded-sm" />
        </div>
      )}

      {/* Depot marker */}
      {isDepot && tileType !== TILE.OBSTACLE && (
        <div className="w-1.5 h-1.5 rounded-full bg-[#00ff88] shadow-[0_0_4px_#00ff88]" />
      )}

      {/* TSP stop number */}
      {isStop && stopIndex !== undefined && (
        <span className="font-mono text-[8px] font-bold text-[#ffb800]">{stopIndex}</span>
      )}

      {/* TSP path pulse */}
      {isTspPath && (
        <div className="absolute inset-0 rounded-sm bg-[#ffb800]/10 animate-pulse" />
      )}

      {/* Product dot (not in pick list) */}
      {tileType === TILE.PRODUCT && (
        <div className="w-1 h-1 rounded-full bg-[#00f5ff]/50" />
      )}
    </motion.div>
  )
}

// ── Tour summary panel ─────────────────────────────────────────────────────

function TourSummary({ tspResult }) {
  if (!tspResult) return null
  const { tour_order, total_cost, algorithm, is_optimal,
          dijkstra_calls, full_path_len, elapsed_us } = tspResult
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-4 border-[#ffb800]/10 flex flex-col gap-3"
    >
      <div className="flex items-center gap-2 flex-wrap">
        <Route size={12} className="text-[#ffb800]" />
        <span className="font-display text-[10px] tracking-widest text-white/50">
          PICKER'S LOOP
        </span>
        <span className={`font-mono text-[9px] px-1.5 py-0.5 rounded border
          ${is_optimal
            ? 'border-[#00ff88]/20 text-[#00ff88]/50'
            : 'border-[#ffb800]/20 text-[#ffb800]/50'}`}>
          {is_optimal ? 'OPTIMAL' : 'HEURISTIC'}
        </span>
        <span className="ml-auto font-mono text-[9px] text-white/20">{elapsed_us}µs</span>
      </div>

      {/* Stop sequence */}
      <div className="flex items-center gap-1 flex-wrap">
        {tour_order.map((stop, i) => {
          const isDepot = i === 0 || i === tour_order.length - 1
          return (
            <div key={i} className="flex items-center gap-1">
              <span className={`font-mono text-[10px] px-2 py-1 rounded border
                ${isDepot
                  ? 'bg-[#00ff88]/10 border-[#00ff88]/25 text-[#00ff88]'
                  : 'bg-[#ffb800]/8 border-[#ffb800]/20 text-[#ffb800]/80'
                }`}>
                {isDepot ? 'DEPOT' : `${stop.row},${stop.col}`}
              </span>
              {i < tour_order.length - 1 && (
                <span className="text-white/15 text-xs">→</span>
              )}
            </div>
          )
        })}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 border-t border-white/[0.04] pt-3">
        {[
          { label: 'TOTAL COST',    value: total_cost.toFixed(1),    color: 'text-[#ffb800]' },
          { label: 'ALGORITHM',     value: algorithm.split(' ')[0],  color: 'text-[#b347ff]' },
          { label: 'DIJKSTRA RUNS', value: dijkstra_calls,           color: 'text-[#00f5ff]' },
          { label: 'CELLS VISITED', value: full_path_len,            color: 'text-[#00ff88]' },
        ].map(({ label, value, color }) => (
          <div key={label}>
            <p className="font-mono text-[9px] text-white/20">{label}</p>
            <p className={`font-mono text-sm font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>
    </motion.div>
  )
}

// ── Main MultiPickMap ──────────────────────────────────────────────────────

export default function MultiPickMap() {
  const { grid,    loading: gridLoading } = useGridInfo()
  const { products, loading: prodLoading } = useProducts()

  const [selectedIds, setSelectedIds]   = useState(new Set())
  const [tspResult,   setTspResult]     = useState(null)
  const [tspNodes,    setTspNodes]      = useState(new Set())   // full path cells
  const [tspStops,    setTspStops]      = useState({})          // nodeId → stop index
  const [running,     setRunning]       = useState(false)
  const [error,       setError]         = useState(null)

  const obstacleSet = new Set(grid?.obstacles ?? [])

  // Product node map: nodeId → { product, selected }
  const productMap = {}
  products.forEach(p => {
    const node = p.warehouse_y * COLS + p.warehouse_x
    productMap[node] = p
  })

  const toggleProduct = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
    // Clear previous TSP result when selection changes
    setTspResult(null); setTspNodes(new Set()); setTspStops({})
  }

  const handleSolveTSP = async () => {
    if (selectedIds.size < 2) { setError('Select at least 2 products for TSP.'); return }
    setRunning(true); setError(null)
    setTspResult(null); setTspNodes(new Set()); setTspStops({})
    try {
      const data = await solveTSP([...selectedIds])
      setTspResult(data)

      // Mark full path cells
      const pathSet = new Set(data.full_path.map(n => n.node))
      setTspNodes(pathSet)

      // Mark stop nodes with their visit index
      const stops = {}
      data.tour_order.forEach((stop, i) => {
        // Skip depot (first and last)
        if (i > 0 && i < data.tour_order.length - 1)
          stops[stop.node] = i
      })
      setTspStops(stops)

    } catch (err) { setError(err.message) }
    finally { setRunning(false) }
  }

  const handleReset = () => {
    setSelectedIds(new Set()); setTspResult(null)
    setTspNodes(new Set()); setTspStops({}); setError(null)
  }

  const getTileType = (nodeId) => {
    if (obstacleSet.has(nodeId)) return TILE.OBSTACLE
    if (nodeId === 0)            return TILE.DEPOT
    if (tspStops[nodeId] !== undefined) return TILE.TSP_STOP
    if (tspNodes.has(nodeId))    return TILE.TSP_PATH
    if (productMap[nodeId])      return TILE.PRODUCT
    return TILE.WALKABLE
  }

  return (
    <div className="flex flex-col gap-4">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Route size={14} className="text-[#ffb800]" />
          <span className="font-display text-xs font-bold tracking-widest text-white/70">
            MULTI-PICK ROUTE
          </span>
          <span className="font-mono text-[9px] border border-[#ffb800]/20 text-[#ffb800]/40 px-1.5 py-0.5 rounded">
            TSP SOLVER
          </span>
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <span className="font-mono text-[10px] text-white/30">
              {selectedIds.size} product{selectedIds.size !== 1 ? 's' : ''} selected
            </span>
          )}
          <button onClick={handleReset}
            className="btn-ghost flex items-center gap-1.5 border border-white/10 rounded-lg px-3 py-1.5">
            <RotateCcw size={11} />
            <span className="font-mono text-[10px]">Reset</span>
          </button>
          <motion.button
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
            onClick={handleSolveTSP}
            disabled={running || selectedIds.size < 2}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-xs
                        border transition-all duration-200
                        ${selectedIds.size < 2
                          ? 'border-white/10 text-white/20 cursor-not-allowed'
                          : 'border-[#ffb800]/30 text-[#ffb800] bg-[#ffb800]/5 hover:bg-[#ffb800]/10'
                        }`}
          >
            {running
              ? <><Loader2 size={12} className="animate-spin" /> Solving TSP…</>
              : <><Route size={12} /> Optimize Route</>}
          </motion.button>
        </div>
      </div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            className="glass-card px-4 py-2.5 border-red-500/20 flex items-center gap-2">
            <AlertTriangle size={12} className="text-red-400 shrink-0" />
            <span className="font-mono text-xs text-red-400">{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-4">

        {/* The Grid */}
        <div className="glass-card p-3 border-white/[0.06]">
          {/* Col labels */}
          <div className="grid mb-1" style={{ gridTemplateColumns: `20px repeat(${COLS}, 1fr)` }}>
            <div />
            {Array.from({ length: COLS }, (_, c) => (
              <div key={c} className="text-center font-mono text-[7px] text-white/15">{c}</div>
            ))}
          </div>
          {/* Rows */}
          {Array.from({ length: ROWS }, (_, row) => (
            <div key={row} className="grid mb-0.5"
                 style={{ gridTemplateColumns: `20px repeat(${COLS}, 1fr)`, gap: '2px' }}>
              <div className="flex items-center justify-center font-mono text-[7px] text-white/15">{row}</div>
              {Array.from({ length: COLS }, (_, col) => {
                const nodeId  = row * COLS + col
                const type    = getTileType(nodeId)
                const pathIdx = tspNodes.has(nodeId) ? [...tspNodes].indexOf(nodeId) : 0
                return (
                  <MapCell
                    key={nodeId}
                    nodeId={nodeId}
                    tileType={type}
                    stopIndex={tspStops[nodeId]}
                    isDepot={nodeId === 0}
                    productSku={productMap[nodeId]?.sku}
                    animDelay={pathIdx * 0.008}
                  />
                )
              })}
            </div>
          ))}
        </div>

        {/* Product selector */}
        <div className="glass-card flex flex-col overflow-hidden">
          <div className="shrink-0 flex items-center gap-2 px-3 py-2.5 border-b border-white/[0.05]">
            <Package size={11} className="text-[#00f5ff]" />
            <span className="font-display text-[10px] tracking-widest text-white/40">
              PICK LIST
            </span>
            <span className="ml-auto font-mono text-[9px] text-white/20">
              {selectedIds.size}/{products.length}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto py-1 min-h-0">
            {prodLoading ? (
              <div className="flex flex-col gap-1 p-2">
                {[...Array(5)].map((_,i) => <div key={i} className="skeleton h-9 rounded" />)}
              </div>
            ) : products.length === 0 ? (
              <p className="font-mono text-[10px] text-white/20 text-center py-6 px-3">
                Add products first.
              </p>
            ) : (
              products.map(p => {
                const checked = selectedIds.has(p.id)
                const node    = p.warehouse_y * COLS + p.warehouse_x
                const blocked = obstacleSet.has(node)
                return (
                  <motion.button
                    key={p.id}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => !blocked && toggleProduct(p.id)}
                    disabled={blocked}
                    className={`w-full flex items-center gap-2 px-3 py-2 border-b border-white/[0.03]
                                last:border-0 transition-colors text-left
                                ${blocked ? 'opacity-30 cursor-not-allowed' : 'hover:bg-white/[0.03]'}
                                ${checked ? 'bg-[#ffb800]/5' : ''}`}
                  >
                    <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0
                                    ${checked
                                      ? 'bg-[#ffb800]/20 border-[#ffb800]/50'
                                      : 'border-white/20'}`}>
                      {checked && <CheckCircle2 size={9} className="text-[#ffb800]" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-[9px] text-[#00f5ff]/50 truncate">{p.sku}</p>
                      <p className="font-body text-[10px] text-white/50 truncate">{p.name}</p>
                    </div>
                    <span className="font-mono text-[9px] text-white/20 shrink-0">
                      {p.warehouse_x},{p.warehouse_y}
                    </span>
                  </motion.button>
                )
              })
            )}
          </div>

          <div className="shrink-0 border-t border-white/[0.04] px-3 py-2">
            <p className="font-mono text-[9px] text-white/20 leading-relaxed">
              Select ≥2 products then click Optimize Route
            </p>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {[
          { color: 'bg-[#00ff88]/15 border-[#00ff88]/30', label: 'Depot (start/end)' },
          { color: 'bg-[#ffb800]/35 border-[#ffb800]/70', label: 'TSP stop' },
          { color: 'bg-[#ffb800]/20 border-[#ffb800]/35', label: "Picker's path" },
          { color: 'bg-[#00f5ff]/8  border-[#00f5ff]/20', label: 'Product (not selected)' },
          { color: 'bg-[#b347ff]/10 border-[#b347ff]/20', label: 'Shelf obstacle' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded-sm border ${color}`} />
            <span className="font-mono text-[9px] text-white/25">{label}</span>
          </div>
        ))}
      </div>

      {/* Tour summary */}
      <TourSummary tspResult={tspResult} />

      {/* DSA explanation */}
      {tspResult && (
        <div className="glass-card p-3 border-white/[0.04]">
          <p className="font-mono text-[10px] text-white/30 leading-relaxed">
            <span className="text-[#ffb800]/70">{tspResult.algorithm}</span>
            {' '}found the optimal pick route using {tspResult.dijkstra_calls} Dijkstra runs
            to build the pairwise distance matrix.
            {tspResult.is_optimal
              ? ` Held-Karp guarantees the globally shortest tour for ${tspResult.n_stops} stops.`
              : ` Nearest Neighbor is a fast heuristic — typically within 20% of optimal.`}
            {' '}Total walk distance: {tspResult.total_cost.toFixed(1)} grid units.
          </p>
        </div>
      )}
    </div>
  )
}
