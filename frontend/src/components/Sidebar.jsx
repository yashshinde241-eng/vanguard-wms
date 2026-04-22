/**
 * Sidebar.jsx — Phase 4
 * Adds "Dispatch" nav item pointing to the new dispatch page.
 */

import { motion } from 'framer-motion'
import {
  LayoutDashboard, Package, GitBranch,
  Navigation, Truck, Settings, Cpu
} from 'lucide-react'

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Dashboard',   page: 'dashboard', phase: 1 },
  { icon: Package,         label: 'Products',    page: 'dashboard', phase: 1 },
  { icon: GitBranch,       label: 'AVL Trees',   page: 'dashboard', phase: 2 },
  { icon: Navigation,      label: 'Pathfinding', page: 'logistics', phase: 3 },
  { icon: Truck,           label: 'Dispatch',    page: 'dispatch',  phase: 4 },
  { icon: Settings,        label: 'Settings',    page: 'dashboard', phase: 1 },
]

export default function Sidebar({ currentPage = 'dashboard', onNavigate }) {
  return (
    <aside className="hidden lg:flex flex-col w-64 h-full glass-card
                      border-r border-white/[0.06] rounded-none p-5 shrink-0">
      <div className="flex items-center gap-3 mb-10">
        <div className="w-9 h-9 rounded-lg bg-[#00f5ff]/10 border border-[#00f5ff]/30
                        flex items-center justify-center shadow-neon-cyan">
          <Cpu size={18} className="text-[#00f5ff]" />
        </div>
        <div>
          <p className="font-display text-sm font-bold text-white tracking-widest">VANGUARD</p>
          <p className="font-mono text-[10px] text-white/30 tracking-widest">WMS ENGINE</p>
        </div>
      </div>

      <nav className="flex flex-col gap-1 flex-1">
        <p className="font-mono text-[10px] text-white/20 tracking-widest mb-3 px-3">NAVIGATION</p>
        {NAV_ITEMS.map(({ icon: Icon, label, page, phase }) => {
          const isActive = page === currentPage
          return (
            <motion.button
              key={label}
              whileHover={{ x: 4 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => onNavigate?.(page)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg w-full text-left
                          transition-all duration-150
                          ${isActive
                            ? 'bg-[#00f5ff]/10 border border-[#00f5ff]/20 text-[#00f5ff]'
                            : 'text-white/40 hover:text-white/70 hover:bg-white/[0.03]'
                          }`}
            >
              <Icon size={16} className={isActive ? 'text-[#00f5ff]' : ''} />
              <span className="font-body text-sm font-medium">{label}</span>
              {phase === 4 && !isActive && (
                <span className="ml-auto font-mono text-[9px] text-[#ffb800]/40
                                 border border-[#ffb800]/15 rounded px-1.5 py-0.5">
                  NEW
                </span>
              )}
            </motion.button>
          )
        })}
      </nav>

      <div className="border-t border-white/[0.06] pt-4 mt-4">
        <p className="font-mono text-[10px] text-white/20">v4.0.0 · Phase 4</p>
        <p className="font-mono text-[10px] text-white/15">Lead: Yash Shinde</p>
      </div>
    </aside>
  )
}
