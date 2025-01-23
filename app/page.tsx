import Navbar from '@/components/Navbar'
import Intro from '@/components/Intro'
import WorkSection from '@/components/WorkSection'
import PatentsSection from '@/components/PatentsSection'
import ProjectsSection from '@/components/ProjectsSection'
import ContactSection from '@/components/ContactSection'
import CursorLight from '@/components/CursorLight'

export default function Home() {
  return (
    <>
      <CursorLight />
      <main className="max-w-[1200px] mx-auto p-8">
        <Navbar />
        <Intro />
        <WorkSection />
        {/* <PatentsSection /> */}
        <ProjectsSection />
        <ContactSection />
      </main>
    </>
  )
}
