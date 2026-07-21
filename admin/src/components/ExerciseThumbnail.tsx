import { Dumbbell } from 'lucide-react'

interface ExerciseThumbnailProps {
  imageUrl?: string | null
  imageUrl2?: string | null
  name: string
  className?: string
}

export function ExerciseThumbnail({ imageUrl, imageUrl2, name, className = '' }: ExerciseThumbnailProps) {
  const src = imageUrl ?? imageUrl2
  if (src) return <img src={src} alt="" loading="lazy" className={`object-cover ${className}`} />
  return (
    <div className={`flex items-center justify-center bg-surface-highest text-text-secondary ${className}`} aria-hidden="true" title={name}>
      <Dumbbell size={20} />
    </div>
  )
}
