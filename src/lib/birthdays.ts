export function createBirthdayMessage(fullName: string) {
  const firstName = fullName.trim().split(/\s+/)[0] || 'beloved';
  return [
    `Happy birthday, ${firstName}!`,
    ``,
    `Today we thank God for your life and pray that this new year brings you deeper joy, strength, grace, and increase on every side. You are loved and celebrated by the EPC family.`,
    ``,
    `-- Bishop Alex Kofi Opata`,
  ].join('\n');
}

export function birthdayDateForYear(birthday: string, year = new Date().getFullYear()) {
  const [, month, day] = birthday.split('-');
  return `${year}-${month}-${day}`;
}

export function isBirthdayToday(birthday: string, now = new Date()) {
  const date = new Date(`${birthday}T00:00:00`);
  return date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
}

export function nextBirthdayDate(birthday: string, now = new Date()) {
  const date = new Date(`${birthday}T00:00:00`);
  const next = new Date(now.getFullYear(), date.getMonth(), date.getDate());
  if (next < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
    next.setFullYear(now.getFullYear() + 1);
  }
  return next;
}