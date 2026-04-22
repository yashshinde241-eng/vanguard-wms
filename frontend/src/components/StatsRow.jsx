/**
 * StatsRow — UI Debug Fix
 *
 * Bugs fixed:
 * 1. 4th card (purple glow) was bleeding off-screen right edge —
 *    shadow-neon-purple emits a 60px spread outside the card boundary
 *    and the parent had no overflow:hidden. Fixed by wrapping in
 *    overflow-hidden and reducing shadow spread.
 * 2. Cards were p-5 (20px) — on narrow screens with 4 columns this
 *    left no room for text. Reduced to p-4.
 * 3. Value text was text-2xl — overflowed card on narrow screens.
 *    Now scales with clamp.
 */

import { motion } from 'framer-motion'
import { Package, DollarSign, AlertTriangle, Layers } from 'lucide-react'

function StatCard({ icon: Icon, label, value, sub, color, delay = 0 }) {
  const palette = {
    cyan:   {
      ring: 'border-[#00f5ff]/20',
      shadow: 'shadow-[0_0_16px_rgba(0,245,255,0.12)]',
      icon: 'text-[#00f5ff]',
      bg:   'bg-[#00f5ff]/5',
    },
    purple: {
      ring: 'border-[#b347ff]/20',
      shadow: 'shadow-[0_0_16px_rgba(179,71,255,0.12)]',
      icon: 'text-[#b347ff]',
      bg:   'bg-[#b347ff]/5',
    },
    green:  {
      ring: 'border-[#00ff88]/20',
      shadow: '',
      icon: 'text-[#00ff88]',
      bg:   'bg-[#00ff88]/5',
    },
    amber:  {
      ring: 'border-amber-500/20',
      shadow: '',
      icon: 'text-amber-400',
      bg:   'bg-amber-500/5',
    },
  }
  const c = palette[color]

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0  }}
      transition={{ delay, duration: 0.35, ease: 'easeOut' }}
      /* overflow-hidden clips the box-shadow from bleeding outside parent */
      className={`glass-card ${c.ring} ${c.shadow} p-4 flex flex-col gap-3 min-w-0`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className={`w-8 h-8 rounded-lg ${c.bg} border ${c.ring}
                         flex items-center justify-center shrink-0`}>
          <Icon size={15} className={c.icon} />
        </div>
        <span className="font-mono text-[9px] text-white/20 tracking-widest
                         text-right leading-tight mt-0.5">
          {label}
        </span>
      </div>

      <div className="min-w-0">
        {/* clamp keeps the number readable even on very narrow cards */}
        <p className="font-display font-bold text-white tracking-wide truncate"
           style={{ fontSize: 'clamp(1.1rem, 2.5vw, 1.5rem)' }}>
          {value}
        </p>
        {sub && (
          <p className="font-mono text-[10px] text-white/30 mt-0.5 truncate">{sub}</p>
        )}
      </div>
    </motion.div>
  )
}

export default function StatsRow({ products }) {
  const totalProducts = products.length
  const totalValue    = products.reduce((s, p) => s + p.price * p.quantity, 0)
  const lowStock      = products.filter(p => p.quantity < 10).length
  const categories    = new Set(products.map(p => p.category)).size

  return (
    /* overflow-hidden: prevents box-shadows on edge cards from spilling outside */
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 overflow-hidden">
      <StatCard
        icon={Package}       label="TOTAL SKUs"
        value={totalProducts} sub="unique products"
        color="cyan"          delay={0}
      />
      <StatCard
        icon={DollarSign}    label="INVENTORY VALUE"
        value={`₹${(totalValue / 1000).toFixed(1)}k`}
        sub="price × quantity"
        color="green"         delay={0.05}
      />
      <StatCard
        icon={AlertTriangle} label="LOW STOCK"
        value={lowStock}      sub="below 10 units"
        color="amber"         delay={0.1}
      />
      <StatCard
        icon={Layers}        label="CATEGORIES"
        value={categories}    sub="distinct groups"
        color="purple"        delay={0.15}
      />
    </div>
  )
}
