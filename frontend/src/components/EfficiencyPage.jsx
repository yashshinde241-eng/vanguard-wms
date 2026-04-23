/**
 * EfficiencyPage.jsx — Phase 5
 *
 * Two-tab page: Huffman Compressor | Multi-Pick Route (TSP)
 */

import { useState }    from 'react'
import { motion }      from 'framer-motion'
import { Zap, Route }  from 'lucide-react'
import HuffmanVisualizer from './HuffmanVisualizer'
import MultiPickMap      from './MultiPickMap'

const TABS = [
  { id: 'huffman', label: 'Huffman Compressor', icon: Zap   },
  { id: 'tsp',     label: 'Multi-Pick Route',   icon: Route },
]

export default function EfficiencyPage() {
  const [tab, setTab] = useState('huffman')

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Tab bar */}
      <div className="shrink-0 flex items-center gap-1 px-4 pt-4 border-b border-white/[0.05]">
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
                            ? 'border-[#00f5ff] text-[#00f5ff] bg-[#00f5ff]/5'
                            : 'border-transparent text-white/30 hover:text-white/60'
                          }`}
            >
              <Icon size={14} className={active ? 'text-[#00f5ff]' : ''} />
              {label}
            </motion.button>
          )
        })}
      </div>

      {/* Tab content — scroll inside */}
      <motion.div
        key={tab}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden"
      >
        <div className="flex flex-col gap-4 p-4 pb-10">

          {/* Phase banner */}
          <div className="glass-card p-4 border-[#00f5ff]/10">
            <p className="font-display text-[10px] tracking-[0.2em] text-[#00f5ff]/60">
              PHASE 5 · ADVANCED EFFICIENCY SUITE
            </p>
            <p className="font-body text-sm text-white/40 mt-1">
              {tab === 'huffman'
                ? <><span className="text-[#00f5ff]/70">Huffman Coding</span> compresses IoT scanner payloads — assigns shorter bit-codes to frequent characters (O(n log n)).</>
                : <><span className="text-[#ffb800]/70">TSP Solver</span> finds the optimal multi-stop picker route — <span className="text-[#b347ff]/70">Held-Karp DP</span> for n&lt;15 stops (exact), <span className="text-[#00ff88]/70">Nearest Neighbor</span> for larger lists (fast heuristic).</>
              }
            </p>
          </div>

          {tab === 'huffman' && <HuffmanVisualizer />}
          {tab === 'tsp'     && <MultiPickMap />}

        </div>
      </motion.div>
    </div>
  )
}
