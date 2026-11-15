import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { ContactFieldErrors, ContactInput } from '../../../shared/contact.ts'
import { CONTACT_TOPICS, TOPIC_LABELS, type ContactTopic } from '../../../shared/contactTopics.ts'
import { chatTopics, profile } from '../../content/profile.ts'
import { STAGES } from '../../game/engine/world.ts'
import { api } from '../../lib/api.ts'
import { sfx } from '../../lib/sfx.ts'
import { game, useGame } from '../../lib/store.ts'

type Phase = 'idle' | 'sending' | 'sent' | 'failed'
type Values = { name: string; email: string; topic: ContactTopic; message: string; website: string }

const EMPTY: Values = { name: '', email: '', topic: 'hello', message: '', website: '' }
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Remounted (via `key`) for every attempt, so the progress always starts from zero. */
function Modem({ phase, error }: { phase: Phase; error: string }) {
  const [step, setStep] = useState(0)
  useEffect(() => {
    if (phase !== 'sending') return
    const id = setInterval(() => setStep((s) => Math.min(s + 1, 12)), 170)
    return () => clearInterval(id)
  }, [phase])
  const bar = '█'.repeat(Math.min(10, Math.max(0, step - 2))).padEnd(10, '░')
  return (
    <div className="modem" role="status" aria-live="polite">
      <pre>
        {'ATDT 0036 1 2400\n'}
        {step > 0 || phase !== 'sending' ? 'CONNECT 2400\n' : ''}
        {phase === 'sending' ? `SENDING [${bar}]` : ''}
        {phase === 'sent' ? `SENDING [${'█'.repeat(10)}]\n\nMESSAGE DELIVERED. OK\n` : ''}
        {phase === 'failed' ? `\nNO CARRIER\n` : ''}
      </pre>
      {phase === 'failed' && <p className="modem__error">{error}</p>}
    </div>
  )
}

export function SummitBook() {
  const [values, setValues] = useState<Values>(EMPTY)
  const [errors, setErrors] = useState<ContactFieldErrors>({})
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const startedAt = useRef(0)
  const formRef = useRef<HTMLFormElement>(null)
  const reduced = useGame((s) => s.reducedMotion)

  useEffect(() => {
    startedAt.current = Date.now()
  }, [])

  const update = (key: keyof Values) => (e: { target: { value: string } }) =>
    setValues((v) => ({ ...v, [key]: e.target.value }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (phase === 'sending') return
    const input: ContactInput = { ...values, startedAt: startedAt.current }
    const { contactSchema } = await import('../../../shared/contact.ts')
    const { flattenError } = await import('zod')
    const parsed = contactSchema.safeParse(input)
    if (!parsed.success) {
      const fieldErrors = flattenError(parsed.error).fieldErrors as ContactFieldErrors
      setErrors(fieldErrors)
      const first = Object.keys(fieldErrors)[0]
      formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus()
      sfx.play('error')
      return
    }
    setErrors({})
    setAttempt((a) => a + 1)
    setPhase('sending')
    sfx.play('modem')
    const minimum = wait(reduced ? 0 : 2300)
    try {
      const res = await api.contact(input)
      await minimum
      if (res.ok) {
        setPhase('sent')
        sfx.play('fanfare')
        game.badge('messenger')
      } else {
        setErrors(res.fieldErrors ?? {})
        setError(res.error)
        setPhase('failed')
        sfx.play('error')
      }
    } catch {
      await minimum
      setError('The line went dead before the message got through.')
      setPhase('failed')
      sfx.play('error')
    }
  }

  const mailto = profile.email
    ? `mailto:${profile.email}?subject=${encodeURIComponent(`[Summit book] ${TOPIC_LABELS[values.topic]}`)}&body=${encodeURIComponent(values.message)}`
    : ''

  const fieldError = (key: keyof ContactFieldErrors) =>
    errors[key]?.length ? (
      <span className="field__error" id={`err-${key}`}>
        {errors[key]![0]}
      </span>
    ) : null

  return (
    <section id="contact" className="stage" data-stage={STAGES.contact} aria-labelledby="book-title">
      <div className="panel panel--paper stage__panel summitbook" data-solid>
        <div className="summitbook__stamp" aria-hidden="true">
          <span>VETTA</span>
          <b>4061</b>
          <span>LIBRO</span>
        </div>
        <p className="kicker summitbook__kicker">Contact me · the summit book</p>
        <h2 id="book-title" className="pixel-title">
          Say hello
        </h2>
        <p>
          Many summits have a little metal box with a book inside for climbers to sign. This is mine. A hello, a question,
          an idea — I read every message and reply personally.
        </p>
        <div className="summitbook__topics">
          <b>Always happy to chat about:</b>
          <ul>
            {chatTopics.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>

        {phase === 'sent' ? (
          <div className="summitbook__done">
            <Modem phase={phase} error="" />
            <p>Thank you, {values.name.split(' ')[0] || 'friend'}! Your message is on its way — I’ll get back to you soon.</p>
            <button
              type="button"
              className="btn btn--small"
              onClick={() => {
                setValues(EMPTY)
                startedAt.current = Date.now()
                setPhase('idle')
              }}
            >
              Write another
            </button>
          </div>
        ) : (
          <form ref={formRef} className="summitbook__form" onSubmit={submit} noValidate>
            <div className="field">
              <label htmlFor="sb-name">Your name</label>
              <input
                id="sb-name"
                name="name"
                autoComplete="name"
                value={values.name}
                onChange={update('name')}
                aria-invalid={Boolean(errors.name)}
                aria-describedby={errors.name ? 'err-name' : undefined}
                maxLength={100}
                required
              />
              {fieldError('name')}
            </div>
            <div className="field">
              <label htmlFor="sb-email">Your email</label>
              <input
                id="sb-email"
                name="email"
                type="email"
                autoComplete="email"
                value={values.email}
                onChange={update('email')}
                aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? 'err-email' : undefined}
                maxLength={200}
                required
              />
              {fieldError('email')}
            </div>
            <div className="field field--full">
              <label htmlFor="sb-topic">What’s it about?</label>
              <select id="sb-topic" name="topic" value={values.topic} onChange={update('topic')}>
                {CONTACT_TOPICS.map((t) => (
                  <option key={t} value={t}>
                    {TOPIC_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
            <div className="field field--full">
              <label htmlFor="sb-message">Message</label>
              <textarea
                id="sb-message"
                name="message"
                rows={6}
                value={values.message}
                onChange={update('message')}
                aria-invalid={Boolean(errors.message)}
                aria-describedby={errors.message ? 'err-message' : undefined}
                maxLength={5000}
                required
              />
              {fieldError('message')}
            </div>
            {/* Honeypot: hidden from people, irresistible to bots. */}
            <div className="field--trap" aria-hidden="true">
              <label htmlFor="sb-website">Website</label>
              <input id="sb-website" name="website" tabIndex={-1} autoComplete="off" value={values.website} onChange={update('website')} />
            </div>
            <div className="summitbook__actions field--full">
              <button type="submit" className="btn" disabled={phase === 'sending'}>
                {phase === 'sending' ? 'Sending…' : 'Send message'}
              </button>
              {mailto && (
                <a className="summitbook__mailto" href={mailto}>
                  or send an email instead
                </a>
              )}
            </div>
            {(phase === 'sending' || phase === 'failed') && (
              <div className="field--full">
                <Modem key={attempt} phase={phase} error={error} />
              </div>
            )}
          </form>
        )}
      </div>
    </section>
  )
}
