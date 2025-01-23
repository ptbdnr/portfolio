interface SectionItemProps {
  title: string
  subtitle?: string
  organization?: string
  period?: string
  description: string
  skills: string[]
}

export default function SectionItem({ 
  title, 
  subtitle, 
  organization,
  period, 
  description,
  skills 
}: SectionItemProps) {
  return (
    <div className="mb-8 p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50 
      border-2 border-transparent hover:border-gray-200 dark:hover:border-gray-700
      hover:bg-gray-100 dark:hover:bg-gray-800/80 
      transition-all duration-200">
      <h3>{title}{subtitle && ` - ${subtitle}`}</h3>
      {organization && <p>{organization}</p>}
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