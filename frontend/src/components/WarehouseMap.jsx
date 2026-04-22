/**
 * WarehouseMap.jsx — Phase 3
 *
 * Interactive 10×10 warehouse grid that:
 *   1. Renders walkable tiles, shelf obstacles, and product locations
 *   2. Lets the user click a product → auto-runs Dijkstra from entry (node 0)
 *      to that product's grid location → animates the path cell by cell
 *   3. Lets the user manually click any two cells to run a custom path
 *   4. Displays path cost, hop count, and algorithm elapsed time
 *   5. Shows a legend explaining all tile types
 */

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence }           from 'framer-motion'
import { Navigation, Zap, RotateCcw, GitBranch, AlertTriangle, Package } from 'lucide-react'
import { useGridInfo, fetchPath }            from '../hooks/useApi'

const ROWS = 10
const COLS = 10

// ── Tile type constants ─────────────────────────────────────────────────────
const TILE = {
  WALKABLE:  'walkable',
  OBSTACLE:  'obstacle',
  PATH:      'path',
  START:     'start',
  END:       'end',
  PRODUCT:   'product',
  ENTRY:     'entry',
}

// ── Visual styles for each tile type ───────────────────────────────────────
const TILE_STYLE = {
  [TILE.WALKABLE]:  'bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.08] cursor-pointer',
  [TILE.OBSTACLE]:  'bg-[#b347ff]/10 border-[#b347ff]/20 cursor-not-allowed',
  [TILE.PATH]:      'bg-[#00f5ff]/20 border-[#00f5ff]/40',
  [TILE.START]:     'bg-[#00ff88]/30 border-[#00ff88]/60',
  [TILE.END]:       'bg-[#ffb800]/30 border-[#ffb800]/60',
  [TILE.PRODUCT]:   'bg-[#00f5ff]/10 border-[#00f5ff]/30 cursor-pointer',
  [TILE.ENTRY]:     'bg-[#00ff88]/15 border-[#00ff88]/30',
}

// ── Single grid cell ────────────────────────────────────────────────────────

function GridCell({ nodeId, tileType, animDelay, product, isSelected,
                    onCellClick, row, col }) {
  const style = TILE_STYLE[tileType] ?? TILE_STYLE[TILE.WALKABLE]
  const isPath    = tileType === TILE.PATH
  const isObs     = tileType === TILE.OBSTACLE
  const isEntry   = nodeId === 0

  return (
    <motion.div
      initial={isPath ? { scale: 0.5, opacity: 0 } : false}
      animate={isPath ? { scale: 1,   opacity: 1 } : {}}
      transition={isPath ? { delay: animDelay, duration: 0.15, type: 'spring', stiffness: 400 } : {}}
      onClick={() => !isObs && onCellClick(nodeId, row, col)}
      className={`
        relative border rounded-sm flex items-center justify-center
        transition-colors duration-100 select-none
        ${style}
        ${isSelected ? 'ring-1 ring-white/40' : ''}
      `}
      style={{ aspectRatio: '1' }}
      title={isEntry ? 'Entry/Exit' : product ? product.sku : `Node ${nodeId}`}
    >
      {/* Obstacle: shelf icon */}
      {isObs && (
        <div className="w-full h-full flex items-center justify-center opacity-30">
          <div className="w-2/3 h-1/2 bg-[#b347ff]/40 rounded-sm" />
        </div>
      )}

      {/* Entry node marker */}
      {isEntry && !isObs && (
        <div className="w-1.5 h-1.5 rounded-full bg-[#00ff88] opacity-70" />
      )}

      {/* Product dot */}
      {product && !isObs && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className={`w-1.5 h-1.5 rounded-full ${
            tileType === TILE.END   ? 'bg-[#ffb800]' :
            tileType === TILE.START ? 'bg-[#00ff88]' :
            'bg-[#00f5ff]'
          }`} />
        </div>
      )}

      {/* Path wave */}
      {isPath && (
        <div className="absolute inset-0 rounded-sm bg-[#00f5ff]/10 animate-pulse" />
      )}

      {/* Start marker */}
      {tileType === TILE.START && (
        <span className="font-mono text-[7px] text-[#00ff88] font-bold">S</span>
      )}

      {/* End marker */}
      {tileType === TILE.END && (
        <span className="font-mono text-[7px] text-[#ffb800] font-bold">E</span>
      )}
    </motion.div>
  )
}

// ── Path stats bar ──────────────────────────────────────────────────────────

