import { styles } from '@/styles/common'
import { FaLinkedin, FaGithub } from 'react-icons/fa'

export default function ContactSection() {
  return (
    <section className="mb-16" id="contact">
      <h2 className={styles.sectionTitle}>Get in Touch</h2>
      <p>If you'd like to get in touch feel free to contact me below!</p>
      
      <div className="flex gap-6 mt-4">
        <a
          href="https://www.linkedin.com/in/peterbodnar/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-3xl hover:text-blue-500 transition-colors"
        >
          <FaLinkedin />
        </a>
        <a
          href="https://github.com/ptbdnr"
          target="_blank"
          rel="noopener noreferrer"
          className="text-3xl hover:text-gray-600 transition-colors"
        >
          <FaGithub />
        </a>
      </div>
    </section>
  )
} 