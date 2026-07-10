import { motion } from 'framer-motion'
import { Outlet, useLocation } from 'react-router-dom'

export function PageTransition() {
  const location = useLocation()

  return (
    <motion.div
      key={location.pathname}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
    >
      <Outlet />
    </motion.div>
  )
}
