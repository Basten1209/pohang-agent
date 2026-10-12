import {
  Fragment,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import type { Locale, MessageKey } from './index'
import { translateText } from './phrases'
import {
  defaultLocale,
  htmlLang,
  isLocale,
  translate,
  translateData,
} from './index'

export const LOCALE_KEY = 'run2-locale'

/** The device's chosen language; Korean when unset or storage is unavailable. */
export const readLocale = (): Locale => {
  try {
    const saved = localStorage.getItem(LOCALE_KEY)
    return isLocale(saved) ? saved : defaultLocale
  } catch {
    return defaultLocale
  }
}

// Run before first paint so screen readers and fonts get the right language.
export const localeBootstrap = `try{var l=localStorage.getItem('${LOCALE_KEY}');var m=${JSON.stringify(htmlLang)};if(m[l])document.documentElement.lang=m[l]}catch(e){}`

type I18n = {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: MessageKey, vars?: Record<string, string | number>) => string
  /** A config name (mode, course, interest, hub) in this language. */
  d: (key: string, korean: string) => string
  /** Server-written Korean text, translated when it is a known phrase. */
  tx: (text: string) => string
}

const make = (locale: Locale, setLocale: (l: Locale) => void): I18n => ({
  locale,
  setLocale,
  t: (key, vars) => translate(locale, key, vars),
  d: (key, korean) => translateData(locale, key, korean),
  tx: (text) => translateText(locale, text),
})

const Context = createContext<I18n>(make(defaultLocale, () => undefined))

export const LocaleProvider = ({ children }: { children: ReactNode }) => {
  const [locale, setLocaleState] = useState<Locale>(() =>
    typeof window === 'undefined' ? defaultLocale : readLocale(),
  )
  useEffect(() => {
    document.documentElement.lang = htmlLang[locale]
  }, [locale])
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === LOCALE_KEY || event.key === null)
        setLocaleState(readLocale())
    }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])
  const value = useMemo(
    () =>
      make(locale, (next) => {
        setLocaleState(next)
        try {
          localStorage.setItem(LOCALE_KEY, next)
        } catch {
          // Applies for this visit.
        }
      }),
    [locale],
  )
  return <Context.Provider value={value}>{children}</Context.Provider>
}

export const useI18n = () => useContext(Context)

/** A message with **bold** spans and an optional {icon} slot. */
export const Rich = ({ text, icon }: { text: string; icon?: ReactNode }) =>
  text
    .split(/(\*\*[^*]+\*\*|\{icon\})/)
    .map((part, i) =>
      part === '{icon}' ? (
        <Fragment key={i}>{icon}</Fragment>
      ) : part.startsWith('**') ? (
        <strong key={i}>{part.slice(2, -2)}</strong>
      ) : (
        part
      ),
    )
