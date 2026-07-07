import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { logger } from '../lib/logger'

export function PageViewLogger() {
  const location = useLocation()

  useEffect(() => {
    logger.info('Page viewed', {
      path: location.pathname,
      search: location.search,
      hash: location.hash,
    })
  }, [location.hash, location.pathname, location.search])

  return null
}
