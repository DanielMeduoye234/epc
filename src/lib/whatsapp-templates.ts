export type WhatsAppTemplateCategory = 'UTILITY' | 'MARKETING';

export type RecommendedTemplate = {
  name: string;
  label: string;
  description: string;
  category: WhatsAppTemplateCategory;
  language: string;
  body: string;
  example: [string, string];
  messageType: 'reminder' | 'event' | 'prayer';
};

/** WhatsApp template names must be lowercase letters, numbers, and underscores. */
export const RECOMMENDED_TEMPLATES: RecommendedTemplate[] = [
  {
    name: 'epc_sunday_announcement',
    label: 'Sunday announcement',
    description: 'Weekly service reminder and Sunday notices.',
    category: 'UTILITY',
    language: 'en_US',
    body: 'Hello {{1}}, this is a reminder from Everything by Prayer Church. Sunday details: {{2}} We look forward to seeing you. God bless you.',
    example: ['Grace', 'Sunday service starts at 9:00 AM at the church auditorium.'],
    messageType: 'reminder',
  },
  {
    name: 'epc_special_event',
    label: 'Special events',
    description: 'Conferences, vigils, programmes, and other gatherings.',
    category: 'MARKETING',
    language: 'en_US',
    body: 'Hello {{1}}, Everything by Prayer Church has an upcoming event. Details: {{2}} We would love you to join us.',
    example: ['Grace', 'Night of Prayer, Friday 7pm at the main auditorium.'],
    messageType: 'event',
  },
  {
    name: 'epc_church_prayer',
    label: 'Church prayers',
    description: 'Prayer points and prayer broadcasts to the church.',
    category: 'UTILITY',
    language: 'en_US',
    body: 'Hello {{1}}, here is a prayer from Everything by Prayer Church: {{2}} Amen.',
    example: ['Grace', 'Father, we thank You for Your peace and protection over our families this week.'],
    messageType: 'prayer',
  },
];

export function templateNameForMessageType(messageType: string): string {
  const match = RECOMMENDED_TEMPLATES.find((t) => t.messageType === messageType);
  return match?.name || RECOMMENDED_TEMPLATES[0].name;
}

export function sanitizeTemplateParam(value: string): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, 1024) || '-';
}
