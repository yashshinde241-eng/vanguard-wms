/**
 * DispatchDashboard.jsx — Phase 4
 *
 * Live Order Queue powered by the Max-Heap backend.
 * Layout:
 *   ┌─────────────────────────────────────────────────┐
 *   │  Phase 4 banner                                  │
 *   ├────────────────────┬────────────────────────────┤
 *   │  Heap Stats panel  │  Add Order form             │
 *   ├────────────────────┴────────────────────────────┤
 *   │  Live Order Queue table  [Process Next] button   │
 *   └─────────────────────────────────────────────────┘
 */

import { useState, useCallback }    from 'react'
import { motion, AnimatePresence }  from 'framer-motion'
import {
  Zap, ArrowUpCircle, Clock, User, Package,
  ChevronRight, Loader2, CheckCircle2, AlertTriangle,
  TrendingUp, Plus, X
} from 'lucide-react'
import { useOrders, submitOrder, processNextOrder } from '../hooks/useApi'

// ── Shipping type badge ─────────────────────────────────────────────────────

const TYPE_STYLES = {
  URGENT:   'bg-red-500/15 text-red-400 border-red-500/25',
  EXPRESS:  'bg-[#ffb800]/10 text-[#ffb800] border-[#ffb800]/20',
  STANDARD: 'bg-[#00f5ff]/8 text-[#00f5ff]/70 border-[#00f5ff]/15',
  ECONOMY:  'bg-white/[0.04] text-white/30 border-white/10',
}

function TypeBadge({ type }) {
  return (
    <span className={`font-mono text-[9px] px-1.5 py-0.5 rounded-full border whitespace-nowrap
                      ${TYPE_STYLES[type] ?? TYPE_STYLES.STANDARD}`}>
      {type}
    </span>
  )
}

// ── Urgency score bar ───────────────────────────────────────────────────────

function UrgencyBar({ score, maxScore }) {
  const pct  = Math.min((score / Math.max(maxScore, 1)) * 100, 100)
  const high = pct > 70
  const mid  = pct > 35 && pct <= 70
  const color = high ? '#ef4444' : mid ? '#ffb800' : '#00f5ff'

  return (
    <div className="flex items-center gap-2 min-w-[80px]">
      <div className="flex-1 h-1 rounded-full bg-white/[0.06] overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        />
      </div>
      <span className="font-mono text-[10px] text-white/40 w-8 text-right shrink-0">
        {score.toFixed(0)}
      </span>
    </div>
  )
}

// ── Heap stats mini panel ───────────────────────────────────────────────────

