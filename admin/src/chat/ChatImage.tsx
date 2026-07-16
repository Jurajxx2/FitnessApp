import { useQuery } from '@tanstack/react-query'
import { resolveChatImageUrl } from './athleteApi'

interface ChatImageProps {
  imageRef: string
  alt: string
  className: string
  unavailableText: string
}

/**
 * Chat attachments are stored as private Storage object paths. The current
 * reader's Storage RLS policy authorizes creation of the short-lived URL.
 */
export function ChatImage({ imageRef, alt, className, unavailableText }: ChatImageProps) {
  const imageQuery = useQuery({
    queryKey: ['chat-image-url', imageRef],
    queryFn: () => resolveChatImageUrl(imageRef),
    staleTime: 50 * 60 * 1000,
    refetchInterval: 50 * 60 * 1000,
  })

  if (imageQuery.isLoading) {
    return <div className="h-24 w-40 animate-pulse rounded-lg bg-surface-highest" />
  }

  if (!imageQuery.data) {
    return <p className="text-xs text-text-secondary">{unavailableText}</p>
  }

  return <img src={imageQuery.data} alt={alt} className={className} />
}