function PathStats({ pathData, loading }) {
  if (!pathData && !loading) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-3 border-[#00f5ff]/10 flex flex-wrap items-center gap-4"
    >
      <div className="flex items-center gap-2">
        <GitBranch size={12} className="text-[#00f5ff]" />
        <span className="font-display text-[10px] tracking-widest text-white/40">
          DIJKSTRA RESULT
        </span>
      </div>

      {loading ? (
        <span className="font-mono text-xs text-white/30 animate-pulse">Computing path…</span>
      ) : pathData ? (
        <>
          {pathData.reachable ? (
            <>
              <Stat label="HOPS"    value={pathData.hops}   color="cyan"   />
              <Stat label="COST"    value={pathData.cost?.toFixed(1)} color="green"  />
              <Stat label="NODES"   value={pathData.path?.length} color="purple" />
              <Stat label="TIME"    value={`${pathData.elapsed_us}µs`} color="amber" />
            </>
          ) : (
            <span className="flex items-center gap-1.5 font-mono text-xs text-red-400">
              <AlertTriangle size={11} /> No path exists (destination unreachable)
            </span>
          )}
        </>
      ) : null}
    </motion.div>
  )
}

function Stat({ label, value, color }) {
  const colors = {
    cyan:   'text-[#00f5ff]',
    green:  'text-[#00ff88]',
    purple: 'text-[#b347ff]',
    amber:  'text-[#ffb800]',
  }
  return (
    <div className="flex items-center gap-1.5">
      <span className="font-mono text-[10px] text-white/25">{label}</span>
      <span className={`font-mono text-sm font-bold ${colors[color]}`}>{value}</span>
    </div>
  )
}

// ── Main WarehouseMap component ─────────────────────────────────────────────

