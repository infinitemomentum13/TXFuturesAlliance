/**
 * Prompt 6 seeds — staff, partner and admin sample data.
 * All fictional (is_sample). See openapi_additions.yaml "STAFF / PARTNER /
 * ADMIN (Prompt 6)" for the suggested tables.
 */
import type {
  Career,
  College,
  CollegeEnrollment,
  Scholarship,
  SignatureDoc,
  SportOpportunity,
  StaffNote,
  StudentDocument,
  StudentPlacement,
} from '../api/types';

// Six-month re-verification rule lives in src/lib/verification.ts (shared
// with the admin CMS screen).
export { SIX_MONTHS_MS, needsReverification } from '../lib/verification';

/** Stamp catalog records with sample verification dates — a spread so the
 *  CMS shows both fresh and "needs re-verification" rows. */
export function stampVerification(
  careers: Career[],
  colleges: College[],
  scholarships: Scholarship[],
  opportunities: SportOpportunity[],
): void {
  const stamp = (r: { verified_on?: string | null; verified_by?: string | null }, i: number) => {
    // Rotate: recent (Sep 2026), borderline (May 2026), stale (Jan 2026).
    const dates = ['2026-09-15', '2026-05-01', '2026-01-20'];
    r.verified_on = dates[i % 3];
    r.verified_by = ['M. Garza (TXFA)', 'R. Salinas (TXFA)', 'A. de León (TXFA)'][i % 3];
  };
  careers.forEach(stamp);
  colleges.forEach(stamp);
  scholarships.forEach(stamp);
  opportunities.forEach(stamp);
}

/** Sample uploaded documents so counselors can demo transcript verification.
 *  All fictional sample files. */
export function seedDocuments(): StudentDocument[] {
  return [
    {
      document_id: 'doc-sample-001',
      student_id: 'sample-038',
      kind: 'report_card',
      file_name: 'Isaac_fall_2026_report_card_SAMPLE.pdf',
      note: 'Uploaded by student (sample).',
      uploaded_at: '2026-10-03T15:00:00.000Z',
      verified_at: null,
      verified_by: null,
    },
    {
      document_id: 'doc-sample-002',
      student_id: 'sample-121',
      kind: 'report_card',
      file_name: 'Damian_spring_2026_transcript_SAMPLE.pdf',
      note: 'Registrar copy (sample).',
      uploaded_at: '2026-09-18T12:00:00.000Z',
      verified_at: '2026-09-20T10:00:00.000Z',
      verified_by: 'M. Garza (TXFA)',
    },
    {
      document_id: 'doc-sample-003',
      student_id: 'sample-127',
      kind: 'certificate',
      file_name: 'Andrea_CPR_certificate_SAMPLE.pdf',
      note: null,
      uploaded_at: '2026-09-30T18:30:00.000Z',
      verified_at: null,
      verified_by: null,
    },
    {
      document_id: 'doc-sample-004',
      student_id: 'sample-071',
      kind: 'report_card',
      file_name: 'Tomas_fall_2026_report_card_SAMPLE.pdf',
      note: 'Needs verification before college matching (sample).',
      uploaded_at: '2026-10-05T09:15:00.000Z',
      verified_at: null,
      verified_by: null,
    },
  ];
}

