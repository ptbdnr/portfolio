import SectionItem from './SectionItem'

export default function PatentsSection() {
  const patentItems = [
    {
      title: '[Patent Title]',
      period: '[Year]',
      description: '[Patent Description]',
      skills: ['Technology 1', 'Technology 2']
    }
    // Add more patent items as needed
  ]

  return (
    <section className="mb-16" id="patents">
      <h2>Patents</h2>
      {patentItems.map((item, index) => (
        <SectionItem key={index} {...item} />
      ))}
    </section>
  )
} 