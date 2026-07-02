import Link from 'next/link'
import ScrambleText from '@/components/ScrambleText'
import Chat from '@/components/Chat'
import ContactSection from '@/components/ContactSection'
import { currentUser } from '@/lib/auth'

export default async function Home() {
  const authed = !!(await currentUser())
  return (
    <main className="max-w-[1200px] mx-auto p-8">
      <section className="mb-12">
        <h1 className="text-4xl font-bold mb-3">
          Hi, I&apos;m{' '}
          <ScrambleText
            text="Peter Bodnar"
            className="text-blue-600 font-bold relative"
            style={{
              textShadow:
                '0 0 10px rgba(37, 99, 235, 0.5), 0 0 20px rgba(37, 99, 235, 0.3)',
            }}
          />
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-300">
          ML/AI Engineer focused on GenAI, recommendation systems, and
          optimization. Ask the assistant below, or read more{' '}
          <Link href="/about" className="text-blue-600 hover:underline">
            about me
          </Link>
          .
        </p>
      </section>

      <Chat authed={authed} />
      <ContactSection />
    </main>
  )
}
