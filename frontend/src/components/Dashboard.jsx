/**
 * Dashboard.jsx — UI Debug Fix
 *
 * Bugs fixed:
 * 1. Left panel had no independent scroll → now overflow-y-auto with h-full
 * 2. Main column was missing min-h-0 → added, enables inner scroll
 * 3. Toolbar was flex-wrap → converted to overflow-safe single row
 * 4. Scroll region was missing min-h-0 → fixed, content actually scrolls now
 * 5. Left panel mobile drawer z-index was fighting phase banner → fixed layering
 *
 * Scroll architecture (must form an unbroken chain):
 *
 *   Dashboard root: h-full flex overflow-hidden
 *    │
 *    ├─ Left panel: h-full overflow-y-auto shrink-0  ← scrolls independently
 *    │
 *    └─ Main column: flex-col flex-1 min-w-0 min-h-0 h-full overflow-hidden
 *         │
 *         ├─ Toolbar: shrink-0  ← always visible, never scrolls
 *         │
 *         └─ Scroll region: flex-1 min-h-0 overflow-y-auto  ← THE scroll zone
 *              └─ Content div: pb-10 for bottom breathing room
 */

import { useState }     from 'react'
import { motion }       from 'framer-motion'
import { Plus, RefreshCw, SlidersHorizontal } from 'lucide-react'
import { useProducts }  from '../hooks/useApi'
import ProductTable     from './ProductTable'
import StatsRow         from './StatsRow'
import AddProductModal  from './AddProductModal'
import SearchBar        from './SearchBar'
import CategorySidebar  from './CategorySidebar'
import DsaInsightsPanel from './DsaInsightsPanel'

