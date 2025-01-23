import ScrambleText from './ScrambleText'

export default function Intro() {
  return (
    <div className="mb-12">
      <h1>
        Hi, I'm{' '}
        <ScrambleText 
          text="Peter Bodnar" 
          className="text-blue-600 font-bold relative"
          style={{
            textShadow: '0 0 10px rgba(37, 99, 235, 0.5), 0 0 20px rgba(37, 99, 235, 0.3)'
          }}
        />
      </h1>
      <h2>I'm an ML Engineer, with a focus on GenAI, Recommendation Systems, and Optimization</h2>
      <p>ML/AI Engineer with 10yr+ of experience specialising in the design, development, and deployment of bespoke AI and ML solutions with modern MLOps and LLMOps practices. Demonstrated strong track record in independent software development, system integration, and technical lead roles; delivering design, technical research, custom algorithms, and production systems.</p>
    </div>
  )
} 