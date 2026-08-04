// admin/src/components/CheckInPhoto.tsx
import { useQuery } from '@tanstack/react-query'
import { signedCheckInPhotoUrl } from '../lib/storage'

/**
 * Resolves a check-in photo's storage path to a signed URL and renders it.
 * Renders nothing until the signed URL has resolved. Shared between the
 * coach's CheckInsSection and the athlete's CheckInHistory so both surfaces
 * see the same photos through the same signed-URL query.
 */
export function CheckInPhoto({ path, alt, className }: { path: string; alt: string; className?: string }) {
  const { data: url } = useQuery({
    queryKey: ['checkin-photo', path],
    queryFn: () => signedCheckInPhotoUrl(path),
  })
  if (!url) return null
  return <img src={url} alt={alt} className={className} />
}
