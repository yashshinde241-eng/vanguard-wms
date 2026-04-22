/**
 * AddProductModal.jsx — Phase 3
 * Adds warehouse_x (col) and warehouse_y (row) fields with a mini grid preview.
 * The coordinates are validated against the 10×10 range [0-9].
 */

import { useState }        from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Plus, Loader2, MapPin } from 'lucide-react'
import { createProduct }   from '../hooks/useApi'

const INITIAL = {
  sku: '', name: '', category: '', quantity: '', price: '',
  warehouse_x: '', warehouse_y: ''
}

// Obstacles from the default warehouse layout (rows 1-2,4-5,7-8 cols 1-2,4-5,7-8)
const OBSTACLES = new Set()
for (const r of [1,2,4,5,7,8])
  for (const c of [1,2,4,5,7,8])
    OBSTACLES.add(r * 10 + c)

function MiniGridPreview({ wx, wy }) {
  const targetNode = wy * 10 + wx
  const isValid    = wx >= 0 && wx <= 9 && wy >= 0 && wy <= 9 && !OBSTACLES.has(targetNode)

  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-mono text-[10px] text-white/30 tracking-wider">
        GRID PREVIEW
        {!isValid && wx !== '' && wy !== '' && (
          <span className="text-red-400 ml-2">⚠ This cell is a shelf obstacle</span>
        )}
      </span>
      <div className="inline-grid gap-px"
           style={{ gridTemplateColumns: 'repeat(10, 12px)' }}>
        {Array.from({ length: 100 }, (_, i) => {
          const r = Math.floor(i / 10), c = i % 10
          const isTarget = r === parseInt(wy) && c === parseInt(wx)
          const isObs    = OBSTACLES.has(i)
          return (
            <div
              key={i}
              className={`w-3 h-3 rounded-[1px] ${
                isTarget ? 'bg-[#00f5ff]' :
                isObs    ? 'bg-[#b347ff]/20' :
                i === 0  ? 'bg-[#00ff88]/30' :
                           'bg-white/[0.04]'
              }`}
            />
          )
        })}
      </div>
      {isValid && wx !== '' && wy !== '' && (
        <p className="font-mono text-[9px] text-[#00f5ff]/50">
          Node {targetNode} · ({wx}, {wy})
        </p>
      )}
    </div>
  )
}

export default function AddProductModal({ open, onClose, onCreated }) {
  const [form,    setForm]    = useState(INITIAL)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }))

  const handleSubmit = async () => {
    if (!form.sku.trim() || !form.name.trim()) {
      setError('SKU and Name are required.'); return
    }
    const wx = parseInt(form.warehouse_x) || 0
    const wy = parseInt(form.warehouse_y) || 0
    if (wx < 0 || wx > 9 || wy < 0 || wy > 9) {
      setError('Warehouse coordinates must be in range 0–9.'); return
    }
    const nodeId = wy * 10 + wx
    if (OBSTACLES.has(nodeId)) {
      setError(`Cell (${wx},${wy}) is a shelf obstacle. Choose a walkable cell.`); return
    }

    setLoading(true); setError(null)
    try {
      const product = await createProduct({
        sku:         form.sku.trim(),
        name:        form.name.trim(),
        category:    form.category.trim() || 'Uncategorised',
        quantity:    parseInt(form.quantity)  || 0,
        price:       parseFloat(form.price)   || 0,
        warehouse_x: wx,
        warehouse_y: wy,
      })
      onCreated(product)
      setForm(INITIAL)
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          />
          <motion.div
            key="modal"
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1,    y: 0  }}
            exit={{    opacity: 0, scale: 0.94, y: 16 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="fixed inset-0 flex items-center justify-center z-50 p-4"
          >
            <div className="glass-card w-full max-w-lg p-6 border-[#00f5ff]/15
                            max-h-[90vh] overflow-y-auto">

              {/* Header */}
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="font-display text-sm font-bold tracking-widest text-white">
                    ADD PRODUCT
                  </h2>
                  <p className="font-mono text-[10px] text-white/30 mt-0.5">
                    INSERT INTO products + DSA structures
                  </p>
                </div>
                <button onClick={onClose} className="btn-ghost p-1.5 rounded-lg">
                  <X size={16} />
                </button>
              </div>

              <div className="flex flex-col gap-3">
                {/* SKU + Category */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-mono text-[10px] text-white/30 mb-1.5 tracking-wider">SKU *</label>
                    <input className="input-glass" placeholder="WH-001" value={form.sku} onChange={set('sku')} />
                  </div>
                  <div>
                    <label className="block font-mono text-[10px] text-white/30 mb-1.5 tracking-wider">CATEGORY</label>
                    <input className="input-glass" placeholder="Electronics" value={form.category} onChange={set('category')} />
                  </div>
                </div>

                {/* Name */}
                <div>
                  <label className="block font-mono text-[10px] text-white/30 mb-1.5 tracking-wider">PRODUCT NAME *</label>
                  <input className="input-glass" placeholder="Enter product name" value={form.name} onChange={set('name')} />
                </div>

                {/* Qty + Price */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-mono text-[10px] text-white/30 mb-1.5 tracking-wider">QTY</label>
                    <input className="input-glass" type="number" min="0" placeholder="0" value={form.quantity} onChange={set('quantity')} />
                  </div>
                  <div>
                    <label className="block font-mono text-[10px] text-white/30 mb-1.5 tracking-wider">PRICE (₹)</label>
                    <input className="input-glass" type="number" min="0" step="0.01" placeholder="0.00" value={form.price} onChange={set('price')} />
                  </div>
                </div>

                {/* Grid coordinates */}
                <div className="border-t border-white/[0.05] pt-3">
                  <div className="flex items-center gap-2 mb-3">
                    <MapPin size={11} className="text-[#00f5ff]" />
                    <span className="font-mono text-[10px] text-white/40 tracking-wider">
                      WAREHOUSE COORDINATES  (Phase 3)
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="block font-mono text-[10px] text-white/30 mb-1.5 tracking-wider">
                        COLUMN X (0–9)
                      </label>
                      <input
                        className="input-glass"
                        type="number" min="0" max="9" placeholder="0"
                        value={form.warehouse_x} onChange={set('warehouse_x')}
                      />
                    </div>
                    <div>
                      <label className="block font-mono text-[10px] text-white/30 mb-1.5 tracking-wider">
                        ROW Y (0–9)
                      </label>
                      <input
                        className="input-glass"
                        type="number" min="0" max="9" placeholder="0"
                        value={form.warehouse_y} onChange={set('warehouse_y')}
                      />
                    </div>
                  </div>

                  <MiniGridPreview
                    wx={parseInt(form.warehouse_x)}
                    wy={parseInt(form.warehouse_y)}
                  />
                </div>

                {error && (
                  <p className="font-mono text-xs text-red-400 bg-red-500/10
                                border border-red-500/20 rounded-lg px-3 py-2">
                    {error}
                  </p>
                )}

                <div className="flex gap-3 mt-1">
                  <button onClick={onClose} className="flex-1 btn-ghost border border-white/10 rounded-lg">
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={loading}
                    className="flex-1 btn-neon flex items-center justify-center gap-2"
                  >
                    {loading
                      ? <><Loader2 size={14} className="animate-spin" /> Inserting…</>
                      : <><Plus size={14} /> Add Product</>
                    }
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
