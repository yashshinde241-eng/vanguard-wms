/**
 * HuffmanVisualizer.jsx — Phase 5
 *
 * Tool to compress any string (typically a JSON payload from IoT scanners)
 * using Huffman coding and display a rich breakdown of the result.
 *
 * Layout:
 *   ┌─────────────────────────────────────────────────────┐
 *   │  Input area  [Compress]  Preset JSON buttons         │
 *   ├────────────────────┬────────────────────────────────┤
 *   │  Compression Stats │  Codebook table                 │
 *   │  • Gauge bar       │  (char → bit-string)            │
 *   │  • Bit counts      │                                 │
 *   ├────────────────────┴────────────────────────────────┤
 *   │  Bitstream preview (first 256 bits)                  │
 *   └─────────────────────────────────────────────────────┘
 */

import { useState }        from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Zap, Loader2, FileCode, BarChart2,
  ChevronRight, Binary, RefreshCw
} from 'lucide-react'
import { compressData }    from '../hooks/useApi'

// ── Sample IoT payloads for quick testing ──────────────────────────────────

const PRESETS = [
  {
    label: 'Scanner Ping',
    data: '{"device":"SCAN-01","sku":"WH-001","qty":1,"loc":"A3","ts":1700000000}'
  },
  {
    label: 'Inventory Sync',
    data: '{"type":"sync","products":[{"sku":"WH-001","qty":42},{"sku":"WH-002","qty":7},{"sku":"WH-003","qty":0}]}'
  },
  {
    label: 'Order Event',
    data: '{"event":"ORDER_CREATED","order_ref":"ORD-00042","customer":"Yash Shinde","sku":"WH-004","qty":3,"shipping":"EXPRESS"}'
  },
  {
    label: 'Repetitive',
    data: 'aaaaaabbbbccddddddddeeeeeeeffffff'
  },
]

// ── Compression gauge ──────────────────────────────────────────────────────

function CompressionGauge({ pct }) {
  const color = pct > 50 ? '#00ff88' : pct > 25 ? '#00f5ff' : '#ffb800'
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-end justify-between">
        <span className="font-mono text-[10px] text-white/30">SPACE SAVED</span>
        <motion.span
          key={pct}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="font-display text-2xl font-bold"
          style={{ color }}
        >
          {pct.toFixed(1)}%
        </motion.span>
      </div>
      <div className="h-3 rounded-full bg-white/[0.06] overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${Math.max(pct, 0)}%` }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        />
      </div>
      <div className="flex justify-between font-mono text-[9px] text-white/20">
        <span>0%</span><span>50%</span><span>100%</span>
      </div>
    </div>
  )
}

// ── Stat chip ──────────────────────────────────────────────────────────────

function StatChip({ label, value, color = 'text-white/70', sub }) {
  return (
    <div className="flex flex-col">
      <span className="font-mono text-[9px] text-white/25 tracking-wider">{label}</span>
      <span className={`font-mono text-base font-bold ${color}`}>{value}</span>
      {sub && <span className="font-mono text-[9px] text-white/20">{sub}</span>}
    </div>
  )
}

// ── Codebook table ─────────────────────────────────────────────────────────

