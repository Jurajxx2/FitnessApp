import { useEffect, useState } from 'react'
import { signedMealPhotoUrl } from '../lib/storage'

export function MealPhoto({ path, alt, className = '' }: { path: string; alt: string; className?: string }) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setUrl(null)
    void signedMealPhotoUrl(path).then(signedUrl => {
      if (active) setUrl(signedUrl)
    })
    return () => { active = false }
  }, [path])

  if (!url) return null
  return <img src={url} alt={alt} className={className} />
}
