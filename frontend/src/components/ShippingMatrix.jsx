/**
 * ShippingMatrix.jsx — Phase 3
 *
 * Displays the Floyd-Warshall pre-computed all-pairs cost matrix.
 * Clicking a cell shows the full route between the two warehouses.
 */

import { useState }         from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Network, ChevronRight, TrendingDown, Zap } from 'lucide-react'
import { useShippingMatrix } from '../hooks/useApi'

// ── Cost cell ───────────────────────────────────────────────────────────────

function CostCell({ data, isSelected, onClick, isSelf }) {
  if (isSelf) {
    return (
      <td className="px-3 py-2.5 text-center">
        <span className="font-mono text-xs text-white/15">—</span>
      </td>
    )
  }

  if (!data || !data.reachable) {
    return (
      <td className="px-3 py-2.5 text-center">
        <span className="font-mono text-xs text-red-400/40">∞</span>
      </td>
    )
  }

  // Cost-based hue: cheap = green, expensive = amber
  const cost    = data.cost
  const isLow   = cost < 10
  const isMid   = cost >= 10 && cost < 18
  const colorCls = isLow ? 'text-[#00ff88]' : isMid ? 'text-[#00f5ff]' : 'text-amber-400'

  return (
    <td className="px-2 py-2">
      <button
        onClick={onClick}
        className={`
          w-full font-mono text-xs rounded px-2 py-1 transition-all duration-150
          ${isSelected
            ? 'bg-[#00f5ff]/15 border border-[#00f5ff]/30 text-[#00f5ff]'
            : `${colorCls} hover:bg-white/[0.04] border border-transparent`
          }
        `}
      >
        ₹{cost.toFixed(1)}k
      </button>
    </td>
  )
}

// ── Route detail panel ──────────────────────────────────────────────────────

