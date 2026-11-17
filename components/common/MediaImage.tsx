// components/common/MediaImage.tsx
'use client'
import Image from 'next/image'
import { useState } from 'react'

interface MediaImageProps {
  mediaId?: string | null
  alt: string
  fill?: boolean
  width?: number
  height?: number
  className?: string
  sizes?: string
}

export function MediaImage({
  mediaId,
  alt,
  fill,
  width,
  height,
  className,
  sizes,
}: MediaImageProps) {
  const [failed, setFailed] = useState(false)

  if (!mediaId || failed) {
    return (
      <div className={className ? `${className} media-fallback` : 'media-fallback'} aria-hidden>
        {(alt || '·').slice(0, 1)}
      </div>
    )
  }

  const src = `/api/media/${mediaId}`

  if (fill) {
    return (
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes ?? '(max-width: 768px) 100vw, 420px'}
        className={className}
        unoptimized
        onError={() => setFailed(true)}
      />
    )
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={width ?? 160}
      height={height ?? 100}
      className={className}
      unoptimized
      onError={() => setFailed(true)}
    />
  )
}
