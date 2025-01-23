'use client'

import { useEffect, useState, useRef, useCallback } from 'react'

const characters = [
    // latin capital letters
    'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 
    // accentuated latin capital letters
    '\u00C1', '\u00C9', '\u00CD', '\u00D3', '\u00DA', '\u00DC', '\u00E1', '\u00E9', '\u00ED', '\u00F3', '\u00FA', '\u00FC', '\u0160', '\u0161', '\u00E8', '\u017E', '\u00F4', '\u00F2', '\u00E5', '\u00E4', '\u00F8', '\u00F6', '\u00D8', '\u00D6', '\u00D5', '\u00FB', '\u00DB', '\u00BE', '\u00BC', '\u00EA', '\u00C6', '\u00E6', '\u00CC', '\u00EC', '\u00C8', '\u017D', '\u00DD', '\u00D2', '\u00C5',
    // punctuations
    '@', '#', '$', '%', '^', '&', '(', ')', '+', '{', '}', '[', ']', '|', ';', ':', '<', '>', '?', '/', '₿', '¢', '€', '£', '¥', '§', '©', '®',
    // greek capital letters
    '\u0391', '\u0392', '\u0393', '\u0394', '\u0395', '\u0396', '\u0397', '\u0398', '\u0399', '\u039A', '\u039B', '\u039C', '\u039D', '\u039E', '\u039F', '\u03A0', '\u03A1', '\u03A3', '\u03A4', '\u03A5', '\u03A6', '\u03A7', '\u03A8', '\u03A9',
]

interface ScrambleTextProps {
  text: string
  className?: string
  style?: React.CSSProperties
}

export default function ScrambleText({ text, className = '', style }: ScrambleTextProps) {
  const [scrambledText, setScrambledText] = useState(text)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const iterationsRef = useRef(0)

  const startScramble = useCallback(() => {
    // Reset iterations
    iterationsRef.current = 0
    
    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }

    // Start new scramble interval
    intervalRef.current = setInterval(() => {
      iterationsRef.current += 1
      
      if (iterationsRef.current >= 20) {
        clearInterval(intervalRef.current!)
        setScrambledText(text)
        return
      }

      setScrambledText(text
        .split('')
        .map((char, idx) => {
          if (iterationsRef.current / 20 > idx / text.length) {
            return char
          }
          return characters[Math.floor(Math.random() * characters.length)]
        })
        .join('')
      )
    }, 50)
  }, [text])

  useEffect(() => {
    startScramble()
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [text, startScramble])

  return <span className={`cursor-pointer ${className}`} style={style} onMouseEnter={startScramble}>{scrambledText}</span>
} 