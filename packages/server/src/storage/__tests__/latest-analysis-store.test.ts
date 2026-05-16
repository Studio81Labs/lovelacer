import { describe, it, expect } from 'vitest'
import { LatestAnalysisStore } from '../latest-analysis-store.js'

const sample = {
  rooms: [],
  misc: [],
  administrative: [],
  hidden: [],
  summary: { entityCount: 0, roomCount: 0, miscCount: 0 },
  config: { title: 'Lovelacer — Home', views: [] },
  diff: null,
  suggestions: [],
}

describe('LatestAnalysisStore', () => {
  it('returns null before any analysis is saved', () => {
    const store = new LatestAnalysisStore(':memory:')
    try {
      expect(store.get()).toBeNull()
    } finally {
      store.close()
    }
  })

  it('round-trips the latest analysis payload', () => {
    const store = new LatestAnalysisStore(':memory:')
    try {
      store.save(sample)
      const got = store.get<typeof sample>()
      expect(got?.analysis).toEqual(sample)
      expect(got?.analyzedAt).toBeGreaterThan(0)
    } finally {
      store.close()
    }
  })

  it('keeps only the most recent analysis', () => {
    const store = new LatestAnalysisStore(':memory:')
    try {
      store.save(sample)
      const next = {
        ...sample,
        summary: { entityCount: 2, roomCount: 1, miscCount: 0 },
      }
      store.save(next)
      expect(store.get<typeof next>()?.analysis.summary).toEqual(next.summary)
    } finally {
      store.close()
    }
  })

  it('clears the saved analysis', () => {
    const store = new LatestAnalysisStore(':memory:')
    try {
      store.save(sample)
      store.clear()
      expect(store.get()).toBeNull()
    } finally {
      store.close()
    }
  })
})
