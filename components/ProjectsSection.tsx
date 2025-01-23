import SectionItem from './SectionItem'

export default function ProjectsSection() {
  const projectItems = [
    {
      title: '[Project Title]',
      subtitle: '[Client/Company]',
      description: '[Project Description]',
      skills: ['Technology 1', 'Technology 2']
    }
    // Add more project items as needed
  ]

  return (
    <section className="mb-16" id="projects">
      <h2>Projects</h2>
      {projectItems.map((item, index) => (
        <SectionItem key={index} {...item} />
      ))}
    </section>
  )
} 