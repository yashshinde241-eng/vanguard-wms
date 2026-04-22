/**
 * CategorySidebar — UI Debug Fix
 *
 * Bugs fixed:
 * 1. `glass-card flex flex-col overflow-hidden` with `flex-1 overflow-y-auto`
 *    inside collapses to height:0 when the parent is also flex.
 *    Fix: remove the outer overflow-hidden; the left panel handles clipping.
 *    The card now has natural height (grows to fit its content).
 * 2. Tree body was flex-1 inside overflow-hidden → invisible content.
 *    Fix: tree body is now just `py-1.5` with no flex sizing.
 */

import { useState }              from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronRight, Folder, FolderOpen, Tag, Network } from 'lucide-react'
import { useCategories }          from '../hooks/useApi'

function CategoryNode({ node, depth = 0, onSelect, selected }) {
  const [open, setOpen]  = useState(depth === 0)
  const hasChildren      = node.children && node.children.length > 0
  const isSelected       = selected === node.name
  const indent           = depth * 12

  return (
    <div>
      <motion.button
        whileTap={{ scale: 0.98 }}
        onClick={() => {
          if (hasChildren) setOpen(o => !o)
          onSelect?.(node.name)
        }}
        className={`
          w-full flex items-center gap-2 py-1.5 pr-3 rounded-lg
          text-left transition-colors duration-100
          ${isSelected
            ? 'bg-[#00f5ff]/10 text-[#00f5ff]'
            : 'text-white/40 hover:text-white/70 hover:bg-white/[0.03]'
          }
        `}
        style={{ paddingLeft: `${8 + indent}px` }}
      >
        {hasChildren ? (
          <motion.span
            animate={{ rotate: open ? 90 : 0 }}
            transition={{ duration: 0.15 }}
            className="shrink-0"
          >
            <ChevronRight size={12} className={isSelected ? 'text-[#00f5ff]' : 'text-white/20'} />
          </motion.span>
        ) : (
          <span className="w-3 shrink-0" />
        )}

        {hasChildren
          ? open
            ? <FolderOpen size={13} className="shrink-0" />
            : <Folder     size={13} className="shrink-0" />
          : <Tag size={11} className="shrink-0 ml-0.5" />
        }

        <span className="font-body text-xs font-medium truncate flex-1">
          {node.name}
        </span>

        {node.count > 0 && (
          <span className={`
            font-mono text-[9px] px-1.5 py-0.5 rounded-full shrink-0
            ${isSelected
              ? 'bg-[#00f5ff]/20 text-[#00f5ff]'
              : 'bg-white/[0.06] text-white/25'
            }
          `}>
            {node.count}
          </span>
        )}
      </motion.button>

      <AnimatePresence initial={false}>
        {open && hasChildren && (
          <motion.div
            key="children"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{    height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            {node.children.map((child) => (
              <CategoryNode
                key={child.name}
                node={child}
                depth={depth + 1}
                onSelect={onSelect}
                selected={selected}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function CategorySkeleton() {
  return (
    <div className="flex flex-col gap-2 p-3">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="flex items-center gap-2"
             style={{ paddingLeft: `${(i % 3) * 12}px` }}>
          <div className="skeleton w-3 h-3 rounded" />
          <div className="skeleton h-3 rounded"
               style={{ width: `${55 + (i * 17) % 45}%` }} />
        </div>
      ))}
    </div>
  )
}

export default function CategorySidebar({ onCategorySelect }) {
  const { categories, loading } = useCategories()
  const [selected, setSelected] = useState(null)

  const handleSelect = (name) => {
    const next = selected === name ? null : name
    setSelected(next)
    onCategorySelect?.(next)
  }

  return (
    /* Natural height card — left panel's overflow-y-auto handles scroll */
    <div className="glass-card flex flex-col">

      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-white/[0.05]">
        <Network size={12} className="text-[#b347ff] shrink-0" />
        <span className="font-display text-[10px] font-bold tracking-widest text-white/50">
          CATEGORY TREE
        </span>
        <span className="ml-auto font-mono text-[9px] text-[#b347ff]/40
                         border border-[#b347ff]/15 px-1.5 py-0.5 rounded shrink-0">
          LCRS
        </span>
      </div>

      {/* Tree body — natural height, no flex-1 */}
      <div className="py-1.5">
        {loading ? (
          <CategorySkeleton />
        ) : categories.length === 0 ? (
          <p className="font-mono text-[10px] text-white/20 text-center py-5 px-3">
            No categories yet.
            <br />Add a product to build the tree.
          </p>
        ) : (
          <div className="px-1">
            {categories.map((node) => (
              <CategoryNode
                key={node.name}
                node={node}
                depth={0}
                onSelect={handleSelect}
                selected={selected}
              />
            ))}
          </div>
        )}
      </div>

      {/* Filter hint footer */}
      {selected && (
        <div className="border-t border-white/[0.05] px-3 py-2">
          <p className="font-mono text-[9px] text-white/25 leading-relaxed">
            Filtering{' '}
            <span className="text-[#00f5ff]/50">{selected}</span>
            {' '}— click again to clear
          </p>
        </div>
      )}
    </div>
  )
}