function HeapStats({ stats }) {
  if (!stats) return null
  return (
    <div className="glass-card p-4 border-[#ffb800]/10 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <TrendingUp size={12} className="text-[#ffb800]" />
        <span className="font-display text-[10px] tracking-widest text-white/40">
          MAX-HEAP STATS
        </span>
        <span className="ml-auto font-mono text-[9px] border border-[#ffb800]/20 text-[#ffb800]/40 px-1.5 py-0.5 rounded">
          O(log n)
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'ACTIVE',  value: stats.size,          color: 'text-[#ffb800]' },
          { label: 'HEIGHT',  value: stats.height,        color: 'text-[#00f5ff]' },
          { label: 'PUSHED',  value: stats.total_pushed,  color: 'text-[#00ff88]' },
          { label: 'POPPED',  value: stats.total_popped,  color: 'text-[#b347ff]' },
        ].map(({ label, value, color }) => (
          <div key={label}>
            <p className="font-mono text-[9px] text-white/25">{label}</p>
            <p className={`font-mono text-lg font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>
      {stats.top_score > 0 && (
        <div className="border-t border-white/[0.04] pt-2">
          <p className="font-mono text-[9px] text-white/25">TOP URGENCY</p>
          <p className="font-mono text-sm text-[#ffb800]">{stats.top_score.toFixed(1)}</p>
        </div>
      )}
    </div>
  )
}

// ── Add Order form ──────────────────────────────────────────────────────────

const SHIPPING_TYPES = ['URGENT', 'EXPRESS', 'STANDARD', 'ECONOMY']

function AddOrderForm({ onAdded }) {
  const INIT = { order_ref:'', customer_name:'', sku:'', quantity:'1',
                 value:'', shipping_type:'STANDARD' }
  const [form,    setForm]    = useState(INIT)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)
  const [success, setSuccess] = useState(null)

  const set = (f) => (e) => setForm(p => ({ ...p, [f]: e.target.value }))

  const handleSubmit = async () => {
    if (!form.order_ref.trim() || !form.customer_name.trim() || !form.sku.trim()) {
      setError('Order Ref, Customer, and SKU are required.'); return
    }
    setLoading(true); setError(null); setSuccess(null)
    try {
      const order = await submitOrder({
        ...form,
        quantity: parseInt(form.quantity) || 1,
        value:    parseFloat(form.value)  || 0,
      })
      setSuccess(`Order ${order.order_ref} pushed — urgency ${order.urgency_score.toFixed(1)}`)
      setForm(INIT)
      onAdded?.()
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  return (
    <div className="glass-card p-4 border-[#00f5ff]/10 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Plus size={12} className="text-[#00f5ff]" />
        <span className="font-display text-[10px] tracking-widest text-white/40">
          NEW ORDER
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block font-mono text-[9px] text-white/25 mb-1 tracking-wider">ORDER REF *</label>
          <input className="input-glass py-2 text-xs" placeholder="ORD-00042"
                 value={form.order_ref} onChange={set('order_ref')} />
        </div>
        <div>
          <label className="block font-mono text-[9px] text-white/25 mb-1 tracking-wider">SKU *</label>
          <input className="input-glass py-2 text-xs" placeholder="WH-001"
                 value={form.sku} onChange={set('sku')} />
        </div>
        <div className="col-span-2">
          <label className="block font-mono text-[9px] text-white/25 mb-1 tracking-wider">CUSTOMER *</label>
          <input className="input-glass py-2 text-xs" placeholder="Customer name"
                 value={form.customer_name} onChange={set('customer_name')} />
        </div>
        <div>
          <label className="block font-mono text-[9px] text-white/25 mb-1 tracking-wider">QTY</label>
          <input className="input-glass py-2 text-xs" type="number" min="1" placeholder="1"
                 value={form.quantity} onChange={set('quantity')} />
        </div>
        <div>
          <label className="block font-mono text-[9px] text-white/25 mb-1 tracking-wider">VALUE (₹)</label>
          <input className="input-glass py-2 text-xs" type="number" min="0" placeholder="0"
                 value={form.value} onChange={set('value')} />
        </div>
        <div className="col-span-2">
          <label className="block font-mono text-[9px] text-white/25 mb-1 tracking-wider">SHIPPING TYPE</label>
          <div className="flex gap-1.5 flex-wrap">
            {SHIPPING_TYPES.map(t => (
              <button key={t}
                onClick={() => setForm(p => ({ ...p, shipping_type: t }))}
                className={`font-mono text-[9px] px-2.5 py-1.5 rounded-lg border transition-colors
                  ${form.shipping_type === t
                    ? TYPE_STYLES[t]
                    : 'border-white/10 text-white/30 hover:text-white/60'
                  }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {error && (
          <motion.p initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            className="font-mono text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 rounded px-3 py-2">
            {error}
          </motion.p>
        )}
        {success && (
          <motion.p initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            className="font-mono text-[10px] text-[#00ff88] bg-[#00ff88]/5 border border-[#00ff88]/20 rounded px-3 py-2 flex items-center gap-2">
            <CheckCircle2 size={10} /> {success}
          </motion.p>
        )}
      </AnimatePresence>

      <button onClick={handleSubmit} disabled={loading}
        className="btn-neon flex items-center justify-center gap-2 w-full py-2">
        {loading ? <><Loader2 size={12} className="animate-spin" /> Pushing…</>
                 : <><ArrowUpCircle size={12} /> Push to Heap</>}
      </button>
    </div>
  )
}

// ── Order row ───────────────────────────────────────────────────────────────

function OrderRow({ order, rank, maxScore }) {
  const isTop = rank === 0
  return (
    <motion.tr
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1,  y:  0 }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ delay: rank * 0.03 }}
      className={`border-b border-white/[0.03] transition-colors
        ${isTop ? 'bg-[#ffb800]/[0.03]' : 'hover:bg-white/[0.02]'}`}
    >
      <td className="px-3 py-2.5 whitespace-nowrap">
        <div className="flex items-center gap-1.5">
          {isTop && <Zap size={10} className="text-[#ffb800] shrink-0" />}
          <span className="font-mono text-xs text-white/50">{rank + 1}</span>
        </div>
      </td>
      <td className="px-3 py-2.5">
        <p className="font-mono text-xs text-[#00f5ff]/70 whitespace-nowrap">{order.order_ref}</p>
      </td>
      <td className="px-3 py-2.5">
        <p className="font-body text-xs text-white/70 truncate max-w-[120px]">{order.customer_name}</p>
      </td>
      <td className="px-3 py-2.5">
        <span className="font-mono text-xs text-white/50 whitespace-nowrap">{order.sku}</span>
      </td>
      <td className="px-3 py-2.5 whitespace-nowrap">
        <TypeBadge type={order.shipping_type} />
      </td>
      <td className="px-3 py-2.5">
        <UrgencyBar score={order.urgency_score} maxScore={maxScore} />
      </td>
      <td className="px-3 py-2.5 font-mono text-xs text-[#00ff88]/60 whitespace-nowrap">
        ₹{order.value.toLocaleString('en-IN')}
      </td>
    </motion.tr>
  )
}

