/**
 * College & scholarship catalog for the College pathway: 16 fictional
 * institutions across the US (RGV/Texas + soccer levels), Mexico, Spain and
 * 3 other countries, 15 sample scholarships covering every required
 * category, and seeded applications/outcomes for the demo personas.
 *
 * EVERY record is fictional, marked is_sample / "(Sample)" and rendered as
 * "Sample data – to verify". Costs, aid and requirements must be verified
 * with each institution before launch.
 */
import type {
  College,
  Scholarship,
  ScholarshipApplication,
  ScholarshipMatch,
  ScholarshipOutcome,
  GradeSource,
} from '../api/types';

/* ------------------------------------------------------------------ */
/* Colleges                                                            */
/* ------------------------------------------------------------------ */

export function seedCollegesFull(): College[] {
  const base = { is_sample: true as const };
  return [
    {
      ...base,
      college_id: 'col-sample-001',
      name: 'Sample Rio Grande Valley University',
      type: 'university',
      city: 'Edinburg / Brownsville',
      state_or_region: 'TX',
      country: 'US',
      in_rgv: true,
      spanish_support: true,
      soccer_program: 'both',
      soccer_level: 'NCAA D1 (sample)',
      cost_per_year_usd: 9800,
      typical_aid_usd: 6500,
      language_of_instruction: 'English (Spanish support)',
      admissions_notes_en: 'Top 10% auto-admit (sample); SAT/ACT optional; rolling admission.',
      admissions_notes_es: 'Admisión automática top 10% (muestra); SAT/ACT opcional; admisión continua.',
      min_gpa: 2.5,
      soccer_scholarships: true,
      notes_en: 'Large public university in the Valley. Stay close to home.',
      notes_es: 'Universidad pública grande en el Valle. Quédate cerca de casa.',
    },
    {
      ...base,
      college_id: 'col-sample-002',
      name: 'Sample Border Community College',
      type: 'community_college',
      city: 'Brownsville',
      state_or_region: 'TX',
      country: 'US',
      in_rgv: true,
      spanish_support: true,
      soccer_program: 'none',
      soccer_level: null,
      cost_per_year_usd: 3200,
      typical_aid_usd: 2600,
      language_of_instruction: 'English (Spanish support)',
      admissions_notes_en: 'Open enrollment with a high school diploma or GED (sample).',
      admissions_notes_es: 'Inscripción abierta con diploma de preparatoria o GED (muestra).',
      min_gpa: 2.0,
      soccer_scholarships: false,
      notes_en: 'Low-cost two-year degrees and certificates. Easy transfer path.',
      notes_es: 'Carreras de dos años y certificados de bajo costo. Fácil transferencia.',
    },
    {
      ...base,
      college_id: 'col-sample-003',
      name: 'Sample State University – Austin',
      type: 'university',
      city: 'Austin',
      state_or_region: 'TX',
      country: 'US',
      in_rgv: false,
      spanish_support: false,
      soccer_program: 'both',
      soccer_level: 'NCAA D1 (sample)',
      cost_per_year_usd: 29500,
      typical_aid_usd: 12000,
      language_of_instruction: 'English',
      admissions_notes_en: 'Competitive admission; top 6% auto-admit (sample); essays required.',
      admissions_notes_es: 'Admisión competitiva; top 6% automático (muestra); ensayos requeridos.',
      min_gpa: 3.5,
      soccer_scholarships: true,
      notes_en: 'Flagship-style Texas public university.',
      notes_es: 'Universidad pública principal de Texas.',
    },
    {
      ...base,
      college_id: 'col-sample-004',
      name: 'Sample South Texas A&M',
      type: 'university',
      city: 'Kingsville',
      state_or_region: 'TX',
      country: 'US',
      in_rgv: false,
      spanish_support: true,
      soccer_program: 'mens',
      soccer_level: 'NCAA D2 (sample)',
      cost_per_year_usd: 21000,
      typical_aid_usd: 9500,
      language_of_instruction: 'English (Spanish support)',
      admissions_notes_en: 'Moderately selective; SAT/ACT optional (sample).',
      admissions_notes_es: 'Selectividad moderada; SAT/ACT opcional (muestra).',
      min_gpa: 3.0,
      soccer_scholarships: true,
      notes_en: 'Closest big public campus south of San Antonio.',
      notes_es: 'El campus público grande más cercano al sur de San Antonio.',
    },
    {
      ...base,
      college_id: 'col-sample-005',
      name: 'Sample Universidad del Noreste',
      type: 'university',
      city: 'Monterrey',
      state_or_region: 'Nuevo León',
      country: 'MX',
      in_rgv: false,
      spanish_support: true,
      soccer_program: 'both',
      soccer_level: 'Liga Universitaria MX (sample)',
      cost_per_year_usd: 14000,
      typical_aid_usd: 5000,
      language_of_instruction: 'Spanish (English programs available)',
      admissions_notes_en: 'Entrance exam (sample); US transcript evaluation required.',
      admissions_notes_es: 'Examen de admisión (muestra); se requiere evaluación de estudios de EE. UU.',
      min_gpa: 3.0,
      soccer_scholarships: true,
      notes_en: 'Private Mexican university a few hours from the border.',
      notes_es: 'Universidad privada mexicana a pocas horas de la frontera.',
    },
    {
      ...base,
      college_id: 'col-sample-006',
      name: 'Sample Instituto Tecnológico de Matamoros',
      type: 'technical_college',
      city: 'Matamoros',
      state_or_region: 'Tamaulipas',
      country: 'MX',
      in_rgv: true,
      spanish_support: true,
      soccer_program: 'mens',
      soccer_level: 'Liga Universitaria MX (sample)',
      cost_per_year_usd: 1200,
      typical_aid_usd: 800,
      language_of_instruction: 'Spanish',
      admissions_notes_en: 'Public technological institute right across the bridge (sample).',
      admissions_notes_es: 'Instituto tecnológico público justo cruzando el puente (muestra).',
      min_gpa: 2.5,
      soccer_scholarships: false,
      notes_en: 'Right across the bridge — an option for cross-border families.',
      notes_es: 'Justo cruzando el puente — una opción para familias de la frontera.',
    },
    {
      ...base,
      college_id: 'col-sample-007',
      name: 'Sample Universidad de la Costa Norte',
      type: 'university',
      city: 'Santander',
      state_or_region: 'Cantabria',
      country: 'ES',
      in_rgv: false,
      spanish_support: true,
      soccer_program: 'both',
      soccer_level: 'Liga Universitaria ES (sample)',
      cost_per_year_usd: 2500,
      typical_aid_usd: 1500,
      language_of_instruction: 'Spanish',
      admissions_notes_en: 'UNED credential evaluation for US diplomas (sample); B2 Spanish recommended.',
      admissions_notes_es: 'Evaluación UNED de credenciales de EE. UU. (muestra); se recomienda español B2.',
      min_gpa: 3.0,
      soccer_scholarships: false,
      racing_partner: true,
      notes_en: 'Public university in Santander — city of TXFA partner Racing Club (sample).',
      notes_es: 'Universidad pública en Santander — ciudad del club socio de TXFA (muestra).',
    },
    {
      ...base,
      college_id: 'col-sample-008',
      name: 'Sample Texas Technical College',
      type: 'technical_college',
      city: 'Harlingen',
      state_or_region: 'TX',
      country: 'US',
      in_rgv: true,
      spanish_support: true,
      soccer_program: 'none',
      soccer_level: null,
      cost_per_year_usd: 5600,
      typical_aid_usd: 4100,
      language_of_instruction: 'English (Spanish support)',
      admissions_notes_en: 'Open enrollment; TSI assessment for degree programs (sample).',
      admissions_notes_es: 'Inscripción abierta; evaluación TSI para carreras (muestra).',
      min_gpa: 2.0,
      soccer_scholarships: false,
      notes_en: 'Hands-on technical degrees tied to Valley employers.',
      notes_es: 'Carreras técnicas prácticas ligadas a empleadores del Valle.',
    },
    {
      ...base,
      college_id: 'col-sample-009',
      name: 'Sample Gulf Coast D2 University',
      type: 'university',
      city: 'Corpus Christi',
      state_or_region: 'TX',
      country: 'US',
      in_rgv: false,
      spanish_support: true,
      soccer_program: 'both',
      soccer_level: 'NCAA D2 (sample)',
      cost_per_year_usd: 22000,
      typical_aid_usd: 11000,
      language_of_instruction: 'English',
      admissions_notes_en: 'Moderately selective; rolling admission (sample).',
      admissions_notes_es: 'Selectividad moderada; admisión continua (muestra).',
      min_gpa: 2.8,
      soccer_scholarships: true,
      notes_en: 'Regional campus with real playing-time opportunity for Valley players (sample).',
      notes_es: 'Campus regional con oportunidad real de minutos para jugadores del Valle (muestra).',
    },
    {
      ...base,
      college_id: 'col-sample-010',
      name: 'Sample Hill Country D3 College',
      type: 'university',
      city: 'San Antonio',
      state_or_region: 'TX',
      country: 'US',
      in_rgv: false,
      spanish_support: false,
      soccer_program: 'both',
      soccer_level: 'NCAA D3 (no athletic scholarships, sample)',
      cost_per_year_usd: 42000,
      typical_aid_usd: 24000,
      language_of_instruction: 'English',
      admissions_notes_en: 'Holistic review; D3 offers no athletic money but strong merit aid (sample).',
      admissions_notes_es: 'Revisión integral; D3 no da becas deportivas pero sí buen apoyo académico (muestra).',
      min_gpa: 3.2,
      soccer_scholarships: false,
      notes_en: 'Small private college — academics first, soccer for the love of it.',
      notes_es: 'Colegio privado pequeño — estudios primero, fútbol por amor al juego.',
    },
    {
      ...base,
      college_id: 'col-sample-011',
      name: 'Sample Plains NAIA University',
      type: 'university',
      city: 'Plainview',
      state_or_region: 'TX',
      country: 'US',
      in_rgv: false,
      spanish_support: false,
      soccer_program: 'both',
      soccer_level: 'NAIA (sample)',
      cost_per_year_usd: 31000,
      typical_aid_usd: 17000,
      language_of_instruction: 'English',
      admissions_notes_en: 'NAIA eligibility via PlayNAIA (sample); athletic scholarships available.',
      admissions_notes_es: 'Elegibilidad NAIA vía PlayNAIA (muestra); hay becas deportivas.',
      min_gpa: 2.3,
      soccer_scholarships: true,
      notes_en: 'NAIA schools recruit RGV talent actively (sample).',
      notes_es: 'Las universidades NAIA reclutan talento del Valle activamente (muestra).',
    },
    {
      ...base,
      college_id: 'col-sample-012',
      name: 'Sample Valley Junior College (NJCAA)',
      type: 'community_college',
      city: 'Laredo',
      state_or_region: 'TX',
      country: 'US',
      in_rgv: false,
      spanish_support: true,
      soccer_program: 'both',
      soccer_level: 'NJCAA D1 (sample)',
      cost_per_year_usd: 4800,
      typical_aid_usd: 3200,
      language_of_instruction: 'English (Spanish support)',
      admissions_notes_en: 'Open enrollment; two-year path to a D1/D2 transfer (sample).',
      admissions_notes_es: 'Inscripción abierta; camino de dos años para transferir a D1/D2 (muestra).',
      min_gpa: 2.0,
      soccer_scholarships: true,
      notes_en: 'JUCO route: play now, transfer with two years of eligibility left.',
      notes_es: 'Ruta JUCO: juega ya y transfiere con dos años de elegibilidad.',
    },
    {
      ...base,
      college_id: 'col-sample-013',
      name: 'Sample Universidad de las Américas',
      type: 'university',
      city: 'Puebla',
      state_or_region: 'Puebla',
      country: 'MX',
      in_rgv: false,
      spanish_support: true,
      soccer_program: 'mens',
      soccer_level: 'Liga Universitaria MX (sample)',
      cost_per_year_usd: 9000,
      typical_aid_usd: 3500,
      language_of_instruction: 'Spanish',
      admissions_notes_en: 'Entrance exam + transcript evaluation (sample).',
      admissions_notes_es: 'Examen de admisión + evaluación de estudios (muestra).',
      min_gpa: 2.8,
      soccer_scholarships: true,
      notes_en: 'Well-known Mexican private university with strong exchange programs.',
      notes_es: 'Universidad privada mexicana reconocida con buenos programas de intercambio.',
    },
    {
      ...base,
      college_id: 'col-sample-014',
      name: 'Sample Universidad Nacional Autónoma',
      type: 'university',
      city: 'Ciudad de México',
      state_or_region: 'CDMX',
      country: 'MX',
      in_rgv: false,
      spanish_support: true,
      soccer_program: 'both',
      soccer_level: 'Liga MX U / amateur (sample)',
      cost_per_year_usd: 300,
      typical_aid_usd: 200,
      language_of_instruction: 'Spanish',
      admissions_notes_en: 'Highly competitive entrance exam (sample); nearly free tuition.',
      admissions_notes_es: 'Examen de admisión muy competitivo (muestra); colegiatura casi gratuita.',
      min_gpa: 3.5,
      soccer_scholarships: false,
      notes_en: 'World-class public university at near-zero tuition — entrance exam is the gate.',
      notes_es: 'Universidad pública de clase mundial casi gratis — el examen es la puerta.',
    },
    {
      ...base,
      college_id: 'col-sample-015',
      name: 'Sample University of Toronto',
      type: 'university',
      city: 'Toronto',
      state_or_region: 'Ontario',
      country: 'OTHER',
      in_rgv: false,
      spanish_support: false,
      soccer_program: 'both',
      soccer_level: 'U Sports (sample)',
      cost_per_year_usd: 45000,
      typical_aid_usd: 8000,
      language_of_instruction: 'English',
      admissions_notes_en: 'International student admission; study permit required (sample).',
      admissions_notes_es: 'Admisión internacional; se requiere permiso de estudios (muestra).',
      min_gpa: 3.6,
      soccer_scholarships: true,
      notes_en: 'Canada option for families with ties there (sample).',
      notes_es: 'Opción en Canadá para familias con vínculos allá (muestra).',
    },
    {
      ...base,
      college_id: 'col-sample-016',
      name: 'Sample Universidad de Buenos Aires Extension',
      type: 'university',
      city: 'Buenos Aires',
      state_or_region: 'CABA',
      country: 'OTHER',
      in_rgv: false,
      spanish_support: true,
      soccer_program: 'both',
      soccer_level: 'Club / amateur (sample)',
      cost_per_year_usd: 1500,
      typical_aid_usd: 500,
      language_of_instruction: 'Spanish',
      admissions_notes_en: 'CBC first-year cycle for international students (sample).',
      admissions_notes_es: 'Ciclo CBC de primer año para estudiantes internacionales (muestra).',
      min_gpa: 2.5,
      soccer_scholarships: false,
      notes_en: 'Argentina option — Spanish-speaking, soccer culture everywhere (sample).',
      notes_es: 'Opción en Argentina — en español, cultura futbolera por todas partes (muestra).',
    },
    {
      ...base,
      college_id: 'col-sample-017',
      name: 'Sample University of Manchester',
      type: 'university',
      city: 'Manchester',
      state_or_region: 'England',
      country: 'OTHER',
      in_rgv: false,
      spanish_support: false,
      soccer_program: 'both',
      soccer_level: 'BUCS league (sample)',
      cost_per_year_usd: 28000,
      typical_aid_usd: 6000,
      language_of_instruction: 'English',
      admissions_notes_en: 'UCAS application; student visa required (sample).',
      admissions_notes_es: 'Solicitud vía UCAS; se requiere visa de estudiante (muestra).',
      min_gpa: 3.4,
      soccer_scholarships: true,
      notes_en: 'England option — university soccer in a football city (sample).',
      notes_es: 'Opción en Inglaterra — fútbol universitario en una ciudad futbolera (muestra).',
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Scholarships — one per required category + extras                   */
/* ------------------------------------------------------------------ */

export function seedScholarshipsFull(): Scholarship[] {
  const base = {
    rolling_admission: false,
    essay_required: true,
    recommendations_required: 1,
    transcript_required: true,
    fafsa_required: false,
    active_status: true,
    created_at: '2026-09-01T00:00:00.000Z',
    updated_at: '2026-09-01T00:00:00.000Z',
  };
  return [
    {
      ...base,
      scholarship_id: 'sch-sample-001',
      name: 'Rio Grande Valley Futures Scholarship (Sample)',
      organization: 'TX Futures Alliance (Sample)',
      organization_type: 'Foundation',
      award_type: 'Renewable',
      award_amount_min: 1000,
      award_amount_max: 5000,
      typical_award_amount: 2500,
      number_of_awards: 20,
      renewable: true,
      max_years_renewable: 4,
      application_deadline: '2027-03-15',
      eligibility_criteria: {
        gpa_minimum: 2.5,
        geographic_restrictions: { counties: ['Cameron', 'Hidalgo', 'Willacy', 'Starr'] },
        demographic_requirements: { first_generation: true },
      },
      categories: ['Need-Based', 'Regional'],
      tags: ['RGV', 'First Generation', 'Sample – to verify'],
      fafsa_required: true,
    },
    {
      ...base,
      scholarship_id: 'sch-sample-002',
      name: 'Border Scholars Athletic Award (Sample)',
      organization: 'FC Brownsville Foundation (Sample)',
      organization_type: 'Athletic',
      award_type: 'One-time',
      award_amount_min: 500,
      award_amount_max: 2000,
      typical_award_amount: 1000,
      number_of_awards: 10,
      renewable: false,
      application_deadline: '2027-04-01',
      eligibility_criteria: {
        gpa_minimum: 2.0,
        athletic_requirements: { required: true, sports: ['Soccer'] },
      },
      categories: ['Athletic'],
      tags: ['Soccer', 'RGV', 'Sample – to verify'],
    },
    {
      ...base,
      scholarship_id: 'sch-sample-003',
      name: 'First-Gen STEM Pathways Grant (Sample)',
      organization: 'South Texas Education Fund (Sample)',
      organization_type: 'Foundation',
      award_type: 'Full-ride',
      award_amount_min: 10000,
      award_amount_max: 40000,
      typical_award_amount: 20000,
      number_of_awards: 5,
      renewable: true,
      max_years_renewable: 4,
      application_deadline: '2027-01-31',
      early_deadline: '2026-12-15',
      eligibility_criteria: {
        gpa_minimum: 3.5,
        major_restrictions: ['STEM', 'Engineering', 'Computer Science'],
        demographic_requirements: { first_generation: true },
        test_scores: { sat_minimum: 1200 },
      },
      categories: ['Merit-Based', 'STEM', 'Need-Based'],
      tags: ['First Generation', 'STEM', 'Sample – to verify'],
    },
    {
      ...base,
      scholarship_id: 'sch-sample-004',
      name: 'Career & Technical Education Boost (Sample)',
      organization: 'RGV Workforce Board (Sample)',
      organization_type: 'Government',
      award_type: 'One-time',
      award_amount_min: 750,
      award_amount_max: 3000,
      typical_award_amount: 1500,
      number_of_awards: 40,
      renewable: false,
      application_deadline: '2027-05-30',
      eligibility_criteria: {
        gpa_minimum: 2.0,
        major_restrictions: ['Career/Technical'],
      },
      categories: ['Career/Technical', 'Need-Based'],
      tags: ['CTE', 'Certificates', 'Sample – to verify'],
      essay_required: false,
    },
    {
      ...base,
      scholarship_id: 'sch-sample-005',
      name: 'Puente Internacional Study Award (Sample)',
      organization: 'TXFA International Partners (Sample)',
      organization_type: 'Private',
      award_type: 'Partial',
      award_amount_min: 1500,
      award_amount_max: 6000,
      typical_award_amount: 3000,
      number_of_awards: 8,
      renewable: false,
      application_deadline: '2027-02-15',
      eligibility_criteria: {
        gpa_minimum: 3.0,
        special_requirements: ['Essay', 'Recommendation Letters'],
      },
      categories: ['International Study', 'Merit-Based'],
      tags: ['Spain', 'Mexico', 'Bilingual', 'Sample – to verify'],
    },
    {
      ...base,
      scholarship_id: 'sch-sample-006',
      name: 'Valley Need-Based Promise (Sample)',
      organization: 'RGV Community Fund (Sample)',
      organization_type: 'Foundation',
      award_type: 'Renewable',
      award_amount_min: 500,
      award_amount_max: 2500,
      typical_award_amount: 1200,
      number_of_awards: 50,
      renewable: true,
      max_years_renewable: 2,
      application_deadline: '2027-04-15',
      eligibility_criteria: {
        gpa_minimum: 2.0,
        geographic_restrictions: { counties: ['Cameron', 'Hidalgo'] },
      },
      categories: ['Need-Based'],
      tags: ['RGV', 'FAFSA/TASFA required', 'Sample – to verify'],
      fafsa_required: true,
      essay_required: false,
    },
    {
      ...base,
      scholarship_id: 'sch-sample-007',
      name: 'Hispanic Serving Futures Award (Sample)',
      organization: 'Consorcio Educativo del Valle (Sample)',
      organization_type: 'Foundation',
      award_type: 'One-time',
      award_amount_min: 1000,
      award_amount_max: 3000,
      typical_award_amount: 2000,
      number_of_awards: 15,
      renewable: false,
      application_deadline: '2027-02-28',
      eligibility_criteria: {
        gpa_minimum: 2.8,
        demographic_requirements: { hispanic_serving_intent: true },
      },
      categories: ['Hispanic/Latino-Serving'],
      tags: ['Hispanic', 'Bilingual', 'Sample – to verify'],
    },
    {
      ...base,
      scholarship_id: 'sch-sample-008',
      name: 'Texas Regional Scholars (Sample)',
      organization: 'Texas Higher Education Board (Sample)',
      organization_type: 'Government',
      award_type: 'Renewable',
      award_amount_min: 2000,
      award_amount_max: 4000,
      typical_award_amount: 3000,
      number_of_awards: 100,
      renewable: true,
      max_years_renewable: 4,
      application_deadline: '2027-01-15',
      eligibility_criteria: {
        gpa_minimum: 3.0,
        geographic_restrictions: { states: ['TX'] },
      },
      categories: ['Regional', 'Merit-Based'],
      tags: ['Texas', 'Sample – to verify'],
      fafsa_required: true,
    },
    {
      ...base,
      scholarship_id: 'sch-sample-009',
      name: 'Racing Pathway Santander Exchange (Sample)',
      organization: 'TXFA × Racing de Santander Partnership (Sample)',
      organization_type: 'Private',
      award_type: 'Partial',
      award_amount_min: 2000,
      award_amount_max: 8000,
      typical_award_amount: 5000,
      number_of_awards: 4,
      renewable: false,
      application_deadline: '2027-03-01',
      eligibility_criteria: {
        gpa_minimum: 2.8,
        athletic_requirements: { required: true, sports: ['Soccer'] },
        special_requirements: ['Open to studying in Spain'],
      },
      categories: ['International Study', 'Athletic'],
      tags: ['Spain', 'Santander', 'Soccer', 'Sample – to verify'],
    },
    {
      ...base,
      scholarship_id: 'sch-sample-010',
      name: 'Next Play Soccer Scholarship (Sample)',
      organization: 'Valley Sports Alliance (Sample)',
      organization_type: 'Athletic',
      award_type: 'One-time',
      award_amount_min: 750,
      award_amount_max: 2500,
      typical_award_amount: 1500,
      number_of_awards: 12,
      renewable: false,
      application_deadline: '2027-05-01',
      eligibility_criteria: {
        gpa_minimum: 2.5,
        athletic_requirements: { required: true, sports: ['Soccer'] },
      },
      categories: ['Athletic'],
      tags: ['Soccer', 'Recruiting profile required', 'Sample – to verify'],
    },
    {
      ...base,
      scholarship_id: 'sch-sample-011',
      name: 'STEM Frontera Award (Sample)',
      organization: 'Space Coast Education Partners (Sample)',
      organization_type: 'Corporate',
      award_type: 'One-time',
      award_amount_min: 1500,
      award_amount_max: 1500,
      typical_award_amount: 1500,
      number_of_awards: 10,
      renewable: false,
      application_deadline: '2027-04-30',
      eligibility_criteria: {
        gpa_minimum: 3.0,
        major_restrictions: ['STEM'],
      },
      categories: ['STEM'],
      tags: ['Aerospace', 'RGV', 'Sample – to verify'],
    },
    {
      ...base,
      scholarship_id: 'sch-sample-012',
      name: 'Merit Honors Beca (Sample)',
      organization: 'Valley Honors Foundation (Sample)',
      organization_type: 'Foundation',
      award_type: 'Renewable',
      award_amount_min: 1000,
      award_amount_max: 1000,
      typical_award_amount: 1000,
      number_of_awards: 25,
      renewable: true,
      max_years_renewable: 4,
      application_deadline: '2027-06-01',
      eligibility_criteria: {
        gpa_minimum: 3.7,
      },
      categories: ['Merit-Based'],
      tags: ['High GPA', 'Sample – to verify'],
    },
    {
      ...base,
      scholarship_id: 'sch-sample-013',
      name: 'México Becas Cross-Border Grant (Sample)',
      organization: 'Instituto de los Mexicanos en el Exterior (Sample)',
      organization_type: 'Government',
      award_type: 'One-time',
      award_amount_min: 800,
      award_amount_max: 2000,
      typical_award_amount: 1200,
      number_of_awards: 20,
      renewable: false,
      application_deadline: '2027-03-31',
      eligibility_criteria: {
        gpa_minimum: 2.5,
        special_requirements: ['Planning to study in Mexico'],
      },
      categories: ['International Study'],
      tags: ['Mexico', 'Bilingual', 'Sample – to verify'],
    },
    {
      ...base,
      scholarship_id: 'sch-sample-014',
      name: 'Women in the Game Award (Sample)',
      organization: 'RGV Women in Sports Network (Sample)',
      organization_type: 'Foundation',
      award_type: 'One-time',
      award_amount_min: 500,
      award_amount_max: 1500,
      typical_award_amount: 1000,
      number_of_awards: 8,
      renewable: false,
      application_deadline: '2027-04-20',
      eligibility_criteria: {
        gpa_minimum: 2.5,
        athletic_requirements: { required: true, sports: ['Soccer'] },
        demographic_requirements: { women_in_sports: true },
      },
      categories: ['Athletic', 'Merit-Based'],
      tags: ['Soccer', 'Girls', 'Sample – to verify'],
    },
    {
      ...base,
      scholarship_id: 'sch-sample-015',
      name: 'Espuela de Oro Legacy Scholarship (Sample)',
      organization: 'Familia Espuela Endowment (Sample)',
      organization_type: 'Private',
      award_type: 'Renewable',
      award_amount_min: 2500,
      award_amount_max: 2500,
      typical_award_amount: 2500,
      number_of_awards: 6,
      renewable: true,
      max_years_renewable: 4,
      application_deadline: '2027-02-01',
      eligibility_criteria: {
        gpa_minimum: 3.2,
        geographic_restrictions: { counties: ['Cameron'] },
        demographic_requirements: { first_generation: true },
      },
      categories: ['Need-Based', 'Merit-Based', 'Regional'],
      tags: ['Cameron County', 'First Generation', 'Sample – to verify'],
      recommendations_required: 2,
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Matching engine (stand-in for the AI matcher)                        */
/* ------------------------------------------------------------------ */

export interface StudentMatchContext {
  gpa: number | null;
  grades_source: GradeSource | 'none';
  first_generation: boolean | null;
  hispanic: boolean | null;
  county: string | null;
  has_athletic_soccer: boolean;
  open_to: string[];
  interests: string[];
  has_sat: boolean;
  sat_total: number | null;
  fafsa_note_seen: boolean;
}

export function computeMatch(sch: Scholarship, ctx: StudentMatchContext): Omit<ScholarshipMatch, 'match_id' | 'student_id' | 'scholarship_id'> {
  const crit = (sch.eligibility_criteria ?? {}) as {
    gpa_minimum?: number;
    geographic_restrictions?: { counties?: string[]; states?: string[] };
    demographic_requirements?: { first_generation?: boolean; hispanic_serving_intent?: boolean; women_in_sports?: boolean };
    athletic_requirements?: { required?: boolean; sports?: string[] };
    major_restrictions?: string[];
    test_scores?: { sat_minimum?: number };
  };
  const why_en: string[] = [];
  const why_es: string[] = [];
  const missing_en: string[] = [];
  const missing_es: string[] = [];
  let score = 45;
  let met = 0;
  let total = 0;

  // GPA
  if (crit.gpa_minimum != null) {
    total += 1;
    if (ctx.gpa == null) {
      missing_en.push('Add your grades to check the GPA requirement');
      missing_es.push('Agrega tus calificaciones para revisar el requisito de promedio');
    } else if (ctx.gpa >= crit.gpa_minimum) {
      met += 1;
      score += 18;
      why_en.push(`Your GPA (${ctx.gpa.toFixed(1)}) meets the ${crit.gpa_minimum} minimum`);
      why_es.push(`Tu promedio (${ctx.gpa.toFixed(1)}) cumple el mínimo de ${crit.gpa_minimum}`);
    } else {
      score -= 18;
      missing_en.push(`This one asks for a ${crit.gpa_minimum} GPA — your counselor can talk options`);
      missing_es.push(`Esta pide promedio de ${crit.gpa_minimum} — tu consejero puede ver opciones contigo`);
    }
  }
  // Geography
  const counties = crit.geographic_restrictions?.counties;
  if (counties?.length) {
    total += 1;
    if (ctx.county && counties.includes(ctx.county)) {
      met += 1;
      score += 10;
      why_en.push('You live in an eligible county');
      why_es.push('Vives en un condado elegible');
    }
  } else if (crit.geographic_restrictions?.states?.includes('TX')) {
    met += 1;
    score += 8;
    why_en.push('Open to Texas residents');
    why_es.push('Abierta a residentes de Texas');
  }
  // First generation
  if (crit.demographic_requirements?.first_generation) {
    total += 1;
    if (ctx.first_generation === true) {
      met += 1;
      score += 10;
      why_en.push('You said you would be the first in your family to go to college');
      why_es.push('Dijiste que serías la primera persona de tu familia en ir a la universidad');
    } else if (ctx.first_generation == null) {
      missing_en.push('Answer the first-generation question in the Compass to check this');
      missing_es.push('Responde la pregunta de primera generación en el Compass para revisar esto');
    }
  }
  // Hispanic-serving
  if (crit.demographic_requirements?.hispanic_serving_intent) {
    total += 1;
    if (ctx.hispanic === true) {
      met += 1;
      score += 8;
      why_en.push('Matches your background and bilingual strengths');
      why_es.push('Va con tu historia y tus fortalezas bilingües');
    }
  }
  // Athletic
  if (crit.athletic_requirements?.required) {
    total += 1;
    if (ctx.has_athletic_soccer) {
      met += 1;
      score += 12;
      why_en.push('Your soccer profile matches the athletic requirement');
      why_es.push('Tu perfil de fútbol cumple el requisito deportivo');
    } else {
      missing_en.push('Add a sports profile to qualify for this athletic award');
      missing_es.push('Agrega tu perfil deportivo para calificar para esta beca deportiva');
    }
  }
  // SAT
  if (crit.test_scores?.sat_minimum) {
    total += 1;
    if (ctx.has_sat && (ctx.sat_total ?? 0) >= crit.test_scores.sat_minimum) {
      met += 1;
      score += 10;
      why_en.push('Your SAT score meets the minimum');
      why_es.push('Tu puntaje SAT cumple el mínimo');
    } else if (!ctx.has_sat) {
      missing_en.push('Add your SAT score to unlock this requirement');
      missing_es.push('Agrega tu puntaje SAT para desbloquear este requisito');
    }
  }
  // International
  if (sch.categories?.includes('International Study')) {
    total += 1;
    const wants = ctx.open_to.some((o) => ['mexico', 'spain', 'other_country'].includes(o));
    if (wants) {
      met += 1;
      score += 10;
      why_en.push('You told the Compass you are open to studying abroad');
      why_es.push('Le dijiste al Compass que estás abierto a estudiar fuera');
    }
  }
  // CTE
  if (sch.categories?.includes('Career/Technical') && ctx.interests.length > 0) {
    score += 6;
    why_en.push('Pairs with your certificate-career interests');
    why_es.push('Combina con tus intereses de carreras de certificado');
  }
  // STEM interests
  if (sch.categories?.includes('STEM') && ctx.interests.some((i) => ['tech', 'health'].includes(i))) {
    score += 6;
    why_en.push('Your interests lean STEM');
    why_es.push('Tus intereses van hacia STEM');
  }
  // FAFSA required nudge
  if (sch.fafsa_required) {
    missing_en.push('Needs FAFSA or TASFA — the parent-only Financial aid helper walks through it');
    missing_es.push('Necesita FAFSA o TASFA — el ayudante de ayuda financiera (solo padres) lo explica paso a paso');
  }

  score = Math.max(5, Math.min(98, score));
  const deadline = sch.application_deadline;
  const days = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000);
  return {
    match_score: score,
    probability_of_award: Math.max(2, Math.min(90, score - 40)),
    match_rationale: {
      strengths: why_en,
      weaknesses: missing_en,
      requirements_met: met,
      requirements_total: total,
      competitive_advantages: ctx.first_generation ? ['First-generation college student'] : [],
    },
    application_deadline: deadline,
    days_until_deadline: days,
    priority_level: days < 7 ? 'Critical' : days < 30 ? 'High' : days < 60 ? 'Medium' : 'Low',
    application_status: 'not_started',
    viewed_by_student: false,
    bookmarked: false,
    dismissed: false,
    calculated_at: new Date().toISOString(),
    why_match_en: why_en,
    why_match_es: why_es,
    missing_en: missing_en,
    missing_es: missing_es,
    grades_source: ctx.grades_source,
  };
}

/* ------------------------------------------------------------------ */
/* Seeded applications + outcomes for demo personas                     */
/* ------------------------------------------------------------------ */

export function seedScholarshipApplicationsFull(): ScholarshipApplication[] {
  return [
    {
      application_id: 'schapp-sample-001',
      student_id: 'sample-121', // Damián
      scholarship_id: 'sch-sample-002',
      started_at: '2026-09-20T10:00:00.000Z',
      submitted_at: null,
      status: 'in_progress',
      materials_checklist: {
        essay: 'drafted',
        transcript: 'uploaded',
        recommendation_letters: { requested: 1, received: 0 },
      },
      completion_percentage: 55,
      student_notes: 'Waiting on Coach Ramírez letter (sample).',
      counselor_assisted: true,
    } as ScholarshipApplication,
    {
      application_id: 'schapp-sample-002',
      student_id: 'sample-121', // Damián
      scholarship_id: 'sch-sample-003',
      started_at: '2026-09-10T10:00:00.000Z',
      submitted_at: '2026-09-28T16:30:00.000Z',
      status: 'submitted',
      materials_checklist: {
        essay: 'final',
        transcript: 'uploaded',
        recommendation_letters: { requested: 2, received: 2 },
      },
      completion_percentage: 100,
      counselor_assisted: true,
    } as ScholarshipApplication,
    {
      application_id: 'schapp-sample-003',
      student_id: 'sample-127', // Andrea
      scholarship_id: 'sch-sample-005',
      started_at: '2026-09-05T10:00:00.000Z',
      submitted_at: '2026-09-30T11:00:00.000Z',
      status: 'awarded',
      outcome: 'awarded',
      award_amount: 3000,
      award_years: 1,
      decision_date: '2026-10-05',
      materials_checklist: {
        essay: 'final',
        transcript: 'uploaded',
        recommendation_letters: { requested: 1, received: 1 },
      },
      completion_percentage: 100,
      counselor_assisted: true,
    } as ScholarshipApplication,
  ];
}

export function seedScholarshipOutcomesFull(): ScholarshipOutcome[] {
  return [
    {
      outcome_id: 'out-sample-001',
      application_id: 'schapp-sample-003',
      student_id: 'sample-127',
      scholarship_id: 'sch-sample-005',
      awarded: true,
      award_year: 2027,
      award_amount: 3000,
      decision_date: '2026-10-05',
      notes: 'Puente Internacional — fall disbursement pending enrollment verification (sample).',
    },
  ];
}