function CodebookTable({ codebook }) {
  if (!codebook || Object.keys(codebook).length === 0) return null

  // Sort by code length ascending (shorter = more frequent)
  const entries = Object.entries(codebook).sort((a, b) => a[1].length - b[1].length)

  return (
    <div className="glass-card overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-white/[0.05]">
        <Binary size={12} className="text-[#b347ff]" />
        <span className="font-display text-[10px] tracking-widest text-white/40">
          HUFFMAN CODEBOOK
        </span>
        <span className="ml-auto font-mono text-[9px] text-white/20">
          {entries.length} symbols
        </span>
      </div>
      <div className="overflow-y-auto max-h-52">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/[0.04]"
                style={{ background: 'rgba(3,7,18,0.8)' }}>
              <th className="px-3 py-2 text-left font-mono text-[9px] text-white/25">CHAR</th>
              <th className="px-3 py-2 text-left font-mono text-[9px] text-white/25">CODE</th>
              <th className="px-3 py-2 text-right font-mono text-[9px] text-white/25">BITS</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(([ch, code]) => (
              <tr key={ch} className="border-b border-white/[0.02] hover:bg-white/[0.02]">
                <td className="px-3 py-1.5">
                  <span className="font-mono text-xs text-[#00f5ff]/70 bg-[#00f5ff]/5
                                   border border-[#00f5ff]/15 px-1.5 py-0.5 rounded">
                    {ch === 'SPACE' ? '·' : ch}
                  </span>
                </td>
                <td className="px-3 py-1.5 font-mono text-xs text-[#b347ff]/70 tracking-wider">
                  {code}
                </td>
                <td className="px-3 py-1.5 text-right font-mono text-xs text-white/30">
                  {code.length}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Bitstream preview ──────────────────────────────────────────────────────

function BitstreamPreview({ preview }) {
  if (!preview) return null

  // Colorise bits: 0 = dim, 1 = bright
  const chars = preview.startsWith('...') ? preview : preview.substring(0, 200)

  return (
    <div className="glass-card p-3 border-[#00f5ff]/5">
      <div className="flex items-center gap-2 mb-2">
        <FileCode size={11} className="text-[#00f5ff]/50" />
        <span className="font-mono text-[9px] text-white/25 tracking-wider">
          BITSTREAM PREVIEW (first 200 bits)
        </span>
      </div>
      <div className="font-mono text-[10px] leading-5 break-all">
        {chars.split('').map((c, i) => (
          c === '0' ? (
            <span key={i} className="text-white/20">0</span>
          ) : c === '1' ? (
            <span key={i} className="text-[#00f5ff]/60">1</span>
          ) : (
            <span key={i} className="text-white/30">{c}</span>
          )
        ))}
      </div>
    </div>
  )
}

// ── Main HuffmanVisualizer ─────────────────────────────────────────────────

export default function HuffmanVisualizer() {
  const [input,   setInput]   = useState('')
  const [result,  setResult]  = useState(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)

  const handleCompress = async () => {
    const trimmed = input.trim()
    if (!trimmed) { setError('Please enter some text to compress.'); return }
    setLoading(true); setError(null)
    try {
      const data = await compressData(trimmed)
      setResult(data)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  const handlePreset = (preset) => {
    setInput(preset.data)
    setResult(null)
    setError(null)
  }

  const handleReset = () => { setInput(''); setResult(null); setError(null) }

  return (
    <div className="flex flex-col gap-4">

      {/* Input area */}
      <div className="glass-card p-4 border-white/[0.06] flex flex-col gap-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Zap size={13} className="text-[#00f5ff]" />
            <span className="font-display text-[10px] tracking-widest text-white/50">
              INPUT PAYLOAD
            </span>
          </div>
          {/* Preset buttons */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {PRESETS.map(p => (
              <button key={p.label}
                onClick={() => handlePreset(p)}
                className="font-mono text-[9px] px-2 py-1 rounded border border-white/10
                           text-white/30 hover:text-white/60 hover:border-white/20 transition-colors">
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <textarea
          className="input-glass resize-none h-24 font-mono text-xs leading-relaxed"
          placeholder='Paste any JSON string, e.g. {"sku":"WH-001","qty":42}'
          value={input}
          onChange={e => { setInput(e.target.value); setResult(null) }}
          spellCheck={false}
        />

        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-white/20">
            {input.length} chars · {input.length * 8} bits raw
          </span>
          <div className="flex-1" />
          <button onClick={handleReset} className="btn-ghost flex items-center gap-1 text-xs border border-white/10 rounded-lg px-3 py-1.5">
            <RefreshCw size={11} /> Reset
          </button>
          <motion.button
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
            onClick={handleCompress}
            disabled={loading || !input.trim()}
            className="btn-neon flex items-center gap-2 py-2"
          >
            {loading
              ? <><Loader2 size={12} className="animate-spin" /> Encoding…</>
              : <><Zap size={12} /> Compress</>}
          </motion.button>
        </div>

        <AnimatePresence>
          {error && (
            <motion.p initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
              className="font-mono text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 rounded px-3 py-2">
              {error}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* Results */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-4"
          >
            {/* Stats + codebook row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

              {/* Compression stats */}
              <div className="glass-card p-4 border-[#00ff88]/10 flex flex-col gap-4">
                <div className="flex items-center gap-2">
                  <BarChart2 size={12} className="text-[#00ff88]" />
                  <span className="font-display text-[10px] tracking-widest text-white/40">
                    COMPRESSION RESULTS
                  </span>
                  <span className="ml-auto font-mono text-[9px] border border-[#00ff88]/20 text-[#00ff88]/40 px-1.5 py-0.5 rounded">
                    {result.elapsed_us}µs
                  </span>
                </div>

                <CompressionGauge pct={result.space_saved_pct} />

                <div className="grid grid-cols-2 gap-3">
                  <StatChip label="ORIGINAL"   value={`${result.original_bits} bits`}
                            sub={`${result.original_chars} chars`}
                            color="text-white/50" />
                  <StatChip label="COMPRESSED" value={`${result.compressed_bits} bits`}
                            sub={`${(result.compressed_bits/8).toFixed(1)} bytes`}
                            color="text-[#00ff88]" />
                  <StatChip label="RATIO"      value={result.compression_ratio.toFixed(3)}
                            sub="compressed/original" color="text-[#00f5ff]" />
                  <StatChip label="TREE HEIGHT" value={result.tree_height}
                            sub={`${result.unique_chars} symbols`} color="text-[#b347ff]" />
                </div>

                {/* Side-by-side bit bar */}
                <div>
                  <p className="font-mono text-[9px] text-white/25 mb-1.5">BITS COMPARISON</p>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[9px] text-white/30 w-14">Original</span>
                      <div className="flex-1 h-2.5 rounded-full bg-white/[0.04] overflow-hidden">
                        <div className="h-full bg-white/20 rounded-full w-full" />
                      </div>
                      <span className="font-mono text-[9px] text-white/30 w-14 text-right">
                        {result.original_bits}b
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[9px] text-[#00ff88]/60 w-14">Huffman</span>
                      <div className="flex-1 h-2.5 rounded-full bg-white/[0.04] overflow-hidden">
                        <motion.div
                          className="h-full bg-[#00ff88] rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${result.compression_ratio * 100}%` }}
                          transition={{ duration: 0.6, ease: 'easeOut' }}
                        />
                      </div>
                      <span className="font-mono text-[9px] text-[#00ff88]/60 w-14 text-right">
                        {result.compressed_bits}b
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Codebook */}
              <CodebookTable codebook={result.codebook} />
            </div>

            {/* Bitstream preview */}
            <BitstreamPreview preview={result.bitstream_preview} />

            {/* Algorithm note */}
            <div className="glass-card p-3 border-white/[0.04]">
              <p className="font-mono text-[10px] text-white/30 leading-relaxed">
                <span className="text-[#b347ff]/70">Huffman Coding</span> assigns shorter
                bit-codes to frequent characters. Characters appearing often (like
                {' '}<span className="text-[#00f5ff]/60">"</span>,
                {' '}<span className="text-[#00f5ff]/60">:</span>,
                {' '}<span className="text-[#00f5ff]/60">{`{`}</span> in JSON) get 1-3 bit codes.
                Rare characters get 6-8 bit codes. Average code length is always ≤ original 8 bits/char.
                Tree height {result.tree_height} with {result.unique_chars} unique symbols.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
