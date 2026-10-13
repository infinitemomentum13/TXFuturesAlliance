/** Literal class strings for pathway accents (Tailwind can't compile
 *  dynamic class names, so accents are mapped explicitly). */
export const ACCENT = {
  career: {
    text: 'text-career',
    bg: 'bg-career',
    soft: 'bg-career-soft',
    border: 'border-career',
  },
  college: {
    text: 'text-college',
    bg: 'bg-college',
    soft: 'bg-college-soft',
    border: 'border-college',
  },
  sports: {
    text: 'text-sports',
    bg: 'bg-sports',
    soft: 'bg-sports-soft',
    border: 'border-sports',
  },
} as const;

export type PathwayAccent = keyof typeof ACCENT;
