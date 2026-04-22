/**
 * SmartPacker.jsx — Phase 4
 *
 * 0/1 Knapsack packing optimiser UI.
 * Users select products from inventory, set a box weight capacity,
 * and the DP algorithm returns the optimal packing selection.
 *
 * Layout:
 *   ┌─────────────────────────────────────────────────┐
 *   │  Phase banner + capacity slider                  │
 *   ├────────────────────┬────────────────────────────┤
 *   │  Product selector  │  Box visualiser             │
 *   │  (checkbox list)   │  - Packed items (green)     │
 *   │                    │  - Left out (dimmed)         │
 *   │                    │  - Stats bar                 │
 *   └────────────────────┴────────────────────────────┘
 */

import { useState, useMemo }        from 'react'
import { motion, AnimatePresence }  from 'framer-motion'
import {
  Box, Package, CheckCircle2, XCircle, Loader2,
  ChevronRight, BarChart2, Zap, Scale
} from 'lucide-react'
import { useProducts, optimizePack } from '../hooks/useApi'

// Weight derivation must match the C++ Optimizer::from_product logic exactly:
// weight_g = clamp(ceil(price / 500) * 1000, 100, 10000)
function deriveWeightG(price) {
  const raw = Math.ceil(price / 500) * 1000
  return Math.min(Math.max(raw, 100), 10000)
}

// ── Product selector row ────────────────────────────────────────────────────

function ProductRow({ product, checked, onToggle }) {
  const wg = deriveWeightG(product.price)
  return (
    <motion.div
      whileTap={{ scale: 0.98 }}
      onClick={() => onToggle(product.id)}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer
                  border transition-all duration-100 select-none
                  ${checked
                    ? 'bg-[#00f5ff]/8 border-[#00f5ff]/20'
                    : 'bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.04]'
                  }`}
    >
      {/* Checkbox */}
      <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0
                        transition-colors ${checked
                          ? 'bg-[#00f5ff]/20 border-[#00f5ff]/50'
                          : 'border-white/20'}`}>
        {checked && <CheckCircle2 size={10} className="text-[#00f5ff]" />}
      </div>

      {/* SKU + name */}
      <div className="min-w-0 flex-1">
        <p className="font-mono text-[10px] text-[#00f5ff]/60 truncate">{product.sku}</p>
        <p className="font-body text-xs text-white/60 truncate">{product.name}</p>
      </div>

      {/* Weight + value */}
      <div className="text-right shrink-0">
        <p className="font-mono text-[10px] text-white/30">{(wg / 1000).toFixed(1)} kg</p>
        <p className="font-mono text-[10px] text-[#00ff88]/50">₹{product.price.toLocaleString('en-IN')}</p>
      </div>
    </motion.div>
  )
}

// ── Box visualiser ──────────────────────────────────────────────────────────

