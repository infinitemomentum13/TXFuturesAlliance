/**
 * Prompt 5 seeds — sports pathway sample data.
 * All fictional sample data (is_sample). Tables suggested in
 * openapi_additions.yaml: player_performance_timeline exists in
 * video_media_schema.sql; sport_opportunities, coach_endorsements,
 * recruiting_achievements are front-end additions.
 */
import type {
  CoachEndorsement,
  PerformancePoint,
  RecruitingAchievement,
  RecruitmentReel,
  SportOpportunity,
  VideoHighlight,
  VideoUpload,
} from '../api/types';

const NOW = '2026-10-06T12:00:00.000Z';

/* ------------------------- performance timeline ------------------------ */

export function seedPerformanceTimeline(): PerformancePoint[] {
  const pts: PerformancePoint[] = [];
  const push = (p: Omit<PerformancePoint, 'created_at'>) =>
    pts.push({ ...p, created_at: NOW });

  // Isaac (sample-038) — defensive midfielder, Academy. Mixed sources.
  push({
    timeline_id: 'tl-sample-001', student_id: 'sample-038',
    assessment_date: '2026-02-10', season: 'Spring 2026',
    overall_rating: 6.2, technical_skills: 6.5, tactical_awareness: 6.8,
    physical_fitness: 6.0, mental_toughness: 6.4, trajectory: 'Improving',
    assessment_notes: 'First video-analysis baseline. (sample)',
    source: 'video_analysis',
  });
  push({
    timeline_id: 'tl-sample-002', student_id: 'sample-038',
    assessment_date: '2026-05-20', season: 'Spring 2026',
    overall_rating: 6.8, technical_skills: 7.0, tactical_awareness: 7.2,
    physical_fitness: 6.5, mental_toughness: 6.8, trajectory: 'Improving',
    assessment_notes: 'Coach review after academy season. (sample)',
    coach_observations: 'Positioning improved; work on first touch under pressure.',
    source: 'coach_entry',
  });
  push({
    timeline_id: 'tl-sample-003', student_id: 'sample-038',
    assessment_date: '2026-08-15', season: 'Fall 2026',
    overall_rating: 7.4, technical_skills: 7.5, tactical_awareness: 7.8,
    physical_fitness: 7.2, mental_toughness: 7.3, trajectory: 'Rapidly Improving',
    assessment_notes: 'Imported from Racing 360 report. (sample – field names to confirm)',
    source: 'racing360',
  });

  // Damián (sample-121) — striker; timeline mirrors his two Racing 360 reports.
  push({
    timeline_id: 'tl-sample-004', student_id: 'sample-121',
    assessment_date: '2026-03-15', season: 'Spring 2026',
    overall_rating: 6.5, technical_skills: 6.0, tactical_awareness: 7.0,
    physical_fitness: 6.6, mental_toughness: null, trajectory: 'Stable',
    assessment_notes: 'Imported from Racing 360 report. (sample – field names to confirm)',
    source: 'racing360',
  });
  push({
    timeline_id: 'tl-sample-005', student_id: 'sample-121',
    assessment_date: '2026-06-01', season: 'Spring 2026',
    overall_rating: 7.0, technical_skills: 7.0, tactical_awareness: 7.2,
    physical_fitness: 7.1, mental_toughness: 6.8, trajectory: 'Improving',
    assessment_notes: 'Highlight-reel analysis, regional final. (sample)',
    source: 'video_analysis',
  });
  push({
    timeline_id: 'tl-sample-006', student_id: 'sample-121',
    assessment_date: '2026-08-15', season: 'Fall 2026',
    overall_rating: 8.0, technical_skills: 8.0, tactical_awareness: 9.0,
    physical_fitness: 7.4, mental_toughness: 7.6, trajectory: 'Rapidly Improving',
    assessment_notes: 'Imported from Racing 360 report. (sample – field names to confirm)',
    coach_observations: 'Good engine, improve weak foot.',
    source: 'racing360',
  });

  // Josué (sample-150) — center back, one year in.
  push({
    timeline_id: 'tl-sample-007', student_id: 'sample-150',
    assessment_date: '2026-04-05', season: 'Spring 2026',
    overall_rating: 5.4, technical_skills: 5.2, tactical_awareness: 5.6,
    physical_fitness: 5.8, mental_toughness: 5.5, trajectory: 'Improving',
    assessment_notes: 'Baseline coach assessment. (sample)',
    source: 'coach_entry',
  });
  push({
    timeline_id: 'tl-sample-008', student_id: 'sample-150',
    assessment_date: '2026-09-01', season: 'Fall 2026',
    overall_rating: 6.1, technical_skills: 6.0, tactical_awareness: 6.4,
    physical_fitness: 6.5, mental_toughness: 6.0, trajectory: 'Improving',
    assessment_notes: 'Imported from Racing 360 report. (sample – field names to confirm)',
    source: 'racing360',
  });

  // Tomás (sample-071) — fullback, Academy.
  push({
    timeline_id: 'tl-sample-009', student_id: 'sample-071',
    assessment_date: '2026-05-12', season: 'Spring 2026',
    overall_rating: 6.9, technical_skills: 6.8, tactical_awareness: 7.1,
    physical_fitness: 7.0, mental_toughness: 6.6, trajectory: 'Stable',
    assessment_notes: 'Academy mid-season review. (sample)',
    source: 'coach_entry',
  });

  return pts;
}

