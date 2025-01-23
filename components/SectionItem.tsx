interface SectionItemProps {
  title: string
  subtitle?: string
  period?: string
  description: string
  skills: string[]
}

export default function SectionItem({ 
  title, 
  subtitle, 
  period, 
  description, 
  skills 
}: SectionItemProps) {
  return (
    <div className="mb-8 p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50 transition-colors duration-200">
      <h4>{title}{subtitle && ` - ${subtitle}`}</h4>
      {period && <p>{period}</p>}
      <p>{description}</p>
      <div className="flex flex-wrap gap-4 mt-4">
        {skills.map((skill, index) => (
          <span 
            key={index} 
            className="px-3 py-1 rounded-full bg-gray-200 dark:bg-gray-700 
              text-sm transition-colors duration-200"
          >
            {skill}
          </span>
        ))}
      </div>
    </div>
  )
} 