export default function Dashboard() {
  const { products, loading, error, refetch } = useProducts()

  const [modalOpen,      setModalOpen]      = useState(false)
  const [filteredList,   setFilteredList]   = useState(null)
  const [categoryFilter, setCategoryFilter] = useState(null)
  const [refreshing,     setRefreshing]     = useState(false)
  const [leftPanelOpen,  setLeftPanelOpen]  = useState(false)

  const handleRefresh = async () => {
    setRefreshing(true)
    await refetch()
    setFilteredList(null)
    setCategoryFilter(null)
    setTimeout(() => setRefreshing(false), 600)
  }

  const handleCreated       = () => { refetch(); setFilteredList(null) }
  const handleSearchResults = (r)   => setFilteredList(r)
  const handleSearchClear   = ()    => setFilteredList(null)
  const handleCategorySelect = (cat) => {
    setCategoryFilter(cat)
    setFilteredList(null)
    setLeftPanelOpen(false)
  }

  let displayProducts = products
  if (filteredList !== null)  displayProducts = filteredList
  else if (categoryFilter)    displayProducts = products.filter(p =>
    p.category.toLowerCase().includes(categoryFilter.toLowerCase()))

  return (
    /* Root: fills <main> exactly — h-full, no own padding/margin */
    <div className="flex h-full overflow-hidden">

      {/* ── Mobile backdrop ──────────────────────────────────────────── */}
      {leftPanelOpen && (
        <div
          className="xl:hidden fixed inset-0 z-30 bg-black/60 backdrop-blur-sm"
          onClick={() => setLeftPanelOpen(false)}
        />
      )}

      {/* ══════════════════════════════════════════════════════════════
          LEFT PANEL
          h-full + overflow-y-auto = fills viewport height, scrolls independently
          shrink-0 = never compressed by main column
      ══════════════════════════════════════════════════════════════ */}
      <div className={`
        h-full overflow-y-auto shrink-0
        flex flex-col gap-3 p-3
        border-r border-white/[0.05] bg-[#030712]/95
        w-64
        xl:relative xl:translate-x-0
        fixed inset-y-0 left-0 z-40
        transition-transform duration-300 ease-in-out
        ${leftPanelOpen ? 'translate-x-0' : '-translate-x-full xl:translate-x-0'}
      `}>
        {/* Mobile close */}
        <div className="xl:hidden flex justify-end pt-1 pb-1">
          <button
            onClick={() => setLeftPanelOpen(false)}
            className="font-mono text-[10px] text-white/30 hover:text-white/60
                       px-2 py-1 border border-white/10 rounded transition-colors"
          >
            ✕ close
          </button>
        </div>

        {/* CategorySidebar — natural height, no flex-1 inside left panel */}
        <CategorySidebar onCategorySelect={handleCategorySelect} />

        {/* DsaInsightsPanel — natural height below category tree */}
        <DsaInsightsPanel />

        {/* Bottom padding so last item doesn't sit against scrollbar */}
        <div className="h-4 shrink-0" />
      </div>

      {/* ══════════════════════════════════════════════════════════════
          MAIN COLUMN
          flex-1 min-w-0: takes remaining width
          min-h-0 h-full overflow-hidden: forms the clip boundary
      ══════════════════════════════════════════════════════════════ */}
      <div className="flex flex-col flex-1 min-w-0 min-h-0 h-full overflow-hidden">

        {/* ── Toolbar (shrink-0 = pinned, never scrolls away) ───────── */}
        <div className="shrink-0 flex items-center gap-2
                        px-3 py-2.5 border-b border-white/[0.05]
                        bg-[#030712]/80 backdrop-blur-sm">

          {/* Mobile: open left panel */}
          <button
            onClick={() => setLeftPanelOpen(true)}
            className="xl:hidden btn-ghost border border-white/10 rounded-lg p-2 shrink-0"
            title="Categories & DSA Stats"
          >
            <SlidersHorizontal size={14} />
          </button>

          {/* Search bar — flex-1 but capped so it doesn't eat everything */}
          <div className="flex-1 min-w-0 max-w-xs">
            <SearchBar onResults={handleSearchResults} onClear={handleSearchClear} />
          </div>

          {/* Push buttons to right */}
          <div className="flex-1" />

          {/* Refresh button */}
          <button
            onClick={handleRefresh}
            className="btn-ghost flex items-center gap-1.5 border border-white/10
                       rounded-lg px-3 py-2 shrink-0"
          >
            <RefreshCw
              size={13}
              className={refreshing ? 'animate-spin text-[#00f5ff]' : ''}
            />
            <span className="font-mono text-xs hidden sm:inline">Refresh</span>
          </button>

          {/* Add product button — shrink-0 prevents wrapping */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setModalOpen(true)}
            className="btn-neon flex items-center gap-1.5 shrink-0"
          >
            <Plus size={14} />
            <span className="font-mono text-xs tracking-wider">
              <span className="hidden sm:inline">ADD </span>PRODUCT
            </span>
          </motion.button>
        </div>

        {/* ── SCROLL REGION ─────────────────────────────────────────────
            flex-1: fills all height below toolbar
            min-h-0: CRITICAL — without this, flex-1 ignores overflow-y-auto
            overflow-y-auto: the ONE scroll container in this chain
        ──────────────────────────────────────────────────────────────── */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">

          {/* Content wrapper — pb-10 gives breathing room at bottom */}
          <div className="flex flex-col gap-4 p-4 pb-10">

            {/* Phase banner */}
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1,  y:  0 }}
              transition={{ duration: 0.35 }}
              className="glass-card p-4 border-[#b347ff]/10"
            >
              <p className="font-display text-[10px] tracking-[0.2em] text-[#b347ff]/60">
                PHASE 2 · INVENTORY CORE
              </p>
              <p className="font-body text-sm text-white/40 mt-1 leading-relaxed">
                Products live in{' '}
                <span className="text-[#00f5ff]/70">AVL Tree</span> (O(log n) search) ·{' '}
                <span className="text-[#00ff88]/70">Hash Table</span> (O(1) lookup) ·{' '}
                <span className="text-[#b347ff]/70">LCRS Category Tree</span>
              </p>
            </motion.div>

            {/* Active category filter badge */}
            {categoryFilter && filteredList === null && (
              <motion.div
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1,  x:  0 }}
                className="flex items-center gap-2 flex-wrap"
              >
                <span className="font-mono text-xs text-[#b347ff]/60">Filtering:</span>
                <span className="font-mono text-xs px-2.5 py-1 rounded-full
                                 bg-[#b347ff]/10 text-[#b347ff] border border-[#b347ff]/20">
                  {categoryFilter}
                </span>
                <button
                  onClick={() => setCategoryFilter(null)}
                  className="font-mono text-[10px] text-white/25 hover:text-white/60
                             transition-colors"
                >
                  ✕ clear
                </button>
              </motion.div>
            )}

            {/* Stats row */}
            {!loading && !error && (
              <StatsRow products={displayProducts} />
            )}

            {/* Product table — grows naturally, scroll region handles it */}
            <ProductTable
              products={displayProducts}
              loading={loading}
              error={error}
            />

            {/* DSA panel shown inline on screens narrower than xl */}
            <div className="xl:hidden">
              <DsaInsightsPanel />
            </div>

          </div>
        </div>
        {/* ── End scroll region ──────────────────────────────────────── */}

      </div>

      {/* Add product modal */}
      <AddProductModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={handleCreated}
      />
    </div>
  )
}
