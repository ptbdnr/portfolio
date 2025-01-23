import SectionItem from './SectionItem'

export default function WorkSection() {
  const workItems = [
    {
      title: 'Senior Research Scientist',
      subtitle: 'Amazon',
      period: 'Dec 2013 - Sep 2022',
      description: 'Played a pivotal role in launching 50+ Amazon distribution centers, optimizing facility locations and service coverage to achieve profitability within 4 years in a mature market. Led the development of a $75M-saving predictive customer demand model and an $11M-saving optimization model to reduce unproductive driving time. Enabled same-day delivery in the UK through strategic network optimization, while managing and growing a team of 7 data scientists to EU-wide scope. Delivered highly accurate forecasts (5.6% MAPE) using MLOps and a serverless AWS stack, developed a custom AI SaaS platform supporting 1,000 users, and automated planning tasks while maintaining high-quality software pipelines.',
      skills: ['Python', 'AWS', 'Machine Learning']
    }
    // Add more work items as needed
  ]

  return (
    <section className="mb-16" id="work">
      <h2>Work</h2>
      {workItems.map((item, index) => (
        <SectionItem key={index} {...item} />
      ))}
    </section>
  )
} 