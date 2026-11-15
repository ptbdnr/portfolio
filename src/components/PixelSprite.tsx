import { useMemo } from 'react'
import { bake, type Sprite } from '../game/engine/sprites.ts'

const urls = new WeakMap<Sprite, Map<string, string>>()

function spriteUrl(sprite: Sprite, flip: boolean) {
  let byFlip = urls.get(sprite)
  if (!byFlip) {
    byFlip = new Map()
    urls.set(sprite, byFlip)
  }
  const key = flip ? 'f' : 'n'
  let url = byFlip.get(key)
  if (!url) {
    url = bake(sprite, null, flip).toDataURL()
    byFlip.set(key, url)
  }
  return url
}

type Props = {
  sprite: Sprite
  scale?: number
  flip?: boolean
  className?: string
  label?: string
}

/** Renders a pixel sprite as a crisp, scaled <img>. Decorative unless a label is given. */
export function PixelSprite({ sprite, scale = 3, flip = false, className, label }: Props) {
  const src = useMemo(() => (typeof document === 'undefined' ? '' : spriteUrl(sprite, flip)), [sprite, flip])
  return (
    <img
      src={src}
      width={sprite.w * scale}
      height={sprite.h * scale}
      className={['pixel-sprite', className].filter(Boolean).join(' ')}
      alt={label ?? ''}
      aria-hidden={label ? undefined : true}
      draggable={false}
    />
  )
}
