/**
 * App.jsx — Phase 5
 * Adds 'efficiency' page routing.
 */
import { useState }      from 'react'
import { motion }        from 'framer-motion'
import Sidebar           from './components/Sidebar'
import StatusBar         from './components/StatusBar'
import Dashboard         from './components/Dashboard'
import LogisticsPage     from './components/LogisticsPage'
import DispatchPage      from './components/DispatchPage'
import EfficiencyPage    from './components/EfficiencyPage'
import { useProducts }   from './hooks/useApi'

export default function App() {
  const { products }     = useProducts()
  const [page, setPage]  = useState('dashboard')

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-void text-white">
      <div className="pointer-events-none fixed inset-0 bg-grid-pattern"
           style={{ backgroundSize: '40px 40px' }} />
      <div className="pointer-events-none fixed top-0 left-1/4 w-96 h-96 rounded-full bg-[#00f5ff]/[0.04] blur-3xl" />
      <div className="pointer-events-none fixed bottom-0 right-1/4 w-80 h-80 rounded-full bg-[#b347ff]/[0.04] blur-3xl" />

      <Sidebar currentPage={page} onNavigate={setPage} />

      <div className="flex flex-col flex-1 min-w-0 h-full overflow-hidden relative">
        <StatusBar productCount={products.length} />
        <motion.main
          key={page}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.22 }}
          className="flex-1 min-h-0 overflow-hidden flex flex-col"
        >
          {page === 'dashboard'  && <Dashboard />}
          {page === 'logistics'  && <LogisticsPage />}
          {page === 'dispatch'   && <DispatchPage />}
          {page === 'efficiency' && <EfficiencyPage />}
        </motion.main>
      </div>
    </div>
  )
}