function BoxVisualiser({ result, capacityKg }) {
  if (!result) {
    return (
      <div className="glass-card flex flex-col items-center justify-center gap-3
                      min-h-[280px] border-dashed border-white/10 text-center px-6">
        <Box size={32} className="text-white/15" />
        <p className="font-display text-sm tracking-wider text-white/30">BOX IS EMPTY</p>
        <p className="font-mono text-xs text-white/20">
          Select products and run the optimizer to see what fits.
        </p>
      </div>
    )
  }

  const fillPct   = Math.min(result.efficiency * 100, 100)
  const fillColor = fillPct > 85 ? '#00ff88' : fillPct > 50 ? '#00f5ff' : '#b347ff'

  return (
    <div className="flex flex-col gap-4">

      {/* Box graphic */}
      <div className="glass-card p-4 border-[#00f5ff]/10">
        <div className="flex items-center gap-2 mb-4">
          <Box size={13} className="text-[#00f5ff]" />
          <span className="font-display text-[10px] tracking-widest text-white/50">
            BOX CAPACITY: {capacityKg} KG
          </span>
          <span className="ml-auto font-mono text-[9px] border border-[#00f5ff]/20 text-[#00f5ff]/40 px-1.5 py-0.5 rounded">
            {result.dp_ops.toLocaleString()} DP OPS
          </span>
        </div>

        {/* Fill bar */}
        <div className="relative h-8 rounded-lg bg-white/[0.04] border border-white/[0.06] overflow-hidden mb-3">
          <motion.div
            className="absolute inset-y-0 left-0 rounded-lg"
            style={{ backgroundColor: fillColor, opacity: 0.25 }}
            initial={{ width: 0 }}
            animate={{ width: `${fillPct}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
          <motion.div
            className="absolute inset-y-0 left-0 rounded-lg border-r-2"
            style={{ borderColor: fillColor }}
            initial={{ width: 0 }}
            animate={{ width: `${fillPct}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-mono text-xs text-white/70">
              {(result.total_weight_kg).toFixed(2)} kg / {result.capacity_kg} kg
              ({fillPct.toFixed(0)}% full)
            </span>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'PACKED',     value: result.packed.length,    color: 'text-[#00ff88]' },
            { label: 'LEFT OUT',   value: result.left_out.length,  color: 'text-white/40' },
            { label: 'VALUE',      value: `₹${(result.total_value/1000).toFixed(1)}k`,
              color: 'text-[#00f5ff]' },
          ].map(({ label, value, color }) => (
            <div key={label} className="text-center">
              <p className="font-mono text-[9px] text-white/25">{label}</p>
              <p className={`font-mono text-base font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Packed items */}
      {result.packed.length > 0 && (
        <div className="glass-card p-3 border-[#00ff88]/10">
          <p className="font-display text-[10px] tracking-widest text-[#00ff88]/60 mb-2 flex items-center gap-2">
            <CheckCircle2 size={10} /> PACKED ({result.packed.length})
          </p>
          <div className="flex flex-col gap-1.5">
            {result.packed.map(item => (
              <div key={item.product_id}
                   className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#00ff88]/5 border border-[#00ff88]/10">
                <div className="w-1.5 h-1.5 rounded-full bg-[#00ff88] shrink-0" />
                <span className="font-mono text-[10px] text-[#00ff88]/60 shrink-0 w-16">{item.sku}</span>
                <span className="font-body text-xs text-white/60 flex-1 truncate">{item.name}</span>
                <span className="font-mono text-[10px] text-white/30 shrink-0">
                  {(item.weight_g/1000).toFixed(1)}kg
                </span>
                <span className="font-mono text-[10px] text-[#00ff88]/50 shrink-0">
                  ₹{item.value.toLocaleString('en-IN')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Left-out items */}
      {result.left_out.length > 0 && (
        <div className="glass-card p-3 border-white/[0.04]">
          <p className="font-display text-[10px] tracking-widest text-white/25 mb-2 flex items-center gap-2">
            <XCircle size={10} /> LEFT OUT ({result.left_out.length})
          </p>
          <div className="flex flex-col gap-1.5">
            {result.left_out.map(item => (
              <div key={item.product_id}
                   className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.04] opacity-50">
                <div className="w-1.5 h-1.5 rounded-full bg-white/20 shrink-0" />
                <span className="font-mono text-[10px] text-white/40 shrink-0 w-16">{item.sku}</span>
                <span className="font-body text-xs text-white/40 flex-1 truncate">{item.name}</span>
                <span className="font-mono text-[10px] text-white/25 shrink-0">
                  {(item.weight_g/1000).toFixed(1)}kg
                </span>
                <span className="font-mono text-[10px] text-white/30 shrink-0">
                  ₹{item.value.toLocaleString('en-IN')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* DP complexity callout */}
      <div className="glass-card p-3 border-[#b347ff]/10">
        <p className="font-mono text-[10px] text-white/30 leading-relaxed">
          <span className="text-[#b347ff]/70">0/1 Knapsack DP</span>
          {' '}computed {result.n_items} items × {result.capacity_g}g capacity
          {' '}= <span className="text-[#00f5ff]/60">{result.dp_ops.toLocaleString()} operations</span>
          {' '}in O(n×W). Result is globally optimal — no greedy approximation.
        </p>
      </div>
    </div>
  )
}

// ── Main SmartPacker component ─────────────────────────────────────────────

export default function SmartPacker() {
  const { products, loading: prodLoading } = useProducts()

  const [selected,    setSelected]    = useState(new Set())
  const [capacityKg,  setCapacityKg]  = useState(10)
  const [result,      setResult]      = useState(null)
  const [running,     setRunning]     = useState(false)
  const [error,       setError]       = useState(null)

  const toggleProduct = (id) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
    setResult(null) // clear result when selection changes
  }

  const selectAll  = () => { setSelected(new Set(products.map(p => p.id))); setResult(null) }
  const clearAll   = () => { setSelected(new Set()); setResult(null) }

  const totalSelectedWeight = useMemo(() => {
    let g = 0
    products.forEach(p => { if (selected.has(p.id)) g += deriveWeightG(p.price) })
    return g / 1000
  }, [selected, products])

  const handleOptimize = async () => {
    if (selected.size === 0) { setError('Select at least one product.'); return }
    setRunning(true); setError(null)
    try {
      const data = await optimizePack([...selected], capacityKg)
      setResult(data)
    } catch (err) { setError(err.message) }
    finally { setRunning(false) }
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
      <div className="flex flex-col gap-4 p-4 pb-10">

        {/* Phase banner */}
        <motion.div initial={{opacity:0,y:-6}} animate={{opacity:1,y:0}}
          className="glass-card p-4 border-[#b347ff]/10">
          <p className="font-display text-[10px] tracking-[0.2em] text-[#b347ff]/60">
            PHASE 4 · SMART PACKER
          </p>
          <p className="font-body text-sm text-white/40 mt-1">
            <span className="text-[#b347ff]/70">0/1 Knapsack</span> Dynamic Programming (O(n×W)) finds
            the globally optimal item selection — maximising value within the weight constraint.
          </p>
        </motion.div>

        {/* Capacity control */}
        <div className="glass-card p-4 border-white/[0.06]">
          <div className="flex items-center gap-3 mb-3">
            <Scale size={13} className="text-[#b347ff]" />
            <span className="font-display text-[10px] tracking-widest text-white/50">
              BOX CAPACITY
            </span>
            <span className="ml-auto font-mono text-lg font-bold text-[#b347ff]">
              {capacityKg} kg
            </span>
          </div>
          <input
            type="range" min="1" max="50" step="0.5"
            value={capacityKg}
            onChange={e => { setCapacityKg(parseFloat(e.target.value)); setResult(null) }}
            className="w-full accent-[#b347ff]"
          />
          <div className="flex justify-between font-mono text-[9px] text-white/20 mt-1">
            <span>1 kg</span>
            <span>25 kg</span>
            <span>50 kg</span>
          </div>
        </div>

        {/* Main two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">

          {/* Product selector */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package size={13} className="text-[#00f5ff]" />
                <span className="font-display text-[10px] tracking-widest text-white/50">
                  SELECT ITEMS
                </span>
                <span className="font-mono text-[10px] text-white/20">
                  {selected.size}/{products.length}
                </span>
              </div>
              <div className="flex gap-2">
                <button onClick={selectAll}
                  className="font-mono text-[9px] text-white/30 hover:text-white/60 transition-colors">
                  all
                </button>
                <span className="text-white/15">·</span>
                <button onClick={clearAll}
                  className="font-mono text-[9px] text-white/30 hover:text-white/60 transition-colors">
                  none
                </button>
              </div>
            </div>

            <div className="glass-card p-2 flex flex-col gap-1.5 max-h-[480px] overflow-y-auto">
              {prodLoading ? (
                <div className="flex flex-col gap-1.5 p-2">
                  {[...Array(5)].map((_,i) => (
                    <div key={i} className="skeleton h-12 rounded-lg" />
                  ))}
                </div>
              ) : products.length === 0 ? (
                <p className="font-mono text-[10px] text-white/20 text-center py-8">
                  No products. Add some via the Dashboard first.
                </p>
              ) : (
                products.map(p => (
                  <ProductRow key={p.id} product={p}
                              checked={selected.has(p.id)}
                              onToggle={toggleProduct} />
                ))
              )}
            </div>

            {/* Selected weight summary */}
            {selected.size > 0 && (
              <div className="glass-card px-3 py-2 border-white/[0.05] flex items-center justify-between">
                <span className="font-mono text-[10px] text-white/30">
                  {selected.size} item{selected.size !== 1 ? 's' : ''} selected
                </span>
                <span className={`font-mono text-[10px] ${
                  totalSelectedWeight > capacityKg ? 'text-amber-400' : 'text-[#00ff88]/70'}`}>
                  ~{totalSelectedWeight.toFixed(1)} kg raw
                </span>
              </div>
            )}

            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.p initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
                  className="font-mono text-[10px] text-red-400 bg-red-500/10 border border-red-500/20
                             rounded px-3 py-2">
                  {error}
                </motion.p>
              )}
            </AnimatePresence>

            {/* Run button */}
            <motion.button
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
              onClick={handleOptimize}
              disabled={running || selected.size === 0}
              className={`btn-neon flex items-center justify-center gap-2 w-full py-2.5
                          ${selected.size === 0 ? 'opacity-40 cursor-not-allowed' : ''}`}
              style={{ borderColor: '#b347ff33', color: '#b347ff',
                       background: 'rgba(179,71,255,0.06)' }}
            >
              {running
                ? <><Loader2 size={13} className="animate-spin" /> Running DP…</>
                : <><Zap size={13} /> Optimize Packing</>}
            </motion.button>
          </div>

          {/* Box visualiser */}
          <BoxVisualiser result={result} capacityKg={capacityKg} />
        </div>

      </div>
    </div>
  )
}
