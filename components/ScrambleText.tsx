'use client'

import { useEffect, useState } from 'react'

const characters = '!@#$%^&*()_+{}[]|;:,.<>?/~`₿¢€£¥§©®™⚡☆★⚔️✨⭐️'

interface ScrambleTextProps {
  text: string
  className?: string
  style?: React.CSSProperties
}

export default function ScrambleText({ text, className = '', style }: ScrambleTextProps) {
  const [displayText, setDisplayText] = useState('')
  const [isAnimating, setIsAnimating] = useState(false)

  useEffect(() => {
    if (isAnimating) return

    setIsAnimating(true)
    let currentIndex = 0
    let iteration = 0
    const maxIterations = 3 // How many times each letter should scramble

    const interval = setInterval(() => {
      setDisplayText(prev => {
        const randomChar = characters[Math.floor(Math.random() * characters.length)]
        const currentChar = text[currentIndex]
        
        // Build the text with current progress
        return text.split('')
          .map((char, index) => {
            if (index < currentIndex) {
              return char // Already revealed characters
            } else if (index === currentIndex) {
              return iteration >= maxIterations ? currentChar : randomChar
            }
            return '' // Not yet revealed characters
          })
          .join('')
      })

      // Increment counters
      if (iteration >= maxIterations) {
        iteration = 0
        currentIndex++
      } else {
        iteration++
      }

      // Stop when we've revealed all characters
      if (currentIndex >= text.length) {
        clearInterval(interval)
        setIsAnimating(false)
      }
    }, 50) // Adjust speed here

    return () => clearInterval(interval)
  }, [text])

  return <span className={className} style={style}>{displayText}</span>
} 