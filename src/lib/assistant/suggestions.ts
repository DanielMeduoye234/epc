import type { UserRole } from '@/lib/types';

export function suggestionsForRole(role: UserRole): string[] {
  if (role === 'recorder') {
    return ['How do I record a new believer?', 'What is a first timer?', 'How many first timers do we have?'];
  }
  if (role === 'shepherd') {
    return ['How do I mark attendance?', 'Who is flagged?', 'How do I log a follow-up?'];
  }
  return ['Give me a branch snapshot', 'How do I invite a shepherd?', 'Upcoming birthdays'];
}
