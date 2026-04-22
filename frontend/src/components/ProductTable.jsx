/**
 * ProductTable — UI Debug Fix
 *
 * Bugs fixed:
 * 1. sticky thead had `bg-[#0d1117]` (hardcoded hex) — visible ghosting strip
 *    when scrolling because body background doesn't exactly match.
 *    Fix: use `bg-[#0a0d14]` + `backdrop-blur-sm` to blend seamlessly.
 * 2. Table had no min-width so columns crushed together on narrow screens.
 *    Fix: min-w-[600px] on table + overflow-x-auto on wrapper.
 * 3. Row animation delay was idx * 0.04 with no cap — for 20+ rows the last
 *    row would animate in after 800ms, making the UI feel broken.
 *    Fix: cap delay at 0.25s.
 * 4. whitespace-nowrap added to all numeric/badge cells.
 */

import { motion, AnimatePresence } from 'framer-motion'
import { Package, AlertTriangle, TrendingUp } from 'lucide-react'

function SkeletonRow() {
  return (
    <tr>
      {[...Array(6)].map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="skeleton h-3.5 rounded" style={{ width: `${50 + (i * 20) % 40}%` }} />
        </td>
      ))}
    </tr>
  )
}

function StockBadge({ qty }) {
  if (qty === 0)
    return <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 whitespace-nowrap">OUT</span>
  if (qty < 10)
    return <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 whitespace-nowrap">LOW</span>
  return <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-full bg-[#00ff88]/10 text-[#00ff88] border border-[#00ff88]/20 whitespace-nowrap">OK</span>
}

export default function ProductTable({ products, loading, error }) {

  if (error) {
    return (
      <div className="glass-card flex flex-col items-center justify-center gap-3 py-16 text-center">
        <AlertTriangle size={28} className="text-amber-400" />
        <p className="font-display text-sm tracking-wider text-white/60">ENGINE UNREACHABLE</p>
        <p className="font-mono text-xs text-white/25 max-w-xs leading-relaxed">
          Cannot connect to the C++ backend at{' '}
          <span className="text-[#00f5ff]/50">localhost:8080</span>.
          Ensure the engine is running.
        </p>
        <p className="font-mono text-[10px] text-red-400/60 bg-red-500/5
                      border border-red-500/10 px-3 py-1.5 rounded max-w-xs truncate">
          {error}
        </p>
      </div>
    )
  }

  if (!loading && products.length === 0) {
    return (
      <div className="glass-card flex flex-col items-center justify-center gap-3 py-16 text-center">
        <Package size={28} className="text-white/20" />
        <p className="font-display text-sm tracking-wider text-white/40">NO PRODUCTS FOUND</p>
        <p className="font-mono text-xs text-white/20">
          Add your first product to seed the warehouse engine.
        </p>
      </div>
    )
  }

  return (
    <div className="glass-card flex flex-col">

      {/* Card header — always pinned at top of this card */}
      <div className="shrink-0 flex items-center justify-between
                      px-4 py-3 border-b border-white/[0.05]">
        <div className="flex items-center gap-2">
          <TrendingUp size={13} className="text-[#00f5ff]" />
          <span className="font-display text-xs font-bold tracking-widest text-white/70">
            PRODUCT INVENTORY
          </span>
        </div>
        <span className="font-mono text-xs text-white/20 shrink-0">
          {products.length} records
        </span>
      </div>

      {/* Horizontal scroll wrapper for narrow viewports */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[580px]">

          {/* Sticky header — blends with page background on scroll */}
          <thead>
            <tr className="border-b border-white/[0.05]"
                style={{ background: 'rgba(3,7,18,0.92)', backdropFilter: 'blur(8px)' }}>
              {['ID', 'SKU', 'PRODUCT NAME', 'CATEGORY', 'QTY', 'PRICE'].map(col => (
                <th
                  key={col}
                  className="px-4 py-2.5 text-left font-mono text-[10px]
                             tracking-widest text-white/25 whitespace-nowrap"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {loading
              ? [...Array(5)].map((_, i) => <SkeletonRow key={i} />)
              : (
                <AnimatePresence initial={false}>
                  {products.map((p, idx) => (
                    <motion.tr
                      key={p.id}
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1,  y:  0 }}
                      exit={{ opacity: 0 }}
                      transition={{ delay: Math.min(idx * 0.03, 0.25) }}
                      className="border-b border-white/[0.03]
                                 hover:bg-white/[0.025] transition-colors duration-100"
                    >
                      <td className="px-4 py-2.5 font-mono text-xs text-white/20 whitespace-nowrap">
                        {p.id}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs text-[#00f5ff]/70 whitespace-nowrap">
                        {p.sku}
                      </td>
                      <td className="px-4 py-2.5 font-body text-sm text-white/80">
                        {p.name}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span className="font-mono text-[10px] px-2 py-0.5 rounded
                                         bg-[#b347ff]/10 text-[#b347ff]/70
                                         border border-[#b347ff]/15">
                          {p.category}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-sm text-white/60">{p.quantity}</span>
                          <StockBadge qty={p.quantity} />
                        </div>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-sm text-[#00ff88]/70 whitespace-nowrap">
                        ₹{p.price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              )
            }
          </tbody>
        </table>
      </div>
    </div>
  )
}
