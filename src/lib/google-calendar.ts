import { createSign, randomUUID } from 'crypto';

interface CreateMeetEventOptions {
  pastorName: string;
  pastorEmail: string;
  memberName: string;
  memberEmail: string;
  scheduledDate: string;
  scheduledTime: string;
  topic: string;
  notes?: string | null;
}

interface GoogleTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

interface GoogleCalendarEventResponse {
  id?: string;
  htmlLink?: string;
  hangoutLink?: string;
  conferenceData?: {
    entryPoints?: Array<{ entryPointType?: string; uri?: string }>;
  };
  error?: {
    message?: string;
  };
}

function base64Url(input: string | Buffer) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function getPrivateKey() {
  return process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
}

function assertGoogleCalendarConfig() {
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = getPrivateKey();
  const calendarId = process.env.GOOGLE_CALENDAR_ID;

  if (!serviceAccountEmail || !privateKey || !calendarId) {
    throw new Error('Google Calendar is not configured. Set GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY, and GOOGLE_CALENDAR_ID.');
  }

  return { serviceAccountEmail, privateKey, calendarId };
}

async function getAccessToken() {
  const { serviceAccountEmail, privateKey } = assertGoogleCalendarConfig();
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload: Record<string, string | number> = {
    iss: serviceAccountEmail,
    scope: 'https://www.googleapis.com/auth/calendar.events',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };

  if (process.env.GOOGLE_WORKSPACE_IMPERSONATE_EMAIL) {
    payload.sub = process.env.GOOGLE_WORKSPACE_IMPERSONATE_EMAIL;
  }

  const unsignedToken = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(payload))}`;
  const signature = createSign('RSA-SHA256').update(unsignedToken).sign(privateKey);
  const assertion = `${unsignedToken}.${base64Url(signature)}`;

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  const body = await response.json() as GoogleTokenResponse;

  if (!response.ok || !body.access_token) {
    throw new Error(body.error_description || body.error || 'Google Calendar authentication failed.');
  }

  return body.access_token;
}

function addMinutesToTime(date: string, time: string, minutesToAdd: number) {
  const [hours, minutes] = time.split(':').map(Number);
  const [year, month, day] = date.split('-').map(Number);
  const start = new Date(year, (month || 1) - 1, day || 1, hours || 0, minutes || 0, 0, 0);
  const end = new Date(start.getTime() + minutesToAdd * 60_000);
  return {
    startDate: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`,
    startTime: `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`,
    endDate: `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`,
    endTime: `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`,
  };
}

export async function createGoogleMeetEvent(options: CreateMeetEventOptions) {
  const { calendarId } = assertGoogleCalendarConfig();
  const accessToken = await getAccessToken();
  const timeZone = process.env.GOOGLE_CALENDAR_TIME_ZONE || 'Africa/Accra';
  const duration = Number(process.env.COUNSELLING_SESSION_MINUTES || 60);
  const eventTime = addMinutesToTime(options.scheduledDate, options.scheduledTime, Number.isFinite(duration) ? duration : 60);

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?conferenceDataVersion=1&sendUpdates=all`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        summary: `EPC Guide Counselling: ${options.topic}`,
        description: [
          `Counselling session booked through EPC Guide.`,
          ``,
          `Pastor: ${options.pastorName}`,
          `Member: ${options.memberName}`,
          `Topic: ${options.topic}`,
          options.notes ? `Notes: ${options.notes}` : null,
        ].filter(Boolean).join('\n'),
        start: {
          dateTime: `${eventTime.startDate}T${eventTime.startTime}:00`,
          timeZone,
        },
        end: {
          dateTime: `${eventTime.endDate}T${eventTime.endTime}:00`,
          timeZone,
        },
        attendees: [
          { email: options.pastorEmail, displayName: options.pastorName },
          { email: options.memberEmail, displayName: options.memberName },
        ],
        conferenceData: {
          createRequest: {
            requestId: randomUUID(),
            conferenceSolutionKey: { type: 'hangoutsMeet' },
          },
        },
      }),
    }
  );

  const body = await response.json() as GoogleCalendarEventResponse;
  if (!response.ok) {
    throw new Error(body.error?.message || 'Google Calendar could not create the counselling meeting.');
  }

  const meetLink = body.hangoutLink || body.conferenceData?.entryPoints?.find((entry) => entry.entryPointType === 'video')?.uri;
  if (!meetLink) {
    throw new Error('Google Calendar created the event but did not return a Google Meet link.');
  }

  return {
    eventId: body.id || null,
    calendarLink: body.htmlLink || null,
    meetLink,
  };
}