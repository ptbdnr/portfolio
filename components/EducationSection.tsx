import SectionItem from './SectionItem'
import { styles } from '@/styles/common'

const EducationSection = () => {
    const educationItems = [
        {
            title: 'PhD in Operations Research',
            organization: 'Aarhus University',
            period: '2010 - 2013',
            description: 'Developed a new metaheuristic for a vehicle scheduling problem, and a new dynamic programming algorithm for a storage allocation problem',
            skills: ['C++', 'Combinatorial Optimization', 'MILP', 'Dynamic Programming', 'Metaheuristics', 'Simulation']
        }
    ]

  return (
    <section className="mb-16">
      <h2 className={styles.sectionTitle}>Education</h2>
      {educationItems.map((item, index) => (
        <SectionItem key={index} {...item} />
      ))}
    </section>
  )
}

export default EducationSection 