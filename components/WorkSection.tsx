import SectionItem from './SectionItem'
import { styles } from '@/styles/common'
export default function WorkSection() {
  const workItems = [
    {
        title: 'Lead AI Engineer',
        organization: 'Kainos',
        period: 'Sept 2022 - current',
        description: 'Spearheaded the deployment of LLMs in production, integrating custom information retrieval frameworks with vector databases and semantic search, enhancing processes for 60,000 front-line workers. Optimized workflows to achieve 71% cost savings and 3.7x speed improvements, while deploying Speech-to-Text and Image-to-Text solutions using OpenAI Whisper, Azure Speech Services, and Azure AI tools. Led experiments for automated NLP solutions, achieving 93% accuracy in PII redaction. Directed customer engagements, including design, development, and deployment, as well as government bidding (£15M+) and commercial presales (£950K). Delivered FMOps and LLM training, mentored AI teams, and supported diverse client capabilities, earning 6 financial awards and 38 accolades for technical leadership in a dynamic environment.',
        skills: ['Python', 'TypeScript', 'Azure', 'Docker', 'AI', 'LLMOps', 'RAG', 'Vector Search', 'Fine-Tuning', 'MLFlow', 'Airflow', 'vLLM', 'FastAPI', 'Playwright']
    },
    {
      title: 'Senior Research Scientist',
      organization: 'Amazon',
      period: 'Dec 2013 - Sep 2022',
      description: 'Played a pivotal role in launching 50+ Amazon distribution centers, optimizing facility locations and service coverage to achieve profitability within 4 years in a mature market. Led the development of a $75M-saving predictive customer demand model and an $11M-saving optimization model to reduce unproductive driving time. Enabled same-day delivery in the UK through strategic network optimization, while managing and growing a team of 7 data scientists to EU-wide scope. Delivered highly accurate forecasts (5.6% MAPE) using MLOps and a serverless AWS stack, developed a custom AI SaaS platform supporting 1,000 users, and automated planning tasks while maintaining high-quality software pipelines.',
      skills: ['Python', 'Java', 'AWS', 'Machine Learning', 'MLOps', 'Optimization', 'CPLEX', 'Prophet', 'Flask', 'Postman']
    }
    // Add more work items as needed
  ]

  return (
    <section className="mb-16" id="work">
      <h2 className={styles.sectionTitle}>Work</h2>
      {workItems.map((item, index) => (
        <SectionItem key={index} {...item} />
      ))}
    </section>
  )
} 