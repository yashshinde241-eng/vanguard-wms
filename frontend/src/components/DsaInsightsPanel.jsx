/**
 * DsaInsightsPanel — UI Debug Fix
 *
 * Bugs fixed:
 * 1. `glass-card flex flex-col overflow-hidden` was clipping the bottom content
 *    because the card had no height constraint — overflow-hidden with no height
 *    means nothing visible below the first child. Fix: remove overflow-hidden.
 * 2. Inline `w-1.5 h-1.5` on status-dot was fighting the global `.status-dot`
 *    class (w-2 h-2). Fix: use canonical `.status-dot-sm` class instead.
 * 3. Tooltip `position:absolute` from inside a flex container causes z-index
 *    layering issues. Fix: added z-50 and ensured parent has position:relative.
 */

import { motion, AnimatePresence } from 'framer-motion'
import { GitBranch, Hash, Network, Activity, TrendingUp, Info } from 'lucide-react'
import { useDsaStats }              from '../hooks/useApi'
import { useState }                 from 'react'

function AnimNum({ value, decimals = 0 }) {
  if (value === null || value === undefined)
    return <span className="text-white/20">—</span>
  return (
    <motion.span
      key={value}
      initial={{ opacity: 0, y: -3 }}
      animate={{ opacity: 1,  y:  0 }}
      transition={{ duration: 0.2 }}
    >
      {typeof value === 'number' ? value.toFixed(decimals) : value}
    </motion.span>
  )
}

function MiniBar({ value, max, color = '#00f5ff' }) {
  const pct  = Math.min((value / max) * 100, 100)
  const warn = pct > 65
  return (
    <div className="h-1 w-full rounded-full bg-white/[0.06] overflow-hidden">
      <motion.div
        className="h-full rounded-full"
        style={{ backgroundColor: warn ? '#ffb800' : color }}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      />
    </div>
  )
}

function StatRow({ label, value, decimals, unit, bar, barMax, barColor, tooltip }) {
  const [showTip, setShowTip] = useState(false)

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[10px] text-white/30 tracking-wider">
            {label}
          </span>

          {tooltip && (
            /* position:relative here so the absolute tooltip is contained */
            <div className="relative" style={{ position: 'relative' }}>
              <Info
                size={9}
                className="text-white/15 cursor-help"
                onMouseEnter={() => setShowTip(true)}
                onMouseLeave={() => setShowTip(false)}
              />
              <AnimatePresence>
                {showTip && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.92 }}
                    animate={{ opacity: 1, scale: 1    }}
                    exit={{    opacity: 0, scale: 0.92 }}
                    className="absolute bottom-5 left-0 z-50 w-44
                               glass-card px-2.5 py-2 border-white/10
                               text-[10px] font-body text-white/50 leading-relaxed"
                    style={{ pointerEvents: 'none' }}
                  >
                    {tooltip}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        <span className="font-mono text-sm font-medium text-white/80">
          <AnimNum value={value} decimals={decimals} />
          {unit && (
            <span className="text-white/25 text-[10px] ml-0.5">{unit}</span>
          )}
        </span>
      </div>

      {bar !== undefined && barMax && (
        <MiniBar value={bar} max={barMax} color={barColor} />
      )}
    </div>
  )
}

function Section({ icon: Icon, title, badge, color, children }) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2">
        <Icon size={11} style={{ color }} />
        <span
          className="font-mono text-[10px] tracking-widest"
          style={{ color, opacity: 0.7 }}
        >
          {title}
        </span>
        <span className="ml-auto font-mono text-[9px] text-white/15
                         border border-white/10 px-1.5 py-0.5 rounded">
          {badge}
        </span>
      </div>
      <div className="flex flex-col gap-2 pl-1">
        {children}
      </div>
    </div>
  )
}

