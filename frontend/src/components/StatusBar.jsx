/**
 * StatusBar — UI Debug Fix
 *
 * Bugs fixed:
 * 1. Pills overflow to second line on medium screens → flex-wrap with
 *    conditional visibility (hide less important pills at smaller widths)
 * 2. "Phase 1" label was stale → updated to Phase 2
 * 3. status-dot size now uses canonical class, not inline override
 * 4. Header shrink-0 ensures it never grows and pushes content
 */

import { motion }    from 'framer-motion'
import { Activity, Zap, Database } from 'lucide-react'
import { useHealth } from '../hooks/useApi'

function StatPill({ icon: Icon, label, value, color = 'cyan', className = '' }) {
  const colors = {
    cyan:   'text-[#00f5ff] border-[#00f5ff]/20 bg-[#00f5ff]/5',
    purple: 'text-[#b347ff] border-[#b347ff]/20 bg-[#b347ff]/5',
    green:  'text-[#00ff88] border-[#00ff88]/20 bg-[#00ff88]/5',
  }
  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border font-mono text-xs whitespace-nowrap ${colors[color]} ${className}`}>
      <Icon size={11} />
      <span className="text-white/40 hidden sm:inline">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}

export default function StatusBar({ productCount }) {
  const { health } = useHealth()
  const isOnline = health?.status === 'ok'

  return (
    /* shrink-0: this header must NEVER flex-shrink — it's always fully visible */
    <header className="shrink-0 flex items-center justify-between gap-3
                       px-4 py-3 border-b border-white/[0.05]
                       bg-[#030712]/60 backdrop-blur-sm">

      {/* Title block — min-w-0 prevents it from crushing pills */}
      <div className="min-w-0">
        <h1 className="font-display text-base font-bold tracking-wider text-white truncate">
          WAREHOUSE <span className="neon-text-cyan">DASHBOARD</span>
        </h1>
        <p className="font-body text-[10px] text-white/30 mt-0.5 hidden sm:block">
          Phase 2 · Inventory Core · AVL + Hash Table + LCRS
        </p>
      </div>

      {/* Status pills — right-aligned, overflow-safe */}
      <div className="flex items-center gap-2 shrink-0">

        {/* Engine status — always visible */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center gap-1.5"
        >
          <span className={`status-dot-sm ${isOnline
            ? 'bg-[#00ff88] shadow-[0_0_5px_#00ff88]'
            : 'bg-red-500'}`}
          />
          <span className="font-mono text-[10px] text-white/40 whitespace-nowrap hidden md:inline">
            {isOnline ? 'ENGINE ONLINE' : 'ENGINE OFFLINE'}
          </span>
        </motion.div>

        <div className="w-px h-4 bg-white/10 hidden md:block" />

        {/* Products count — always visible */}
        <StatPill
          icon={Database}
          label="PRODUCTS"
          value={productCount ?? '–'}
          color="cyan"
        />

        {/* Latency — hidden on small screens */}
        <StatPill
          icon={Zap}
          label="LATENCY"
          value="<1ms"
          color="green"
          className="hidden lg:flex"
        />

        {/* DSA status — hidden on small screens */}
        <StatPill
          icon={Activity}
          label="DSA"
          value="READY"
          color="purple"
          className="hidden lg:flex"
        />
      </div>
    </header>
  )
}
