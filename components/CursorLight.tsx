'use client'

import { useEffect, useState } from 'react'

interface Position {
  x: number
  y: number
}

interface GradientStyles {
  background: string
}

export default function CursorLight() {
  const [position, setPosition] = useState<Position>({ x: 0, y: 0 })

  useEffect((): (() => void) => {
    const handleMouseMove = (e: MouseEvent): void => {
      setPosition({ x: e.clientX, y: e.clientY })
    }

    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  const lightColor: string = 'rgba(59, 130, 246, 0.2)' // Blue light for dark mode

  const primaryStyle: GradientStyles = {
    background: `radial-gradient(600px at ${position.x}px ${position.y}px, 
      ${lightColor}, 
      transparent 80%)`
  }

  const secondaryStyle: GradientStyles = {
    background: `radial-gradient(800px at ${position.x}px ${position.y}px, 
      'rgba(96, 165, 250, 0.1)', 
      transparent 80%)`
  }

  return (
    <>
      {/* Primary light */}
      <div
        className="pointer-events-none fixed inset-0 z-30 transition-all duration-200"
        style={primaryStyle}
      />
      {/* Secondary glow */}
      <div
        className="pointer-events-none fixed inset-0 z-20 transition-all duration-200"
        style={secondaryStyle}
      />
      {/* Subtle ambient light */}
      <div
        className="pointer-events-none fixed inset-0 z-10 opacity-30"
        style={{
          background: `radial-gradient(1200px at ${position.x}px ${position.y}px, 
            rgba(56, 189, 248, 0.03), 
            transparent 80%)`
        }}
      />
    </>
  )
} 