/* ----------------------------- opportunities --------------------------- */

export function seedOpportunities(): SportOpportunity[] {
  return [
    /* ---- College athletics lane ---- */
    {
      opportunity_id: 'opp-sample-001', lane: 'college', sport: 'Soccer',
      title_en: 'South Texas College Soccer ID Camp', title_es: 'Campamento ID de fútbol — South Texas College',
      org_name: 'Sample South Texas University (NCAA D2)',
      level_en: 'College ID camp — NCAA D2 program', level_es: 'Campamento ID universitario — programa NCAA D2',
      age_min: 14, age_max: 18,
      location_en: 'Edinburg, TX (RGV)', location_es: 'Edinburg, TX (RGV)', country: 'US',
      dates_en: 'January 9–10, 2027', dates_es: '9–10 de enero de 2027',
      cost_usd: 85, cost_note_en: 'Lunch included; fee waivers available — ask your counselor.',
      cost_note_es: 'Incluye comida; hay exenciones de costo — pregunta a tu consejero.',
      requirements_en: ['Current physical', 'Bring cleats and shin guards', 'Register online by January 2'],
      requirements_es: ['Examen físico vigente', 'Trae tachones y espinilleras', 'Regístrate en línea antes del 2 de enero'],
      is_sample: true,
    },
    {
      opportunity_id: 'opp-sample-002', lane: 'college', sport: 'Soccer',
      title_en: 'RGV Winter College Showcase', title_es: 'Showcase universitario de invierno del RGV',
      org_name: 'TX Futures Alliance × FC Brownsville (sample)',
      level_en: 'Showcase — college coaches from TX and beyond attend',
      level_es: 'Showcase — asisten entrenadores universitarios de TX y otros estados',
      age_min: 15, age_max: 18,
      location_en: 'Brownsville, TX', location_es: 'Brownsville, TX', country: 'US',
      dates_en: 'December 12, 2026', dates_es: '12 de diciembre de 2026',
      cost_usd: 0, cost_note_en: 'Free for FC Brownsville players.', cost_note_es: 'Gratis para jugadores de FC Brownsville.',
      requirements_en: ['Recruiting profile completed', 'Highlight reel recommended'],
      requirements_es: ['Perfil de reclutamiento completo', 'Se recomienda video de highlights'],
      is_sample: true,
    },
    {
      opportunity_id: 'opp-sample-003', lane: 'college', sport: 'Soccer',
      title_en: 'NCAA D1 Summer ID Clinic', title_es: 'Clínica ID de verano NCAA D1',
      org_name: 'Sample State University (NCAA D1)',
      level_en: 'College ID clinic — NCAA D1', level_es: 'Clínica ID universitaria — NCAA D1',
      age_min: 15, age_max: 18,
      location_en: 'San Antonio, TX', location_es: 'San Antonio, TX', country: 'US',
      dates_en: 'June 18–20, 2027', dates_es: '18–20 de junio de 2027',
      cost_usd: 220, cost_note_en: 'Overnight option +$90.', cost_note_es: 'Opción con hospedaje +$90.',
      requirements_en: ['Transcript on file (unofficial OK)', 'Two references'],
      requirements_es: ['Historial académico (no oficial está bien)', 'Dos referencias'],
      is_sample: true,
    },
    /* ---- National pathways lane ---- */
    {
      opportunity_id: 'opp-sample-004', lane: 'national', sport: 'Soccer',
      title_en: 'Pro Academy Open Tryout (MLS-affiliated)', title_es: 'Prueba abierta de academia profesional (afiliada a MLS)',
      org_name: 'Sample Pro Academy — Texas',
      level_en: 'Professional academy', level_es: 'Academia profesional',
      age_min: 15, age_max: 18,
      location_en: 'Houston, TX', location_es: 'Houston, TX', country: 'US',
      dates_en: 'November 21, 2026', dates_es: '21 de noviembre de 2026',
      cost_usd: 0, cost_note_en: null, cost_note_es: null,
      requirements_en: ['Birth certificate', 'Parent or guardian present for under 18s'],
      requirements_es: ['Acta de nacimiento', 'Padre, madre o tutor presente si eres menor de 18'],
      is_sample: true,
    },
    {
      opportunity_id: 'opp-sample-005', lane: 'national', sport: 'Soccer',
      title_en: 'Development League Season Tryouts', title_es: 'Pruebas de temporada — liga de desarrollo',
      org_name: 'Sample Development League (USL-type)',
      level_en: 'Pre-professional development league', level_es: 'Liga de desarrollo pre-profesional',
      age_min: 16, age_max: 19,
      location_en: 'San Antonio, TX', location_es: 'San Antonio, TX', country: 'US',
      dates_en: 'February 6–7, 2027', dates_es: '6–7 de febrero de 2027',
      cost_usd: 45, cost_note_en: null, cost_note_es: null,
      requirements_en: ['Two matches of recent film', 'Coach reference'],
      requirements_es: ['Video de dos partidos recientes', 'Referencia de entrenador'],
      is_sample: true,
    },
    {
      opportunity_id: 'opp-sample-006', lane: 'national', sport: 'Soccer',
      title_en: 'State ODP-type Selection Program', title_es: 'Programa estatal de selección (tipo ODP)',
      org_name: 'Sample State Soccer Association',
      level_en: 'Olympic-development-style state program', level_es: 'Programa estatal estilo desarrollo olímpico',
      age_min: 13, age_max: 17,
      location_en: 'Austin, TX (state-wide tryouts)', location_es: 'Austin, TX (pruebas estatales)', country: 'US',
      dates_en: 'March 2027 (weekend pools)', dates_es: 'Marzo de 2027 (fines de semana)',
      cost_usd: 60, cost_note_en: 'Travel stipends available for RGV families.',
      cost_note_es: 'Hay apoyos de viaje para familias del RGV.',
      requirements_en: ['Club coach nomination', 'Current season roster spot'],
      requirements_es: ['Nominación del entrenador del club', 'Lugar en el roster de la temporada actual'],
      is_sample: true,
    },
    /* ---- International lane ---- */
    {
      opportunity_id: 'opp-sample-007', lane: 'international', sport: 'Soccer',
      title_en: 'Racing de Santander Exchange & Trials', title_es: 'Intercambio y pruebas con Racing de Santander',
      org_name: 'Real Racing Club de Santander × TX Futures Alliance',
      level_en: 'Partner club exchange — Santander, Spain', level_es: 'Intercambio con club aliado — Santander, España',
      age_min: 14, age_max: 17,
      location_en: 'Santander, Spain', location_es: 'Santander, España', country: 'ES',
      dates_en: 'July 2027 (two weeks)', dates_es: 'Julio de 2027 (dos semanas)',
      cost_usd: 0, cost_note_en: 'Subsidized through the partnership; families cover passport and spending money.',
      cost_note_es: 'Subsidiado por la alianza; las familias cubren pasaporte y gastos personales.',
      requirements_en: ['TXFA nomination', 'Racing 360 reports on file', 'Passport valid 6+ months'],
      requirements_es: ['Nominación de TXFA', 'Reportes de Racing 360 archivados', 'Pasaporte vigente 6+ meses'],
      is_sample: true,
    },
    {
      opportunity_id: 'opp-sample-008', lane: 'international', sport: 'Soccer',
      title_en: 'Liga MX Academy Identification Session', title_es: 'Sesión de visoría de academia de Liga MX',
      org_name: 'Sample Liga MX Academy — Monterrey',
      level_en: 'Pro academy identification', level_es: 'Visoría de academia profesional',
      age_min: 14, age_max: 18,
      location_en: 'Monterrey, Mexico', location_es: 'Monterrey, México', country: 'MX',
      dates_en: 'January 16, 2027', dates_es: '16 de enero de 2027',
      cost_usd: 25, cost_note_en: null, cost_note_es: null,
      requirements_en: ['Passport or border crossing card', 'Parent consent form'],
      requirements_es: ['Pasaporte o tarjeta de cruce fronterizo', 'Carta de consentimiento de los padres'],
      is_sample: true,
    },
    {
      opportunity_id: 'opp-sample-009', lane: 'international', sport: 'Soccer',
      title_en: 'UK Summer Development Program', title_es: 'Programa de desarrollo de verano en el Reino Unido',
      org_name: 'Sample UK Football Development',
      level_en: 'Development camp — England', level_es: 'Campamento de desarrollo — Inglaterra',
      age_min: 15, age_max: 18,
      location_en: 'Manchester, England', location_es: 'Mánchester, Inglaterra', country: 'GB',
      dates_en: 'August 2–13, 2027', dates_es: '2–13 de agosto de 2027',
      cost_usd: 1800, cost_note_en: 'Fundraising and payment-plan options exist — talk to TXFA before ruling it out.',
      cost_note_es: 'Hay opciones de recaudación y pagos a plazos — habla con TXFA antes de descartarlo.',
      requirements_en: ['Passport', 'Travel insurance', 'Parent consent'],
      requirements_es: ['Pasaporte', 'Seguro de viaje', 'Consentimiento de los padres'],
      is_sample: true,
    },
    {
      opportunity_id: 'opp-sample-010', lane: 'international', sport: 'Soccer',
      title_en: 'Spain Residential Academy Trials', title_es: 'Pruebas de academia residencial en España',
      org_name: 'Sample Iberia Academy',
      level_en: 'Residential academy trials — Spain', level_es: 'Pruebas de academia residencial — España',
      age_min: 16, age_max: 18,
      location_en: 'Valencia, Spain', location_es: 'Valencia, España', country: 'ES',
      dates_en: 'April 2027', dates_es: 'Abril de 2027',
      cost_usd: 150, cost_note_en: 'Trial fee only; academy fees apply if selected.',
      cost_note_es: 'Solo el costo de la prueba; hay cuotas de academia si quedas seleccionado.',
      requirements_en: ['Highlight reel', 'Academic records', 'Parent interview (video call)'],
      requirements_es: ['Video de highlights', 'Historial académico', 'Entrevista con los padres (videollamada)'],
      is_sample: true,
    },
  ];
}

