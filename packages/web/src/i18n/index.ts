import { createI18n } from 'vue-i18n'
import en from '../locales/en.json'
import cs from '../locales/cs.json'
import de from '../locales/de.json'
import { detectInitialLocale } from './locale-detect.js'

export type UiLocale = 'en' | 'cs' | 'de'
export const SUPPORTED_LOCALES: readonly UiLocale[] = ['en', 'cs', 'de']

export const i18n = createI18n({
  legacy: false,
  locale: detectInitialLocale(),
  fallbackLocale: 'en',
  messages: { en, cs, de },
})