function RouteDetail({ from, to, data, warehouses }) {
  if (!data) return null

  return (
    <motion.div
      key={`${from}-${to}`}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-4 border-[#00f5ff]/10 flex flex-col gap-3"
    >
      <div className="flex items-center gap-2">
        <Zap size={12} className="text-[#00f5ff]" />
        <span className="font-display text-[10px] tracking-widest text-white/50">
          OPTIMAL ROUTE
        </span>
        <span className="ml-auto font-mono text-[9px] border border-[#00f5ff]/20 text-[#00f5ff]/40 px-1.5 py-0.5 rounded">
          FLOYD-WARSHALL
        </span>
      </div>

      {/* Route path */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {data.path.map((wh, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <span className={`
              font-mono text-xs px-2 py-1 rounded border
              ${i === 0 ? 'bg-[#00ff88]/10 border-[#00ff88]/30 text-[#00ff88]' :
                i === data.path.length - 1 ? 'bg-[#ffb800]/10 border-[#ffb800]/30 text-[#ffb800]' :
                'bg-white/[0.04] border-white/10 text-white/60'}
            `}>
              {wh}
            </span>
            {i < data.path.length - 1 && (
              <ChevronRight size={12} className="text-white/20 shrink-0" />
            )}
          </div>
        ))}
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4">
        <div>
          <p className="font-mono text-[10px] text-white/25">SHIPPING COST</p>
          <p className="font-mono text-lg font-bold text-[#00f5ff]">₹{data.cost.toFixed(1)}k</p>
          <p className="font-mono text-[9px] text-white/20">per tonne</p>
        </div>
        <div>
          <p className="font-mono text-[10px] text-white/25">HOPS</p>
          <p className="font-mono text-lg font-bold text-[#b347ff]">{data.path.length - 1}</p>
          <p className="font-mono text-[9px] text-white/20">transfers</p>
        </div>
        <div className="ml-auto text-right">
          <p className="font-mono text-[9px] text-white/15 leading-relaxed">
            Cost includes tolls,<br/>terrain, and freight.
          </p>
        </div>
      </div>
    </motion.div>
  )
}

// ── Main component ──────────────────────────────────────────────────────────

export default function ShippingMatrix() {
  const { matrix, loading, error } = useShippingMatrix()
  const [selected, setSelected]    = useState(null)   // { from, to }

  if (loading) {
    return (
      <div className="glass-card p-6">
        <div className="flex flex-col gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="skeleton h-8 rounded" />
          ))}
        </div>
      </div>
    )
  }

  if (error || !matrix) {
    return (
      <div className="glass-card p-6 text-center">
        <p className="font-mono text-xs text-red-400/60">
          Cannot load shipping matrix — ensure Phase 3 engine is running.
        </p>
      </div>
    )
  }

  const { warehouses, matrix: rows } = matrix
  const selectedData = selected
    ? rows[selected.from][selected.to]
    : null

  return (
    <div className="flex flex-col gap-4">

      {/* Header */}
      <div className="flex items-center gap-2">
        <Network size={14} className="text-[#b347ff]" />
        <span className="font-display text-xs font-bold tracking-widest text-white/70">
          REGIONAL SHIPPING MATRIX
        </span>
        <span className="font-mono text-[9px] border border-[#b347ff]/20 text-[#b347ff]/40 px-1.5 py-0.5 rounded ml-1">
          FLOYD-WARSHALL O(V³)
        </span>
      </div>

      {/* Explanation */}
      <p className="font-body text-xs text-white/30 leading-relaxed">
        All-pairs shortest paths between {warehouses.length} regional warehouses.
        Pre-computed at engine boot. Click any cell to see the optimal route.
        Costs in ₹k per tonne — lower is better.
      </p>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[500px]">
            <thead>
              <tr className="border-b border-white/[0.05]"
                  style={{ background: 'rgba(3,7,18,0.8)' }}>
                <th className="px-3 py-2.5 text-left">
                  <span className="font-mono text-[9px] text-white/20">FROM ↓  TO →</span>
                </th>
                {warehouses.map(wh => (
                  <th key={wh.id} className="px-3 py-2.5 text-center">
                    <div className="font-mono text-[10px] text-[#b347ff]/70">{wh.name}</div>
                    <div className="font-mono text-[9px] text-white/25">{wh.city}</div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {warehouses.map((fromWh, i) => (
                <tr key={fromWh.id}
                    className="border-b border-white/[0.03] hover:bg-white/[0.01] transition-colors">
                  {/* Row header */}
                  <td className="px-3 py-2.5">
                    <div className="font-mono text-[10px] text-[#b347ff]/70">{fromWh.name}</div>
                    <div className="font-mono text-[9px] text-white/25">{fromWh.city}</div>
                  </td>
                  {/* Cost cells */}
                  {warehouses.map((toWh, j) => (
                    <CostCell
                      key={toWh.id}
                      data={rows[i][j]}
                      isSelf={i === j}
                      isSelected={selected?.from === i && selected?.to === j}
                      onClick={() => {
                        if (i !== j)
                          setSelected(selected?.from === i && selected?.to === j
                            ? null
                            : { from: i, to: j })
                      }}
                    />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Route detail */}
      <AnimatePresence mode="wait">
        {selected && selectedData?.reachable && (
          <RouteDetail
            key={`${selected.from}-${selected.to}`}
            from={selected.from}
            to={selected.to}
            data={selectedData}
            warehouses={warehouses}
          />
        )}
      </AnimatePresence>

      {/* Cost legend */}
      <div className="flex items-center gap-4 flex-wrap">
        <span className="font-mono text-[9px] text-white/20">COST LEGEND:</span>
        {[
          { color: 'text-[#00ff88]', label: '< ₹10k (cheap)' },
          { color: 'text-[#00f5ff]', label: '₹10k–18k (moderate)' },
          { color: 'text-amber-400', label: '> ₹18k (expensive)' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1">
            <span className={`font-mono text-xs ${color}`}>●</span>
            <span className="font-mono text-[9px] text-white/30">{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
