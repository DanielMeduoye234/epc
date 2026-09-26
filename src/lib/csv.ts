/**
 * CSV Utilities for Export and Import
 * Handles RFC-4180 compliant parsing, generation with UTF-8 BOM, and header normalization.
 */

export interface CsvRow {
  [key: string]: string;
}

export interface ParsedCsvResult {
  headers: string[];
  rows: CsvRow[];
  errors: string[];
}

/**
 * Escapes a cell value for CSV output
 */
export function escapeCsvValue(val: unknown): string {
  if (val === null || val === undefined) return '""';
  const str = String(val);
  // If string contains comma, quote, or newline, escape quotes and wrap in quotes
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return `"${str}"`;
}

/**
 * Exports data to CSV and triggers a client download
 */
export function exportToCsv(filename: string, headers: { label: string; key: string }[], data: Record<string, unknown>[]) {
  const headerLine = headers.map(h => escapeCsvValue(h.label)).join(',');
  const rowLines = data.map(row => {
    return headers.map(h => escapeCsvValue(row[h.key] ?? '')).join(',');
  });

  // Prepend UTF-8 BOM (\uFEFF) so Excel on Windows properly displays characters
  const csvContent = '\uFEFF' + [headerLine, ...rowLines].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Robust RFC-4180 compliant CSV parser that handles quotes, commas, and newlines
 */
export function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  // Strip BOM if present
  let cleanText = text;
  if (cleanText.charCodeAt(0) === 0xFEFF) {
    cleanText = cleanText.slice(1);
  }

  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentVal = '';
  let inQuotes = false;

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // Escaped quote
          currentVal += '"';
          i++;
        } else {
          // End of quote
          inQuotes = false;
        }
      } else {
        currentVal += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentVal.trim());
        currentVal = '';
      } else if (char === '\r') {
        if (nextChar === '\n') i++;
        currentRow.push(currentVal.trim());
        currentVal = '';
        if (currentRow.some(col => col.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
      } else if (char === '\n') {
        currentRow.push(currentVal.trim());
        currentVal = '';
        if (currentRow.some(col => col.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
      } else {
        currentVal += char;
      }
    }
  }

  // Push last value if any
  if (currentVal || currentRow.length > 0) {
    currentRow.push(currentVal.trim());
    if (currentRow.some(col => col.length > 0)) {
      rows.push(currentRow);
    }
  }

  if (rows.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = rows[0].map(h => h.trim());
  const bodyRows = rows.slice(1);

  return { headers, rows: bodyRows };
}

/**
 * Normalizes headers to standard keys
 */
export function normalizeHeaderKey(header: string): string {
  const h = header.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (['fullname', 'name', 'person', 'member', 'personname', 'membername'].includes(h)) return 'full_name';
  if (['firstname', 'first'].includes(h)) return 'first_name';
  if (['lastname', 'last', 'surname'].includes(h)) return 'last_name';
  if (['nickname', 'alias'].includes(h)) return 'nickname';
  if (['phone', 'phonenumber', 'mobile', 'tel', 'telephonenumber', 'contact', 'whatsapp'].includes(h)) return 'phone_number';
  if (['address', 'residence', 'homeaddress', 'location'].includes(h)) return 'address';
  if (['bacenta', 'bacentaname', 'cell', 'fellowship'].includes(h)) return 'bacenta';
  if (['whobrought', 'whobroughttm', 'inviter', 'invitedby', 'broughtby'].includes(h)) return 'who_brought';
  if (['datesaved', 'saveddate', 'convertsince', 'salvationdate'].includes(h)) return 'date_saved';
  if (['datejoined', 'joineddate', 'firstvisit', 'visitdate'].includes(h)) return 'date_joined';
  if (['membershipdate', 'datebecameamember'].includes(h)) return 'membership_date';
  if (['birthday', 'dob', 'birthdate', 'dateofbirth'].includes(h)) return 'birthday';
  if (['shepherd', 'assignedshepherd', 'shepherdname', 'leader'].includes(h)) return 'shepherd';
  if (['status', 'memberstatus'].includes(h)) return 'status';
  return h;
}

export type EntityType = 'new_believers' | 'first_timers' | 'members';

export interface TemplateConfig {
  filename: string;
  headers: string[];
  sampleRows: string[][];
}

export const CSV_TEMPLATES: Record<EntityType, TemplateConfig> = {
  new_believers: {
    filename: 'new-believers-template.csv',
    headers: ['Full Name', 'Phone Number', 'Address', 'Bacenta', 'Who Brought', 'Date Saved', 'Birthday'],
    sampleRows: [
      ['John Doe', '08012345678', '12 Harmony Way, Ikeja', 'Bethel Bacenta', 'Brother Peter', '2026-09-15', '1998-05-20'],
      ['Mary Johnson', '+234 812 345 6789', '4 Victoria Island, Lagos', 'Unassigned', 'Sister Grace', '2026-09-20', '2001-11-04'],
    ],
  },
  first_timers: {
    filename: 'first-timers-template.csv',
    headers: ['Full Name', 'Phone Number', 'Address', 'Bacenta', 'Who Brought', 'Date Joined', 'Birthday'],
    sampleRows: [
      ['Samuel Green', '09012345678', 'University of Lagos Campus', 'Bethel Bacenta', 'Brother David', '2026-09-18', '2000-03-12'],
      ['Deborah Smith', '+234 701 234 5678', '24 Palm Groove, Lagos', 'Unassigned', 'Self-invited', '2026-09-25', '1995-08-30'],
    ],
  },
  members: {
    filename: 'members-template.csv',
    headers: ['Full Name', 'Phone Number', 'Address', 'Bacenta', 'Status', 'Date Joined', 'Birthday'],
    sampleRows: [
      ['Emmanuel Adeleke', '08098765432', '15 Marina Street, Lagos', 'Bethel Bacenta', 'active', '2026-01-10', '1992-07-14'],
      ['Grace Olatunji', '+234 813 456 7890', '7 Yaba Road, Lagos', 'Grace Bacenta', 'active', '2026-02-14', '1997-12-02'],
    ],
  },
};

/**
 * Triggers downloading the sample template for the given entity
 */
export function downloadCsvTemplate(type: EntityType) {
  const config = CSV_TEMPLATES[type];
  const headerLine = config.headers.map(h => escapeCsvValue(h)).join(',');
  const rowLines = config.sampleRows.map(r => r.map(c => escapeCsvValue(c)).join(','));
  const csvContent = '\uFEFF' + [headerLine, ...rowLines].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = config.filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
