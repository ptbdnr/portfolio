import nodemailer from 'nodemailer'
import { TOPIC_LABELS } from '../shared/contact.ts'
import type { Config } from './config.ts'
import type { StoredMessage } from './store.ts'

export interface Mailer {
  readonly enabled: boolean
  send(message: StoredMessage): Promise<void>
}

const oneLine = (value: string) => value.replace(/[\r\n\t]+/g, ' ').trim()

export function formatEmail(message: StoredMessage) {
  const topic = TOPIC_LABELS[message.topic]
  return {
    subject: `[Summit book] ${topic} — ${oneLine(message.name).slice(0, 80)}`,
    text: [
      `New entry in the summit book (${message.receivedAt})`,
      '',
      `Name:  ${oneLine(message.name)}`,
      `Email: ${message.email}`,
      `Topic: ${topic}`,
      '',
      message.message,
      '',
      '—',
      `id: ${message.id}`,
    ].join('\n'),
  }
}

export function createMailer(config: Config): Mailer {
  const { smtp, contactTo } = config
  if (!smtp || !contactTo) {
    return {
      enabled: false,
      async send() {},
    }
  }
  const transport = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : undefined,
  })
  return {
    enabled: true,
    async send(message) {
      const { subject, text } = formatEmail(message)
      await transport.sendMail({
        from: smtp.from,
        to: contactTo,
        replyTo: { name: oneLine(message.name), address: message.email },
        subject,
        text,
      })
    },
  }
}
