import Link from 'next/link'
import { Suspense } from 'react'
import AuthStatus from '@/components/AuthStatus'

export default function Navbar() {
  return (
    <nav className="mb-8 flex items-center flex-wrap">
      <Link href="#about" className="mr-4 text-blue-600 no-underline">About</Link>
      <Link href="#work" className="mr-4 text-blue-600 no-underline">Work</Link>
      {/* <Link href="#projects" className="mr-4 text-blue-600 no-underline">Projects</Link> */}
      <Link href="#education" className="mr-4 text-blue-600 no-underline">Education</Link>
      <Link href="#contact" className="mr-4 text-blue-600 no-underline">Contact</Link>
      <span className="ml-auto">
        <Suspense fallback={null}>
          <AuthStatus />
        </Suspense>
      </span>
    </nav>
  )
}