/* --------------------- endorsements & achievements --------------------- */

export function seedEndorsements(): CoachEndorsement[] {
  return [
    {
      endorsement_id: 'end-sample-001', student_id: 'sample-038',
      coach_name: 'Coach R. Salinas', coach_org: 'FC Brownsville Academy (sample)',
      text_en: 'Isaac reads the game two passes ahead. Best defensive positioning in his age group. (sample)',
      text_es: 'Isaac lee el juego dos pases adelante. La mejor colocación defensiva de su categoría. (sample)',
      created_at: '2026-08-20T15:00:00.000Z',
    },
    {
      endorsement_id: 'end-sample-002', student_id: 'sample-121',
      coach_name: 'Coach M. de León', coach_org: 'FC Brownsville 2011 Boys (sample)',
      text_en: 'Damián is a finisher. Left foot, right foot, head — he scores in every way. (sample)',
      text_es: 'Damián es un definidor. Zurda, diestra, cabeza — anota de todas las formas. (sample)',
      created_at: '2026-09-02T15:00:00.000Z',
    },
    {
      endorsement_id: 'end-sample-003', student_id: 'sample-071',
      coach_name: 'Coach R. Salinas', coach_org: 'FC Brownsville Academy (sample)',
      text_en: 'Tomás is the most coachable player I have worked with. (sample)',
      text_es: 'Tomás es el jugador más receptivo con el que he trabajado. (sample)',
      created_at: '2026-07-11T15:00:00.000Z',
    },
  ];
}

