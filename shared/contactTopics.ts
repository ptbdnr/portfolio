export const CONTACT_TOPICS = ['hello', 'work', 'speaking', 'mountains', 'other'] as const
export type ContactTopic = (typeof CONTACT_TOPICS)[number]

export const TOPIC_LABELS: Record<ContactTopic, string> = {
  hello: 'Just saying hello',
  work: 'Work or a project',
  speaking: 'Talks, writing or mentoring',
  mountains: 'Mountains, routes & ski touring',
  other: 'Something else',
}
