/**
 * Racing 360 adapter — ALL Racing 360 logic lives here (plus its mock
 * handler in src/mocks/handlers.ts). When the real Racing 360 integration
 * exists (API details still to confirm with the vendor), only this file
 * and its handler get replaced.
 *
 * Every Racing 360 field in the UI is labeled "Field names to confirm".
 */
import { createRacing360Report, getRacing360Reports } from './index';
import type { Racing360Report } from './types';

export { getRacing360Reports };

/** Import a report from an uploaded file (PDF, CSV, or image).
 *  For now the file is not parsed — the mock stores a report shell and the
 *  direct-connection state is "coming soon". */
export async function importRacing360File(
  studentId: string,
  file: File,
  reportDate: string,
): Promise<Racing360Report> {
  return createRacing360Report(studentId, {
    report_date: reportDate,
    metrics: { imported_file_name: file.name, imported_file_type: file.type },
    coach_notes: undefined,
  });
}

/** Manual metric entry by a coach (structured fields feeding the
 *  performance timeline). */
export async function enterRacing360Metrics(
  studentId: string,
  input: {
    report_date: string;
    sessions?: number;
    minutes_played?: number;
    sprint_30m_sec?: number;
    technical_rating_1_10?: number;
    tactical_rating_1_10?: number;
    evaluator_comment?: string;
    coach_notes?: string;
  },
): Promise<Racing360Report> {
  const { coach_notes, ...metrics } = input;
  return createRacing360Report(studentId, { report_date: input.report_date, metrics, coach_notes });
}

/** Direct API connection to Racing 360 — coming soon. */
export async function connectRacing360(): Promise<{ connected: false; message: string }> {
  return { connected: false, message: 'Direct connection to Racing 360 – coming soon.' };
}