// ── Processed order toast ───────────────────────────────────────────────────

function ProcessedToast({ order, onDismiss }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{    opacity: 0, x: 40 }}
      className="glass-card border-[#00ff88]/20 p-4 flex items-start gap-3 max-w-sm"
    >
      <CheckCircle2 size={16} className="text-[#00ff88] shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="font-display text-[10px] tracking-widest text-[#00ff88]/70">
          ORDER DISPATCHED
        </p>
        <p className="font-mono text-xs text-white/70 mt-1">{order.order_ref}</p>
        <p className="font-body text-xs text-white/40 truncate">{order.customer_name}</p>
        <p className="font-mono text-[9px] text-white/25 mt-1">
          Urgency was {order.urgency_score.toFixed(1)}
        </p>
      </div>
      <button onClick={onDismiss} className="text-white/20 hover:text-white/50 transition-colors">
        <X size={12} />
      </button>
    </motion.div>
  )
}

// ── Main component ──────────────────────────────────────────────────────────

export default function DispatchDashboard() {
  const { orders, stats, loading, refetch } = useOrders()
  const [processing,  setProcessing]  = useState(false)
  const [processErr,  setProcessErr]  = useState(null)
  const [lastPopped,  setLastPopped]  = useState(null)

  const maxScore = orders.length > 0 ? orders[0].urgency_score : 100

  const handleProcessNext = async () => {
    setProcessing(true); setProcessErr(null)
    try {
      const { order } = await processNextOrder()
      setLastPopped(order)
      refetch()
      // Auto-dismiss toast after 5s
      setTimeout(() => setLastPopped(null), 5000)
    } catch (err) {
      setProcessErr(err.message)
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
      <div className="flex flex-col gap-4 p-4 pb-10">

        {/* Phase banner */}
        <motion.div initial={{opacity:0,y:-6}} animate={{opacity:1,y:0}}
          className="glass-card p-4 border-[#ffb800]/10">
          <p className="font-display text-[10px] tracking-[0.2em] text-[#ffb800]/60">
            PHASE 4 · DISPATCH COMMANDER
          </p>
          <p className="font-body text-sm text-white/40 mt-1">
            <span className="text-[#ffb800]/70">Max-Heap</span> manages order priority in O(log n) ·
            Orders age over time — urgency score rises every minute
          </p>
        </motion.div>

        {/* Stats + form row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <HeapStats stats={stats} />
          <AddOrderForm onAdded={refetch} />
        </div>

        {/* Queue header + process button */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <ArrowUpCircle size={14} className="text-[#ffb800]" />
            <span className="font-display text-xs font-bold tracking-widest text-white/70">
              LIVE ORDER QUEUE
            </span>
            <span className="font-mono text-[10px] border border-[#ffb800]/20 text-[#ffb800]/40 px-1.5 py-0.5 rounded">
              MAX-HEAP
            </span>
            {!loading && (
              <span className="font-mono text-[10px] text-white/20">
                {orders.length} order{orders.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {processErr && (
              <span className="font-mono text-[10px] text-red-400">{processErr}</span>
            )}
            <motion.button
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
              onClick={handleProcessNext}
              disabled={processing || orders.length === 0}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-xs
                          border transition-all duration-200
                          ${orders.length === 0
                            ? 'border-white/10 text-white/20 cursor-not-allowed'
                            : 'border-[#ffb800]/30 text-[#ffb800] bg-[#ffb800]/5 hover:bg-[#ffb800]/10 hover:border-[#ffb800]/50'
                          }`}
            >
              {processing
                ? <><Loader2 size={12} className="animate-spin" /> Processing…</>
                : <><ChevronRight size={12} /> PROCESS NEXT</>}
            </motion.button>
          </div>
        </div>

        {/* Orders table */}
        <div className="glass-card overflow-hidden">
          {loading && orders.length === 0 ? (
            <div className="flex flex-col gap-2 p-4">
              {[...Array(3)].map((_,i) => (
                <div key={i} className="skeleton h-10 rounded" />
              ))}
            </div>
          ) : orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <Package size={28} className="text-white/15" />
              <p className="font-display text-sm tracking-wider text-white/30">QUEUE EMPTY</p>
              <p className="font-mono text-xs text-white/20">
                Add an order above to push it onto the Max-Heap.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[580px]">
                <thead>
                  <tr className="border-b border-white/[0.05]"
                      style={{ background: 'rgba(3,7,18,0.9)' }}>
                    {['#', 'ORDER REF', 'CUSTOMER', 'SKU', 'TYPE', 'URGENCY', 'VALUE'].map(col => (
                      <th key={col} className="px-3 py-2.5 text-left font-mono text-[9px] tracking-widest text-white/25">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence initial={false}>
                    {orders.map((o, i) => (
                      <OrderRow key={o.id} order={o} rank={i} maxScore={maxScore} />
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* DSA explanation */}
        <div className="glass-card p-4 border-white/[0.04]">
          <p className="font-display text-[10px] tracking-widest text-white/25 mb-2">
            HOW THE HEAP WORKS
          </p>
          <p className="font-body text-xs text-white/30 leading-relaxed">
            Every order gets an <span className="text-[#ffb800]/70">urgency score</span> on arrival:
            {' '}URGENT × 1000, EXPRESS × 500, STANDARD × 100, ECONOMY × 10 — plus a log-value bonus
            and sqrt(quantity) term. The heap keeps the highest-scoring order at position 0 at all times.
            The <span className="text-[#00f5ff]/60">age bonus</span> (+0.1 per minute) ensures old orders
            are never starved. <span className="text-[#00ff88]/60">Process Next</span> runs a heap pop in O(log n).
          </p>
        </div>

      </div>

      {/* Popped toast — fixed bottom right */}
      <div className="fixed bottom-6 right-6 z-50">
        <AnimatePresence>
          {lastPopped && (
            <ProcessedToast
              order={lastPopped}
              onDismiss={() => setLastPopped(null)}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
