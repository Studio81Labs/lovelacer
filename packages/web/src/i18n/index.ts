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

function selectTwoFormPlural(choice: number): number {
  return Math.abs(choice) === 1 ? 0 : 1
}

function clampPluralChoice(choice: number, choicesLength: number): number {
  return Math.min(choice, Math.max(choicesLength - 1, 0))
}

function selectCzechPlural(choice: number, choicesLength: number): number {
  if (choicesLength <= 1) return 0
  if (choicesLength === 2) return selectTwoFormPlural(choice)

  const count = Math.abs(choice)
  if (count === 1) return 0
  if (count >= 2 && count <= 4) return 1
  return clampPluralChoice(2, choicesLength)
}

function selectPolishPlural(choice: number, choicesLength: number): number {
  if (choicesLength <= 1) return 0
  if (choicesLength === 2) return selectTwoFormPlural(choice)

  const count = Math.abs(choice)
  const mod10 = count % 10
  const mod100 = count % 100
  if (count === 1) return 0
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 1
  return clampPluralChoice(2, choicesLength)
}

export const pluralRules = {
  cs: selectCzechPlural,
  pl: selectPolishPlural,
}

export const i18n = createI18n({
  legacy: false,
  locale: detectInitialLocale(),
  fallbackLocale: 'en',
  flatJson: true,
  messages: { en, cs, de, es, fr, it, nl, pl },
  pluralRules,
})
