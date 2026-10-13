import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import en from './en.json';
import es from './es.json';

export type Lang = 'en' | 'es';
type Dict = typeof en;
const dicts: Record<Lang, Dict> = { en, es: es as Dict };
const LANG_KEY = 'txfa.lang';

interface I18nCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  /** Dot-path lookup with {var} interpolation: t('home.greetingStudent', { name }) */
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const Ctx = createContext<I18nCtx | null>(null);

function lookup(dict: Record<string, unknown>, key: string): string {
  const parts = key.split('.');
  let cur: unknown = dict;
  for (const p of parts) {
    if (cur && typeof cur === 'object' && p in cur) cur = (cur as Record<string, unknown>)[p];
    else return key;
  }
  return typeof cur === 'string' ? cur : key;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    try {
      const saved = localStorage.getItem(LANG_KEY);
      if (saved === 'en' || saved === 'es') return saved;
      return navigator.language?.toLowerCase().startsWith('es') ? 'es' : 'en';
    } catch {
      return 'en';
    }
  });

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(LANG_KEY, l);
    } catch {
      /* ignore */
    }
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      let str = lookup(dicts[lang] as unknown as Record<string, unknown>, key);
      if (str === key && lang !== 'en') {
        str = lookup(dicts.en as unknown as Record<string, unknown>, key); // fall back to EN
      }
      if (vars) {
        Object.entries(vars).forEach(([k, v]) => {
          str = str.replaceAll(`{${k}}`, String(v));
        });
      }
      return str;
    },
    [lang],
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18nCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider');
  return ctx;
}
