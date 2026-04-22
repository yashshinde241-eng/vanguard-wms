import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, X, Loader2, Zap, GitBranch } from 'lucide-react'
import { useSearch } from '../hooks/useApi'

/**
 * SearchBar — Phase 2
 *
 * • Sends debounced requests to GET /api/search?q=...
 * • The backend routes this through AVLTree::fulltext_search
 * • Shows a floating result dropdown with timing badge
 * • Calls onResults(products) so the parent can update the table
 * • Calls onClear() when the query is cleared
 */
export default function SearchBar({ onResults, onClear }) {
  const [query,    setQuery]    = useState('')
  const [focused,  setFocused]  = useState(false)

  const { results, loading, elapsedUs } = useSearch(query, 280)

  const handleChange = (e) => {
    const val = e.target.value
    setQuery(val)
    if (!val.trim()) {
      onClear?.()
    }
  }

  const handleSelect = (product) => {
    onResults([product])
    setQuery(product.name)
    setFocused(false)
  }

  const handleClear = () => {
    setQuery('')
    onClear?.()
  }

  // Push full result set to parent as results come in
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && results.length > 0) {
      onResults(results)
      setFocused(false)
    }
    if (e.key === 'Escape') {
      setFocused(false)
    }
  }

  const showDropdown = focused && query.trim().length > 0

  return (
    <div className="relative w-full max-w-sm">
      {/* Input */}
      <div className={`
        relative flex items-center rounded-lg border transition-all duration-200
        ${focused
          ? 'border-[#00f5ff]/50 shadow-[0_0_0_3px_rgba(0,245,255,0.08)]'
          : 'border-white/10'
        }
        bg-white/[0.04] backdrop-blur-sm
      `}>
        {loading
          ? <Loader2 size={13} className="absolute left-3 text-[#00f5ff] animate-spin" />
          : <Search  size={13} className="absolute left-3 text-white/25" />
        }

        <input
          className="w-full bg-transparent pl-8 pr-8 py-2.5 text-sm font-body
                     text-white placeholder-white/25 outline-none"
          placeholder="Search SKU, name, category… (AVL)"
          value={query}
          onChange={handleChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          onKeyDown={handleKeyDown}
        />

        {query && (
          <button onClick={handleClear} className="absolute right-2.5 text-white/30 hover:text-white/60 transition-colors">
            <X size={13} />
          </button>
        )}
      </div>

      {/* DSA label */}
      {focused && (
        <div className="absolute -top-5 left-0 flex items-center gap-1">
          <GitBranch size={9} className="text-[#00f5ff]/40" />
          <span className="font-mono text-[9px] text-[#00f5ff]/40 tracking-widest">AVL TREE SEARCH</span>
        </div>
      )}

      {/* Dropdown results */}
      <AnimatePresence>
        {showDropdown && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0,  scale: 1    }}
            exit={{    opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.12 }}
            className="absolute top-full mt-1.5 w-full z-50
                       glass-card border-[#00f5ff]/10 overflow-hidden
                       max-h-64 overflow-y-auto"
          >
            {/* Header row */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.05]">
              <span className="font-mono text-[10px] text-white/25">
                {loading ? 'Searching…' : `${results.length} result${results.length !== 1 ? 's' : ''}`}
              </span>
              {elapsedUs !== null && (
                <span className="flex items-center gap-1 font-mono text-[10px] text-[#00ff88]/60">
                  <Zap size={9} />
                  {elapsedUs < 1000
                    ? `${elapsedUs}µs`
                    : `${(elapsedUs / 1000).toFixed(1)}ms`
                  }
                </span>
              )}
            </div>

            {/* Result rows */}
            {results.length === 0 && !loading && (
              <div className="px-3 py-4 text-center font-mono text-xs text-white/25">
                No matches found
              </div>
            )}

            {results.map((p) => (
              <button
                key={p.id}
                onMouseDown={() => handleSelect(p)}
                className="w-full flex items-center gap-3 px-3 py-2.5
                           hover:bg-white/[0.04] transition-colors text-left"
              >
                <span className="font-mono text-xs text-[#00f5ff]/60 w-20 shrink-0 truncate">
                  {p.sku}
                </span>
                <span className="font-body text-sm text-white/70 flex-1 truncate">
                  {p.name}
                </span>
                <span className="font-mono text-[10px] text-[#b347ff]/60 shrink-0">
                  {p.category}
                </span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