export function seedAchievements(): RecruitingAchievement[] {
  return [
    { achievement_id: 'ach-sample-001', student_id: 'sample-038', text_en: 'Regional tournament champions — 2010 Boys', text_es: 'Campeones del torneo regional — 2010 Boys', year: 2026 },
    { achievement_id: 'ach-sample-002', student_id: 'sample-038', text_en: 'Academy captain, spring season', text_es: 'Capitán de la academia, temporada de primavera', year: 2026 },
    { achievement_id: 'ach-sample-003', student_id: 'sample-121', text_en: 'Top scorer, Valley league (14 goals)', text_es: 'Goleador de la liga del Valle (14 goles)', year: 2026 },
    { achievement_id: 'ach-sample-004', student_id: 'sample-121', text_en: 'Regional finalist with 2011 Boys', text_es: 'Finalista regional con 2011 Boys', year: 2026 },
    { achievement_id: 'ach-sample-005', student_id: 'sample-150', text_en: 'Most improved player — spring season', text_es: 'Jugador de mayor progreso — temporada de primavera', year: 2026 },
    { achievement_id: 'ach-sample-006', student_id: 'sample-071', text_en: 'Academy starting XI, all season', text_es: 'Titular de la academia, toda la temporada', year: 2026 },
  ];
}

