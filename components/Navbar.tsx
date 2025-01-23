import Link from 'next/link'

export default function Navbar() {
  return (
    <nav className="mb-8">
      <Link href="#about" className="mr-4 text-blue-600 no-underline">About</Link>
      <Link href="#work" className="mr-4 text-blue-600 no-underline">Work</Link>
      {/* <Link href="#projects" className="mr-4 text-blue-600 no-underline">Projects</Link> */}
      <Link href="#education" className="mr-4 text-blue-600 no-underline">Education</Link>
      <Link href="#contact" className="mr-4 text-blue-600 no-underline">Contact</Link>
    </nav>
  )
} 