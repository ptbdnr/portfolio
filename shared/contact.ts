import { z } from 'zod'
import { CONTACT_TOPICS } from './contactTopics.ts'

export { CONTACT_TOPICS, TOPIC_LABELS, type ContactTopic } from './contactTopics.ts'

/** Shared by the summit-book form (client) and POST /api/contact (server). */
export const contactSchema = z.object({
  name: z.string().trim().min(1, 'Please tell me your name').max(100, 'That name is a bit long'),
  email: z
    .string()
    .trim()
    .max(200, 'That email is a bit long')
    .pipe(z.email('That email address looks off')),
  topic: z.enum(CONTACT_TOPICS),
  message: z
    .string()
    .trim()
    .min(10, 'A few more words, please (10+ characters)')
    .max(5000, 'Please keep it under 5000 characters'),
  // Honeypot: real visitors never see or fill this field.
  website: z.string().max(500).optional(),
  // When the form was first rendered (ms since epoch), used as a simple bot time-trap.
  startedAt: z.number().int().nonnegative().optional(),
})

export type ContactInput = z.input<typeof contactSchema>
export type ContactMessage = z.output<typeof contactSchema>
export type ContactFieldErrors = Partial<Record<keyof ContactInput, string[]>>

export type ContactResponse =
  | { ok: true; id: string }
  | { ok: false; error: string; fieldErrors?: ContactFieldErrors }
