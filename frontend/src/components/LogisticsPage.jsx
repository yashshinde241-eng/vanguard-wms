/**
 * LogisticsPage.jsx — Phase 3
 *
 * The main Phase 3 view. Layout:
 *
 *   ┌───────────────────────────────────────────────┐
 *   │  Phase banner                                  │
 *   ├─────────────────────┬─────────────────────────┤
 *   │  WarehouseMap       │  Product Navigator       │
 *   │  (10×10 grid)       │  (click to navigate)     │
 *   │                     │                          │
 *   ├─────────────────────┴─────────────────────────┤
 *   │  ShippingMatrix (Floyd-Warshall table)         │
 *   └───────────────────────────────────────────────┘
 */

import { useState, useRef }  from 'react'
import { motion }            from 'framer-motion'
import { Map, Package, Navigation, Zap } from 'lucide-react'
import { useProducts }       from '../hooks/useApi'
import WarehouseMap          from './WarehouseMap'
import ShippingMatrix        from './ShippingMatrix'

// ── Product navigator panel ─────────────────────────────────────────────────

function ProductNavigator({ products, onNavigate, loading }) {
  const [selected, setSelected] = useState(null)

  const handleClick = (p) => {
    setSelected(p.id)
    onNavigate(p)
  }

  return (
    <div className="glass-card flex flex-col overflow-hidden">
      <div className="shrink-0 flex items-center gap-2 px-3 py-2.5 border-b border-white/[0.05]">
        <Package size={12} className="text-[#00f5ff]" />
        <span className="font-display text-[10px] font-bold tracking-widest text-white/50">
          PRODUCT LOCATOR
        </span>
        <span className="ml-auto font-mono text-[9px] text-white/20">
          {products.length} items
        </span>
      </div>

      <div className="overflow-y-auto flex-1 py-1">
        {loading ? (
          <div className="flex flex-col gap-1.5 p-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="skeleton h-8 rounded" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <p className="font-mono text-[10px] text-white/20 text-center py-6 px-3">
            No products yet.<br />Add products to see their map positions.
          </p>
        ) : (
          products.map(p => {
            const hasCoords = p.warehouse_x !== 0 || p.warehouse_y !== 0 ||
                              p.node_id === 0
            return (
              <button
                key={p.id}
                onClick={() => handleClick(p)}
                className={`
                  w-full flex items-center gap-2.5 px-3 py-2
                  hover:bg-white/[0.04] transition-colors text-left
                  border-b border-white/[0.02] last:border-0
                  ${selected === p.id ? 'bg-[#00f5ff]/5' : ''}
                `}
              >
                <div className={`
                  w-1.5 h-1.5 rounded-full shrink-0
                  ${selected === p.id ? 'bg-[#00f5ff] shadow-[0_0_4px_#00f5ff]' : 'bg-white/20'}
                `} />
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-xs text-[#00f5ff]/70 truncate">
                    {p.sku}
                  </p>
                  <p className="font-body text-xs text-white/50 truncate">
                    {p.name}
                  </p>
                </div>
                <span className="font-mono text-[9px] text-white/20 shrink-0 whitespace-nowrap">
                  ({p.warehouse_x},{p.warehouse_y})
                </span>
              </button>
            )
          })
        )}
      </div>

      <div className="shrink-0 border-t border-white/[0.04] px-3 py-2">
        <p className="font-mono text-[9px] text-white/20 leading-relaxed">
          Click any product to run Dijkstra from the entry point (0,0) to its grid location.
        </p>
      </div>
    </div>
  )
}

// ── Main LogisticsPage ──────────────────────────────────────────────────────

export default function LogisticsPage() {
  const { products, loading } = useProducts()
  const [selectedProduct, setSelectedProduct] = useState(null)
  const mapRef = useRef(null)

  const handleNavigate = (product) => {
    setSelectedProduct(product)
    // Scroll to map on mobile
    mapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
      <div className="flex flex-col gap-5 p-4 pb-10">

        {/* Phase banner */}
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1,  y:  0 }}
          className="glass-card p-4 border-[#00f5ff]/10"
        >
          <div className="flex items-center gap-3">
            <Map size={14} className="text-[#00f5ff]" />
            <div>
              <p className="font-display text-[10px] tracking-[0.2em] text-[#00f5ff]/60">
                PHASE 3 · LOGISTICS ENGINE
              </p>
              <p className="font-body text-sm text-white/40 mt-0.5">
                <span className="text-[#00f5ff]/70">Dijkstra's Algorithm</span>
                {' '}navigates the 10×10 warehouse grid ·{' '}
                <span className="text-[#b347ff]/70">Floyd-Warshall</span>
                {' '}pre-computes all regional shipping costs at boot
              </p>
            </div>
          </div>
        </motion.div>

        {/* Warehouse map + product locator side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-4" ref={mapRef}>
          {/* Grid map */}
          <div className="min-w-0">
            <WarehouseMap
              products={products}
              selectedProduct={selectedProduct}
            />
          </div>

          {/* Product list */}
          <div className="lg:max-h-[560px] flex flex-col">
            <ProductNavigator
              products={products}
              onNavigate={handleNavigate}
              loading={loading}
            />
          </div>
        </div>

        {/* Shipping matrix */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <ShippingMatrix />
        </motion.div>

      </div>
    </div>
  )
}