/** Sample placements (mirrors student_placements SQL, student-safe subset). */
export function seedPlacements(): StudentPlacement[] {
  return [
    {
      placement_id: 'plc-sample-001', student_id: 'sample-038', partner_id: 'partner-sample-001',
      posting_id: 'int-sample-001', start_date: '2026-08-17', end_date: '2026-12-11',
      job_title: 'Warehouse Logistics Intern', completion_status: 'active',
      pay_rate: 12.5, partner_name: '',
    },
    {
      placement_id: 'plc-sample-002', student_id: 'sample-044', partner_id: 'partner-sample-002',
      posting_id: 'int-sample-003', start_date: '2026-06-08', end_date: '2026-08-14',
      actual_end_date: '2026-08-14', job_title: 'Summer Welding Shop Assistant',
      completion_status: 'completed', offered_full_time: true, accepted_full_time: true,
      pay_rate: 14,
    },
    {
      placement_id: 'plc-sample-003', student_id: 'sample-067', partner_id: 'partner-sample-003',
      start_date: '2026-06-01', end_date: '2026-07-31', actual_end_date: '2026-07-31',
      job_title: 'Clinic Front-Desk Aide', completion_status: 'completed',
      offered_full_time: false, pay_rate: 11.5,
    },
    {
      placement_id: 'plc-sample-004', student_id: 'sample-015', partner_id: 'partner-sample-001',
      posting_id: 'int-sample-002', start_date: '2026-05-04', end_date: '2026-06-26',
      actual_end_date: '2026-06-12', job_title: 'Forklift Trainee', completion_status: 'ended_early',
      offered_full_time: false, pay_rate: 12,
    },
    {
      placement_id: 'plc-sample-005', student_id: 'sample-126', partner_id: 'partner-sample-004',
      start_date: '2026-07-06', end_date: '2026-09-25', actual_end_date: '2026-09-25',
      job_title: 'Solar Install Helper', completion_status: 'completed',
      offered_full_time: true, accepted_full_time: true, pay_rate: 15,
    },
    {
      placement_id: 'plc-sample-006', student_id: 'sample-031', partner_id: 'partner-sample-005',
      start_date: '2026-09-08', end_date: '2027-01-30', job_title: 'Athletics Department Aide',
      completion_status: 'active', pay_rate: 10,
    },
  ];
}

/** Sample college enrollments feeding the outcomes dashboard. */
export function seedEnrollments(): CollegeEnrollment[] {
  return [
    { enrollment_id: 'enr-sample-001', student_id: 'sample-007', college_id: 'col-sample-001', enrollment_year: 2026, status: 'attending' },
    { enrollment_id: 'enr-sample-002', student_id: 'sample-015', college_id: 'col-sample-002', enrollment_year: 2026, status: 'enrolled' },
    { enrollment_id: 'enr-sample-003', student_id: 'sample-044', college_id: 'col-sample-001', enrollment_year: 2026, status: 'attending' },
    { enrollment_id: 'enr-sample-004', student_id: 'sample-067', college_id: 'col-sample-003', enrollment_year: 2026, status: 'enrolled' },
    { enrollment_id: 'enr-sample-005', student_id: 'sample-126', college_id: 'col-sample-002', enrollment_year: 2025, status: 'attending' },
  ];
}

/** Sample staff notes (staff_notes — front-end addition). */
export function seedStaffNotes(): StaffNote[] {
  return [
    {
      note_id: 'note-sample-001', student_id: 'sample-038',
      author_name: 'Coach R. Salinas', author_role: 'coach',
      body: 'Talked with Isaac about pairing the logistics certificate with academy training. Mom is on board. (sample)',
      created_at: '2026-09-22T16:00:00.000Z',
    },
    {
      note_id: 'note-sample-002', student_id: 'sample-121',
      author_name: 'Counselor A. de León', author_role: 'club_staff',
      body: 'Damián needs his SAT score on file to unlock more scholarship matches. Follow up next week. (sample)',
      created_at: '2026-10-01T15:30:00.000Z',
    },
    {
      note_id: 'note-sample-003', student_id: 'sample-150',
      author_name: 'Coach M. de León', author_role: 'coach',
      body: 'Josué is one year into soccer — keep expectations realistic, focus on grades and the college pathway. (sample)',
      created_at: '2026-09-15T14:00:00.000Z',
    },
  ];
}

/** Documents waiting on a parent signature (signature_documents addition). */
export function seedSignatureDocs(): SignatureDoc[] {
  return [
    {
      doc_id: 'sig-sample-001', student_id: 'sample-038',
      title_en: 'Internship site agreement — Warehouse Logistics',
      title_es: 'Acuerdo de sitio de pasantía — Logística de almacén',
      status: 'pending',
    },
    {
      doc_id: 'sig-sample-002', student_id: 'sample-121',
      title_en: 'Photo/video release for recruiting reel',
      title_es: 'Autorización de foto/video para el reel de reclutamiento',
      status: 'pending',
    },
    {
      doc_id: 'sig-sample-003', student_id: 'sample-071',
      title_en: 'Academy travel consent — fall tournaments',
      title_es: 'Consentimiento de viajes de la academia — torneos de otoño',
      status: 'signed', signed_by: 'Sample Guardian 71', signed_at: '2026-09-10T12:00:00.000Z',
    },
  ];
}