/* ------------------------- sample video library ------------------------ */

export function seedSportsMedia(): {
  videos: VideoUpload[];
  highlights: VideoHighlight[];
  reels: RecruitmentReel[];
} {
  const videos: VideoUpload[] = [
    {
      video_id: 'vid-sample-001', student_id: 'sample-038', video_type: 'full_match',
      sport: 'Soccer', event_name: 'Regional final vs. Sample United',
      event_date: '2026-05-30', event_location: 'Brownsville, TX', opponent: 'Sample United',
      match_result: 'W 2–1', upload_date: '2026-06-02T18:00:00.000Z', uploaded_by: 'sample-038',
      uploader_role: 'student', original_filename: 'regional-final.mp4', file_size_bytes: 734003200,
      duration_seconds: 5400, duration_formatted: '1:30:00', resolution: '1080p',
      storage_url: 'mock://videos/sample-038/regional-final.mp4', thumbnail_url: null,
      processing_status: 'analyzed', privacy_setting: 'scouts_allowed', consent_verified: true,
      title: 'Regional final — full match', description: 'Full match video. (sample)',
      tags: ['final', 'academy'], view_count: 12, created_at: NOW, updated_at: NOW,
    },
    {
      video_id: 'vid-sample-002', student_id: 'sample-121', video_type: 'highlight_reel',
      sport: 'Soccer', event_name: 'Spring season goals', event_date: '2026-05-15',
      upload_date: '2026-05-20T18:00:00.000Z', uploaded_by: 'sample-121', uploader_role: 'student',
      original_filename: 'spring-goals.mp4', file_size_bytes: 188743680,
      duration_seconds: 240, duration_formatted: '4:00', resolution: '720p',
      storage_url: 'mock://videos/sample-121/spring-goals.mp4', thumbnail_url: null,
      processing_status: 'ready', privacy_setting: 'college_recruiters', consent_verified: true,
      title: 'Spring goals compilation', description: 'Best goals of the spring. (sample)',
      tags: ['goals'], view_count: 30, created_at: NOW, updated_at: NOW,
    },
    {
      video_id: 'vid-sample-003', student_id: 'sample-121', video_type: 'full_match',
      sport: 'Soccer', event_name: 'League match vs. Sample City SC', event_date: '2026-09-19',
      upload_date: '2026-09-21T18:00:00.000Z', uploaded_by: 'sample-121', uploader_role: 'student',
      original_filename: 'league-sept19.mp4', file_size_bytes: 650117120,
      duration_seconds: 5100, duration_formatted: '1:25:00', resolution: '1080p',
      storage_url: 'mock://videos/sample-121/league-sept19.mp4', thumbnail_url: null,
      processing_status: 'uploaded', privacy_setting: 'private', consent_verified: true,
      title: 'League match — Sept 19', view_count: 2, created_at: NOW, updated_at: NOW,
    },
  ];

  const highlights: VideoHighlight[] = [
    {
      highlight_id: 'hl-sample-001', video_id: 'vid-sample-001', student_id: 'sample-038',
      highlight_type: 'tackle', start_timestamp: '00:23:14', end_timestamp: '00:23:26',
      duration_seconds: 12, auto_detected: false, manually_tagged: true,
      title: 'Goal-saving tackle', description: 'Recovery run and clean tackle. (sample)',
      created_at: NOW,
    },
    {
      highlight_id: 'hl-sample-002', video_id: 'vid-sample-002', student_id: 'sample-121',
      highlight_type: 'goal', start_timestamp: '00:00:41', end_timestamp: '00:00:55',
      duration_seconds: 14, auto_detected: false, manually_tagged: true,
      title: 'Left-foot volley', description: 'Volley from the edge of the box. (sample)',
      created_at: NOW,
    },
    {
      highlight_id: 'hl-sample-003', video_id: 'vid-sample-002', student_id: 'sample-121',
      highlight_type: 'header', start_timestamp: '00:02:10', end_timestamp: '00:02:24',
      duration_seconds: 14, auto_detected: false, manually_tagged: true,
      title: 'Header off the corner', created_at: NOW,
    },
  ];

  const reels: RecruitmentReel[] = [
    {
      reel_id: 'reel-sample-001', student_id: 'sample-121',
      reel_name: 'Damián — striker reel (sample)', reel_type: 'general',
      target_audience: 'College recruiters',
      included_highlights: ['hl-sample-002', 'hl-sample-003'], highlight_count: 2,
      auto_generated: false, share_link_active: false, view_count: 4,
      status: 'published', created_at: NOW, updated_at: NOW,
    },
  ];

  return { videos, highlights, reels };
}