export default function DsaInsightsPanel() {
  const { stats, loading } = useDsaStats()

  const avl  = stats?.avl
  const ht   = stats?.hash_table
  const lcrs = stats?.lcrs

  const avlEfficiency = avl && avl.theoretical_min_height > 0
    ? Math.round((avl.theoretical_min_height / avl.height) * 100)
    : null

  return (
    /* Natural height — left panel's overflow-y-auto handles scroll.
       No overflow-hidden here: it was clipping the panel's bottom content. */
    <div className="glass-card flex flex-col border-[#b347ff]/10">

      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-white/[0.05]">
        <Activity size={12} className="text-[#b347ff] shrink-0" />
        <span className="font-display text-[10px] font-bold tracking-widest text-white/50">
          DSA INSIGHTS
        </span>
        <span className="ml-auto flex items-center gap-1.5 shrink-0">
          {/* Uses .status-dot-sm instead of inline w-1.5 h-1.5 */}
          <span className={`status-dot-sm ${loading
            ? 'bg-amber-400 animate-pulse'
            : 'bg-[#00ff88] shadow-[0_0_4px_#00ff88]'}`}
          />
          <span className="font-mono text-[9px] text-white/20">LIVE · 5s</span>
        </span>
      </div>

      {/* Body */}
      <div className="flex flex-col gap-4 p-3">

        <Section icon={GitBranch} title="AVL TREE" badge="O(log n)" color="#00f5ff">
          <StatRow
            label="HEIGHT"   value={avl?.height}
            tooltip="Actual tree height. Stays ≈ log₂(n) due to rotations."
          />
          <StatRow
            label="MIN POSSIBLE" value={avl?.theoretical_min_height} decimals={0}
            tooltip="⌊log₂(n+1)⌋ — theoretical minimum for n nodes."
          />
          {avlEfficiency !== null && (
            <StatRow
              label="BALANCE RATIO" value={avlEfficiency} unit="%"
              bar={avlEfficiency} barMax={100} barColor="#00f5ff"
              tooltip="Min height / actual height × 100. 100% = perfect tree."
            />
          )}
          <StatRow label="NODES" value={avl?.size} />
        </Section>

        <div className="border-t border-white/[0.04]" />

        <Section icon={Hash} title="HASH TABLE" badge="O(1)" color="#00ff88">
          <StatRow
            label="LOAD FACTOR" value={ht?.load_factor} decimals={2}
            bar={ht?.load_factor} barMax={1} barColor="#00ff88"
            tooltip="Items / capacity. Rehash at 0.65 keeps O(1) lookup."
          />
          <StatRow label="CAPACITY"   value={ht?.capacity} />
          <StatRow
            label="COLLISIONS"  value={ht?.collisions}
            tooltip="Linear-probe collisions since last reset. Low = good."
          />
        </Section>

        <div className="border-t border-white/[0.04]" />

        <Section icon={Network} title="LCRS TREE" badge="n-ary" color="#b347ff">
          <StatRow
            label="CATEGORY NODES" value={lcrs?.node_count}
            tooltip="Nodes in the Left-Child Right-Sibling category tree."
          />
        </Section>

        {/* Verdict banner */}
        {avlEfficiency !== null && (
          <div className={`
            flex items-start gap-2 rounded-lg px-3 py-2 border text-[10px]
            ${avlEfficiency >= 80
              ? 'bg-[#00ff88]/5 border-[#00ff88]/15 text-[#00ff88]/70'
              : avlEfficiency >= 60
              ? 'bg-amber-500/5 border-amber-500/15 text-amber-400/70'
              : 'bg-red-500/5 border-red-500/15 text-red-400/70'
            }
          `}>
            <TrendingUp size={10} className="mt-0.5 shrink-0" />
            <p className="font-mono leading-relaxed">
              {avlEfficiency >= 80
                ? 'AVL tree is well-balanced. Rotations are working correctly.'
                : avlEfficiency >= 60
                ? 'Slightly unbalanced. Normal for small datasets.'
                : 'Low balance. Add more products to trigger AVL rotations.'
              }
            </p>
          </div>
        )}

      </div>
    </div>
  )
}
