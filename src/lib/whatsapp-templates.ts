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

/** WhatsApp template names must be lowercase letters, numbers, and underscores for Cloud API. */
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

/** Direct Click-to-Chat (wa.me) Quick Message Templates */
export type QuickMessageTemplate = {
  id: string;
  title: string;
  category: 'welcome' | 'reminder' | 'event' | 'care' | 'custom';
  appliesTo?: 'all' | 'new_believer' | 'first_timer' | 'member';
  subject: string;
  body: string;
  defaultImageUrl?: string;
};

export const QUICK_MESSAGE_TEMPLATES: QuickMessageTemplate[] = [
  {
    id: 'new_believer_welcome',
    title: 'New Believer Welcome',
    category: 'welcome',
    appliesTo: 'new_believer',
    subject: 'Welcome to the Family of God!',
    body: `Hello {first_name}! 🌟

We are celebrating your wonderful decision to give your life to Jesus Christ! Welcome to the family of God and the Everything by Prayer Church community.

We are here to support, pray for, and walk with you in this exciting spiritual journey. Please let us know if you have any prayer requests or questions.

God bless you richly!
- Everything by Prayer Church`,
  },
  {
    id: 'first_timer_appreciation',
    title: 'First-Timer Appreciation',
    category: 'welcome',
    appliesTo: 'first_timer',
    subject: 'Thank you for worshipping with us!',
    body: `Hello {first_name}! 🙏

Thank you so much for joining us for worship at Everything by Prayer Church. It was truly an honour having you in our midst!

We pray that you felt the presence and love of God during the service. We would love to see you again this coming Sunday!

Warm regards,
- Everything by Prayer Church`,
  },
  {
    id: 'sunday_service_reminder',
    title: 'Sunday Service Reminder',
    category: 'reminder',
    appliesTo: 'all',
    subject: 'Join us this Sunday!',
    body: `Hello {first_name}! 🕊️

We are looking forward to worshipping together this Sunday at Everything by Prayer Church!

📍 Service Time: 9:00 AM
📖 Come expectant for a mighty move of the Holy Spirit, powerful worship, and life-transforming Word.

We can't wait to see you there! God bless you.`,
  },
  {
    id: 'midweek_service_reminder',
    title: 'Midweek Prayer Service',
    category: 'reminder',
    appliesTo: 'all',
    subject: 'Midweek Prayer & Bible Study',
    body: `Hello {first_name}! 📖🔥

Don't miss our Midweek Prayer & Bible Study this Wednesday! It's going to be a refreshing time in God's presence and Word.

Come with your family and loved ones.
- Everything by Prayer Church`,
  },
  {
    id: 'pastoral_checkup',
    title: 'Pastoral Check-up & Care',
    category: 'care',
    appliesTo: 'all',
    subject: 'Checking in on you',
    body: `Hello {first_name}! ☀️

Just wanted to check in on you and see how your week is going. We are keeping you in our prayers and believing God for great doors of favor to open in your life.

If there's anything you'd like us to pray with you about, please feel free to reply!

Grace and peace to you,
- Everything by Prayer Church`,
  },
  {
    id: 'event_invitation',
    title: 'Special Event & Flyer',
    category: 'event',
    appliesTo: 'all',
    subject: 'Special Event Invitation',
    body: `Hello {first_name}! 🎉

You are specially invited to our upcoming church programme at Everything by Prayer Church!

Check out the details on the flyer. Bring your friends and family along for an unforgettable encounter!

See you there!`,
  },
];

/** Format raw phone number into pure international digits for wa.me */
export function cleanWhatsAppNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0')) {
    return `234${digits.slice(1)}`;
  }
  return digits;
}

/** Replace template variables like {name}, {first_name}, {branch} */
export function fillMessageTemplate(
  template: string,
  data: {
    name: string;
    branchName?: string;
    shepherdName?: string;
    customNote?: string;
  }
): string {
  const fullName = data.name.trim() || 'Beloved';
  const firstName = fullName.split(' ')[0] || fullName;
  const branch = data.branchName || 'Everything by Prayer Church';
  const shepherd = data.shepherdName || 'Your Shepherd';
  const note = data.customNote || '';

  return template
    .replace(/\{name\}/gi, fullName)
    .replace(/\{first_name\}/gi, firstName)
    .replace(/\{branch\}/gi, branch)
    .replace(/\{church\}/gi, branch)
    .replace(/\{shepherd\}/gi, shepherd)
    .replace(/\{note\}/gi, note);
}

/** Build standard wa.me URL */
export function buildWhatsAppUrl(phoneNumber: string, message: string, imageUrl?: string): string {
  const cleanedPhone = cleanWhatsAppNumber(phoneNumber);
  let finalMessage = message.trim();

  if (imageUrl && imageUrl.trim()) {
    finalMessage += `\n\n📷 Flyer: ${imageUrl.trim()}`;
  }

  const encoded = encodeURIComponent(finalMessage);
  return `https://wa.me/${cleanedPhone}?text=${encoded}`;
}
