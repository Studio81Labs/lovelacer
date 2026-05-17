import { createI18n } from 'vue-i18n'
import en from '../locales/en.json'
import cs from '../locales/cs.json'
import de from '../locales/de.json'
import es from '../locales/es.json'
import fr from '../locales/fr.json'
import it from '../locales/it.json'
import nl from '../locales/nl.json'
import pl from '../locales/pl.json'
import { detectInitialLocale } from './locale-detect.js'

export type UiLocale = 'en' | 'cs' | 'de' | 'es' | 'fr' | 'it' | 'nl' | 'pl'
export const SUPPORTED_LOCALES: readonly UiLocale[] = [
  'en',
  'cs',
  'de',
  'es',
  'fr',
  'it',
  'nl',
  'pl',
]

export const i18n = createI18n({
  legacy: false,
  locale: detectInitialLocale(),
  fallbackLocale: 'en',
  flatJson: true,
  messages: { en, cs, de, es, fr, it, nl, pl },
})