export default function WarehouseMap({ products = [] }) {
  const { grid, loading: gridLoading } = useGridInfo()

  const [pathData,    setPathData]    = useState(null)
  const [pathLoading, setPathLoading] = useState(false)
  const [pathNodes,   setPathNodes]   = useState(new Set())
  const [startNode,   setStartNode]   = useState(0)      // default: entry (0,0)
  const [endNode,     setEndNode]     = useState(null)
  const [clickMode,   setClickMode]   = useState('auto') // 'auto' | 'start' | 'end'
  const [selectedProd, setSelectedProd] = useState(null)

  // Build obstacle set from grid info
  const obstacleSet = new Set(grid?.obstacles ?? [])

  // Build product map: node_id → product
  const productMap = {}
  products.forEach(p => {
    const nodeId = p.warehouse_y * COLS + p.warehouse_x
    productMap[nodeId] = p
  })

  // ── Determine tile type for each cell ────────────────────────────────────
  const getTileType = (nodeId) => {
    if (obstacleSet.has(nodeId))   return TILE.OBSTACLE
    if (nodeId === startNode)      return TILE.START
    if (nodeId === endNode)        return TILE.END
    if (pathNodes.has(nodeId))     return TILE.PATH
    if (productMap[nodeId])        return TILE.PRODUCT
    if (nodeId === 0)              return TILE.ENTRY
    return TILE.WALKABLE
  }

  // ── Run Dijkstra ─────────────────────────────────────────────────────────
  const runPath = useCallback(async (from, to) => {
    if (from === to || obstacleSet.has(to)) return
    setPathLoading(true)
    setPathData(null)
    setPathNodes(new Set())

    try {
      const data = await fetchPath(from, to)
      setPathData(data)
      // Animate path nodes in: reveal them progressively
      const nodeIds = (data.path ?? []).map(n => n.node)
      // Build the set incrementally for animation effect
      let i = 0
      const interval = setInterval(() => {
        setPathNodes(prev => {
          const next = new Set(prev)
          if (i < nodeIds.length) { next.add(nodeIds[i]); i++ }
          else clearInterval(interval)
          return next
        })
      }, 30)
    } catch (e) {
      setPathData({ reachable: false, hops: 0, cost: 0, path: [] })
    } finally {
      setPathLoading(false)
    }
  }, [obstacleSet])

  // ── Handle cell click ─────────────────────────────────────────────────────
  const handleCellClick = (nodeId, row, col) => {
    if (obstacleSet.has(nodeId)) return

    // If a product is here, auto-navigate to it
    if (productMap[nodeId]) {
      setSelectedProd(productMap[nodeId])
      setEndNode(nodeId)
      runPath(startNode, nodeId)
      return
    }

    if (clickMode === 'start') {
      setStartNode(nodeId)
      setPathData(null); setPathNodes(new Set())
      setClickMode('end')
    } else if (clickMode === 'end') {
      setEndNode(nodeId)
      runPath(startNode, nodeId)
      setClickMode('start')
    } else {
      // Auto mode: first click = start, second = end
      if (endNode === null) {
        setStartNode(nodeId)
        setPathData(null); setPathNodes(new Set())
        setClickMode('end')
      } else {
        setEndNode(nodeId)
        runPath(startNode, nodeId)
        setClickMode('start')
      }
    }
  }

  // Auto-navigate when a product is selected from outside
  const navigateToProduct = useCallback((product) => {
    if (!product) return
    const nodeId = product.warehouse_y * COLS + product.warehouse_x
    setSelectedProd(product)
    setEndNode(nodeId)
    runPath(0, nodeId)
  }, [runPath])

  const handleReset = () => {
    setPathData(null); setPathNodes(new Set())
    setStartNode(0); setEndNode(null)
    setSelectedProd(null); setClickMode('auto')
  }

  if (gridLoading) {
    return (
      <div className="glass-card p-6 flex items-center justify-center gap-3 min-h-[320px]">
        <div className="skeleton w-64 h-64 rounded-lg" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Navigation size={14} className="text-[#00f5ff]" />
          <span className="font-display text-xs font-bold tracking-widest text-white/70">
            WAREHOUSE NAVIGATOR
          </span>
          <span className="font-mono text-[9px] border border-[#00f5ff]/20 text-[#00f5ff]/40 px-1.5 py-0.5 rounded">
            DIJKSTRA
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Click mode toggle */}
          <div className="flex rounded-lg border border-white/10 overflow-hidden">
            {['start','end'].map(mode => (
              <button
                key={mode}
                onClick={() => setClickMode(mode)}
                className={`font-mono text-[10px] px-3 py-1.5 transition-colors ${
                  clickMode === mode
                    ? mode === 'start'
                      ? 'bg-[#00ff88]/15 text-[#00ff88]'
                      : 'bg-[#ffb800]/15 text-[#ffb800]'
                    : 'text-white/30 hover:text-white/60'
                }`}
              >
                SET {mode.toUpperCase()}
              </button>
            ))}
          </div>

          <button
            onClick={handleReset}
            className="btn-ghost flex items-center gap-1.5 border border-white/10 rounded-lg px-3 py-1.5"
          >
            <RotateCcw size={12} />
            <span className="font-mono text-[10px]">Reset</span>
          </button>
        </div>
      </div>

      {/* ── Selected product ────────────────────────────────────────── */}
      <AnimatePresence>
        {selectedProd && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{    opacity: 0, height: 0 }}
            className="glass-card px-4 py-2.5 border-[#00f5ff]/10 flex items-center gap-3"
          >
            <Package size={13} className="text-[#00f5ff] shrink-0" />
            <span className="font-mono text-xs text-[#00f5ff]/70">{selectedProd.sku}</span>
            <span className="font-body text-sm text-white/70">{selectedProd.name}</span>
            <span className="font-mono text-xs text-white/30 ml-auto">
              Grid ({selectedProd.warehouse_x}, {selectedProd.warehouse_y})
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── The 10×10 Grid ──────────────────────────────────────────── */}
      <div className="glass-card p-3 border-white/[0.06]">
        {/* Column labels */}
        <div className="grid mb-1" style={{ gridTemplateColumns: `24px repeat(${COLS}, 1fr)` }}>
          <div />
          {Array.from({ length: COLS }, (_, c) => (
            <div key={c} className="text-center font-mono text-[8px] text-white/15">{c}</div>
          ))}
        </div>

        {/* Rows */}
        {Array.from({ length: ROWS }, (_, row) => (
          <div key={row} className="grid mb-0.5"
               style={{ gridTemplateColumns: `24px repeat(${COLS}, 1fr)`, gap: '2px' }}>
            {/* Row label */}
            <div className="flex items-center justify-center font-mono text-[8px] text-white/15">
              {row}
            </div>
            {/* Cells */}
            {Array.from({ length: COLS }, (_, col) => {
              const nodeId   = row * COLS + col
              const tileType = getTileType(nodeId)
              const prod     = productMap[nodeId]
              // Path index for staggered animation
              const pathIdx  = tileType === TILE.PATH
                ? [...pathNodes].indexOf(nodeId)
                : 0

              return (
                <GridCell
                  key={nodeId}
                  nodeId={nodeId}
                  row={row}
                  col={col}
                  tileType={tileType}
                  animDelay={pathIdx * 0.02}
                  product={prod}
                  isSelected={nodeId === startNode || nodeId === endNode}
                  onCellClick={handleCellClick}
                />
              )
            })}
          </div>
        ))}
      </div>

      {/* ── Path stats ──────────────────────────────────────────────── */}
      <PathStats pathData={pathData} loading={pathLoading} />

      {/* ── Legend ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {[
          { color: 'bg-[#00ff88]/30 border-[#00ff88]/50', label: 'Start / Entry' },
          { color: 'bg-[#ffb800]/30 border-[#ffb800]/50', label: 'End' },
          { color: 'bg-[#00f5ff]/20 border-[#00f5ff]/40', label: 'Dijkstra path' },
          { color: 'bg-[#00f5ff]/10 border-[#00f5ff]/30', label: 'Product location' },
          { color: 'bg-[#b347ff]/10 border-[#b347ff]/20', label: 'Shelf / obstacle' },
          { color: 'bg-white/[0.03] border-white/[0.06]', label: 'Walkable aisle' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded-sm border ${color}`} />
            <span className="font-mono text-[10px] text-white/30">{label}</span>
          </div>
        ))}
      </div>

      {/* ── Instruction hint ────────────────────────────────────────── */}
      <p className="font-mono text-[10px] text-white/20">
        Click any walkable cell to set start/end points · Click a product tile to auto-navigate · Use the buttons above to lock click mode
      </p>
    </div>
  )
}

// Expose the navigateToProduct ref hook so parent components can trigger navigation
export { }
