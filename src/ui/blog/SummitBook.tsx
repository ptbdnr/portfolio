/** Contact: the summit book. Many summits have a box with a book inside for climbers to sign. */
import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { ContactFieldErrors, ContactInput } from '../../../shared/contact.ts'
import { CONTACT_TOPICS, TOPIC_LABELS, type ContactTopic } from '../../../shared/contactTopics.ts'
import { chatTopics, profile } from '../../content/profile.ts'
import { api } from '../../lib/api.ts'
import { game } from '../../lib/store.ts'
import { sound } from '../engineContext.ts'

type Phase = 'idle' | 'sending' | 'sent' | 'failed'
type Values = { name: string; email: string; topic: ContactTopic; message: string; website: string }

const EMPTY: Values = { name: '', email: '', topic: 'hello', message: '', website: '' }

export function SummitBook() {
  const [values, setValues] = useState<Values>(EMPTY)
  const [errors, setErrors] = useState<ContactFieldErrors>({})
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState('')
  const startedAt = useRef(0)
  const form = useRef<HTMLFormElement>(null)

  useEffect(() => {
    startedAt.current = Date.now()
  }, [])

  const update = (key: keyof Values) => (e: { target: { value: string } }) => setValues((v) => ({ ...v, [key]: e.target.value }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (phase === 'sending') return
    const input: ContactInput = { ...values, startedAt: startedAt.current }
    const [{ contactSchema }, { flattenError }] = await Promise.all([import('../../../shared/contact.ts'), import('zod')])
    const parsed = contactSchema.safeParse(input)
    if (!parsed.success) {
      const fieldErrors = flattenError(parsed.error).fieldErrors as ContactFieldErrors
      setErrors(fieldErrors)
      form.current?.querySelector<HTMLElement>(`[name="${Object.keys(fieldErrors)[0]}"]`)?.focus()
      return
    }
    setErrors({})
    setPhase('sending')
    sound.ui('pen')
    try {
      const res = await api.contact(input)
      if (res.ok) {
        setPhase('sent')
        game.signed()
        sound.ui('chime')
      } else {
        setErrors(res.fieldErrors ?? {})
        setError(res.error)
        setPhase('failed')
      }
    } catch {
      setError('The message didn’t get through: the connection may have dropped.')
      setPhase('failed')
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

  if (phase === 'sent') {
    return (
      <div className="summit-book summit-book--done" role="status">
        <p className="summit-book__signed">Signed.</p>
        <p>Thank you, {values.name.split(' ')[0] || 'friend'}! Your message is in the book. I read every one, and I’ll get back to you.</p>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => {
            setValues(EMPTY)
            setPhase('idle')
            startedAt.current = Date.now()
          }}
        >
          Write another
        </button>
      </div>
    )
  }

  return (
    <div className="summit-book">
      <p className="lead">Many summits have a little box with a book inside for climbers to sign. This is mine: a hello, a question, an idea. I read every message.</p>
      <div className="summit-book__topics">
        <b>Always happy to talk about:</b>
        <ul>
          {chatTopics.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </div>
      <form ref={form} className="form" onSubmit={submit} noValidate>
        <label className="field">
          <span>Your name</span>
          <input name="name" autoComplete="name" value={values.name} onChange={update('name')} aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? 'err-name' : undefined} />
          {fieldError('name')}
        </label>
        <label className="field">
          <span>Email, so I can reply</span>
          <input
            name="email"
            type="email"
            autoComplete="email"
            value={values.email}
            onChange={update('email')}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? 'err-email' : undefined}
          />
          {fieldError('email')}
        </label>
        <label className="field">
          <span>About</span>
          <select name="topic" value={values.topic} onChange={update('topic')}>
            {CONTACT_TOPICS.map((t) => (
              <option key={t} value={t}>
                {TOPIC_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Message</span>
          <textarea
            name="message"
            rows={6}
            value={values.message}
            onChange={update('message')}
            aria-invalid={Boolean(errors.message)}
            aria-describedby={errors.message ? 'err-message' : undefined}
          />
          {fieldError('message')}
        </label>
        {/* Real visitors never see this field; bots fill it in. */}
        <label className="field field--trap" aria-hidden="true">
          <span>Website</span>
          <input name="website" tabIndex={-1} autoComplete="off" value={values.website} onChange={update('website')} />
        </label>
        <div className="form__actions">
          <button type="submit" className="btn" disabled={phase === 'sending'}>
            {phase === 'sending' ? 'Signing…' : 'Sign the book'}
          </button>
          {mailto && (
            <a className="link-btn" href={mailto}>
              or send an email
            </a>
          )}
        </div>
        {phase === 'failed' && (
          <p className="form__error" role="alert">
            {error}
          </p>
        )}
        <p className="small">Your message is stored on my server and emailed to me. It isn’t shared with anyone, and there are no cookies on this site.</p>
      </form>
    </div>
  )
}
