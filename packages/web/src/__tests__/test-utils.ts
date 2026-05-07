import { createI18n } from 'vue-i18n'
import en from '../locales/en.json'

/**
 * P2-9 — test-only i18n instance.
 *
 * Tests use the real EN locale catalog so existing wrapper.text()
 * assertions like `expect(wrapper.text()).toContain('Continue')`
 * keep passing — EN is what they assert. CS/DE plural-rule
 * behaviour gets its own targeted suite at
 * src/i18n/__tests__/plural-rules.test.ts.
 */
export function createTestI18n() {
  return createI18n({
    legacy: false,
    locale: 'en',
    fallbackLocale: 'en',
    flatJson: true,
    messages: { en },
  })
}
