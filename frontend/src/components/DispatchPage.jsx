/**
 * DispatchPage.jsx — Phase 4
 * Top-level page with tab navigation: Dispatch Queue | Smart Packer
 */

import { useState }   from 'react'
import { motion }     from 'framer-motion'
import { ArrowUpCircle, Box } from 'lucide-react'
import DispatchDashboard from './DispatchDashboard'
import SmartPacker       from './SmartPacker'

const TABS = [
  { id: 'dispatch', label: 'Dispatch Queue', icon: ArrowUpCircle },
  { id: 'packer',   label: 'Smart Packer',   icon: Box },
]

export default function DispatchPage() {
  const [tab, setTab] = useState('dispatch')

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Tab bar */}
      <div className="shrink-0 flex items-center gap-1 px-4 pt-4 pb-0 border-b border-white/[0.05]">
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = tab === id
          return (
            <motion.button
              key={id}
              whileTap={{ scale: 0.97 }}
              onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg font-body text-sm
                          border-b-2 transition-all duration-150
                          ${active
                            ? 'border-[#ffb800] text-[#ffb800] bg-[#ffb800]/5'
                            : 'border-transparent text-white/30 hover:text-white/60'
                          }`}
            >
              <Icon size={14} className={active ? 'text-[#ffb800]' : ''} />
              {label}
            </motion.button>
          )
        })}
      </div>

      {/* Tab content */}
      <motion.div
        key={tab}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="flex-1 min-h-0 overflow-hidden flex flex-col"
      >
        {tab === 'dispatch' && <DispatchDashboard />}
        {tab === 'packer'   && <SmartPacker />}
      </motion.div>
    </div>
  )
}
