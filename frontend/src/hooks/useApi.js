// hooks/useApi.js — Phase 5
// Adds: compressData, solveTSP

import { useState, useEffect, useCallback, useRef } from 'react'

const BASE = '/api'

// ═══════════════════════ PHASE 1 ═══════════════════════════════════════════

export function useProducts() {
  const [products, setProducts] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)
  const fetchProducts = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await fetch(`${BASE}/products`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setProducts((await res.json()).data ?? [])
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { fetchProducts() }, [fetchProducts])
  return { products, loading, error, refetch: fetchProducts }
}

export function useHealth() {
  const [health,  setHealth]  = useState(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const check = async () => {
      try { setHealth(await (await fetch(`${BASE}/health`)).json()) }
      catch { setHealth({ status: 'error' }) }
      finally { setLoading(false) }
    }
    check(); const id = setInterval(check, 15_000)
    return () => clearInterval(id)
  }, [])
  return { health, loading }
}

export async function createProduct(payload) {
  const res  = await fetch(`${BASE}/products`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`)
  return json.data
}

// ═══════════════════════ PHASE 2 ═══════════════════════════════════════════

export function useSearch(query, debounceMs = 300) {
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)
  const [elapsedUs, setElapsedUs] = useState(null)
  const timerRef = useRef(null)
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (!query?.trim()) { setResults([]); setElapsedUs(null); return }
    setLoading(true)
    timerRef.current = setTimeout(async () => {
      try {
        const json = await (await fetch(`${BASE}/search?q=${encodeURIComponent(query.trim())}`)).json()
        setResults(json.data ?? []); setElapsedUs(json.elapsed_us ?? null); setError(null)
      } catch (err) { setError(err.message) }
      finally { setLoading(false) }
    }, debounceMs)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [query, debounceMs])
  return { results, loading, error, elapsedUs }
}

export async function skuLookup(sku) {
  const json = await (await fetch(`${BASE}/sku/${encodeURIComponent(sku)}`)).json()
  return { product: json.data, elapsedUs: json.elapsed_us }
}

export function useCategories() {
  const [categories, setCategories] = useState([])
  const [loading,    setLoading]    = useState(true)
  const fetch_ = useCallback(async () => {
    try { setCategories((await (await fetch(`${BASE}/categories`)).json()).data ?? []) }
    catch { setCategories([]) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { fetch_() }, [fetch_])
  return { categories, loading, refetch: fetch_ }
}

export function useDsaStats() {
  const [stats,   setStats]   = useState(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const fetch_ = async () => {
      try { setStats((await (await fetch(`${BASE}/dsa/stats`)).json()).data ?? null) }
      catch { /* silent */ }
      finally { setLoading(false) }
    }
    fetch_(); const id = setInterval(fetch_, 5_000)
    return () => clearInterval(id)
  }, [])
  return { stats, loading }
}

// ═══════════════════════ PHASE 3 ═══════════════════════════════════════════

export function useGridInfo() {
  const [grid,    setGrid]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const fetchGrid = useCallback(async () => {
    try {
      const res = await fetch(`${BASE}/nav/grid`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setGrid((await res.json()).data ?? null); setError(null)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { fetchGrid() }, [fetchGrid])
  return { grid, loading, error, refetch: fetchGrid }
}

export async function fetchPath(start, end) {
  const json = await (await fetch(`${BASE}/nav/path?start=${start}&end=${end}`)).json()
  if (!json.success) throw new Error(json.error ?? 'Path error')
  return json.data
}

export function useShippingMatrix() {
  const [matrix,  setMatrix]  = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  useEffect(() => {
    const fetch_ = async () => {
      try {
        const res = await fetch(`${BASE}/nav/shipping-matrix`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        setMatrix((await res.json()).data ?? null); setError(null)
      } catch (err) { setError(err.message) }
      finally { setLoading(false) }
    }
    fetch_()
  }, [])
  return { matrix, loading, error }
}

export async function toggleBlock(nodeId, action = 'block') {
  const res  = await fetch(`${BASE}/nav/block`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ node: nodeId, action }),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`)
  return json.data
}

// ═══════════════════════ PHASE 4 ═══════════════════════════════════════════

export function useOrders() {
  const [orders,  setOrders]  = useState([])
  const [stats,   setStats]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const fetchOrders = useCallback(async () => {
    try {
      const res  = await fetch(`${BASE}/orders`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setOrders(json.data ?? []); setStats(json.stats ?? null); setError(null)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => {
    fetchOrders(); const id = setInterval(fetchOrders, 3_000)
    return () => clearInterval(id)
  }, [fetchOrders])
  return { orders, stats, loading, error, refetch: fetchOrders }
}

export async function submitOrder(payload) {
  const res  = await fetch(`${BASE}/orders`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`)
  return json.data
}

export async function processNextOrder() {
  const res  = await fetch(`${BASE}/orders/next`)
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`)
  return { order: json.data, remaining: json.remaining }
}

export async function optimizePack(productIds, capacityKg) {
  const res  = await fetch(`${BASE}/optimize-pack`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ product_ids: productIds, capacity_kg: capacityKg }),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`)
  return json.data
}

// ═══════════════════════ PHASE 5 ═══════════════════════════════════════════

/**
 * compressData — POST a string to the Huffman encoder.
 * Returns full encode result: bitstream_preview, codebook, stats.
 */
export async function compressData(data) {
  const res  = await fetch(`${BASE}/efficiency/compress`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data }),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`)
  return json.data
}

/**
 * solveTSP — POST product IDs to get optimised picker tour.
 * Returns tour_order, full_path, total_cost, algorithm used.
 */
export async function solveTSP(productIds, depot = 0) {
  const res  = await fetch(`${BASE}/nav/tsp`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ product_ids: productIds, depot }),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`)
  return json.data
}
