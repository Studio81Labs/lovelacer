import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  postApply,
  postPreview,
  postDismissSuggestion,
  getOverrides,
  putOverrides,
  getInvite,
  postInvite,
} from '../../api/client.js'
import type { ApiError, LovelaceConfig, Override, PreviewOutput } from '../../api/types.js'

const mockPreviewResponse: PreviewOutput = {
  rooms: [],
  misc: [],
  summary: { entityCount: 0, roomCount: 0, miscCount: 0 },
  config: { title: 'Lovelacer — Home', views: [] },
  diff: null,
  suggestions: [],
}

const mockConfig: LovelaceConfig = {
  title: 'Lovelacer — Home',
  views: [],
}

describe('postPreview', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns parsed body on 200', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockPreviewResponse),
    } as unknown as Response)

    const result = await postPreview()
    expect(result).toEqual(mockPreviewResponse)
    expect(globalThis.fetch).toHaveBeenCalledWith('api/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
  })

  it('throws ApiError when server returns 503 with structured body', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: () =>
        Promise.resolve({
          error: 'ha_unavailable',
          message: 'Home Assistant connection not ready',
        }),
    } as unknown as Response)

    await expect(postPreview()).rejects.toMatchObject({
      error: 'ha_unavailable',
      message: 'Home Assistant connection not ready',
    } satisfies ApiError)
  })

  it('throws network ApiError when fetch rejects', async () => {
    const cause = new Error('connection refused')
    globalThis.fetch = vi.fn().mockRejectedValueOnce(cause)

    await expect(postPreview()).rejects.toMatchObject({
      error: 'network',
    })
  })

  it('throws network ApiError when response is non-JSON 500', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.reject(new Error('not json')),
    } as unknown as Response)

    await expect(postPreview()).rejects.toMatchObject({
      error: 'network',
      message: 'HTTP 500',
    })
  })
})

describe('postApply', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('sends config in body and returns parsed result on 200', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ ok: true, urlPath: 'lovelacer-home', created: true }),
    } as unknown as Response)

    const result = await postApply({ config: mockConfig })
    expect(result).toEqual({ ok: true, urlPath: 'lovelacer-home', created: true })
    expect(globalThis.fetch).toHaveBeenCalledWith('api/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config: mockConfig }),
    })
  })

  it('throws ApiError with step preserved on 502 ha_apply_failed', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 502,
      json: () =>
        Promise.resolve({
          error: 'ha_apply_failed',
          step: 'save',
          message: 'config invalid',
        }),
    } as unknown as Response)

    await expect(postApply({ config: mockConfig })).rejects.toMatchObject({
      error: 'ha_apply_failed',
      step: 'save',
      message: 'config invalid',
    })
  })

  it('forwards snapshot in the request body when provided', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ ok: true, urlPath: 'home', created: false }),
    } as unknown as Response)

    const snapshot = {
      assignments: [{ entityId: 'light.k', roomId: 'kitchen' }],
      config: mockConfig,
    }
    await postApply({ config: mockConfig, snapshot })

    const callArgs = vi.mocked(globalThis.fetch).mock.calls[0]
    expect(callArgs).toBeDefined()
    // eslint-disable-next-line no-undef
    const init = callArgs![1] as RequestInit
    const callBody = JSON.parse(init.body as string) as Record<string, unknown>
    expect(callBody.config).toEqual(mockConfig)
    expect(callBody.snapshot).toEqual(snapshot)
  })

  it('omits snapshot from the body when not provided', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ ok: true, urlPath: 'home', created: false }),
    } as unknown as Response)

    await postApply({ config: mockConfig })

    const callArgs = vi.mocked(globalThis.fetch).mock.calls[0]
    expect(callArgs).toBeDefined()
    // eslint-disable-next-line no-undef
    const init = callArgs![1] as RequestInit
    const callBody = JSON.parse(init.body as string) as Record<string, unknown>
    expect(callBody.snapshot).toBeUndefined()
    expect(callBody.config).toEqual(mockConfig)
  })
})

describe('getOverrides', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns parsed body on 200', async () => {
    const mockResponse = {
      overrides: [{ entityId: 'light.kitchen_ceiling', roomId: 'living_room' }],
    }
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    } as unknown as Response)

    const result = await getOverrides()
    expect(result).toEqual(mockResponse)
    expect(globalThis.fetch).toHaveBeenCalledWith('api/overrides', {})
  })

  it('throws ApiError on storage_error 500', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () =>
        Promise.resolve({
          error: 'storage_error',
          message: 'disk full',
        }),
    } as unknown as Response)

    await expect(getOverrides()).rejects.toMatchObject({
      error: 'storage_error',
      message: 'disk full',
    } satisfies ApiError)
  })
})

describe('putOverrides', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('sends PUT with the body and returns the echoed list on 200', async () => {
    const body = {
      overrides: [{ entityId: 'light.a', roomId: 'kitchen' }] as Override[],
    }
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(body),
    } as unknown as Response)

    const result = await putOverrides(body)
    expect(result).toEqual(body)
    expect(globalThis.fetch).toHaveBeenCalledWith('api/overrides', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  })

  it('throws ApiError on invalid_body 400', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: () =>
        Promise.resolve({
          error: 'invalid_body',
          message: 'duplicate entityId',
        }),
    } as unknown as Response)

    await expect(putOverrides({ overrides: [] })).rejects.toMatchObject({
      error: 'invalid_body',
      message: 'duplicate entityId',
    } satisfies ApiError)
  })
})

describe('getInvite', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns parsed body on 200', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ accepted: true }),
    } as unknown as Response)

    const result = await getInvite()
    expect(result).toEqual({ accepted: true })
    expect(globalThis.fetch).toHaveBeenCalledWith('api/invite', {})
  })
})

describe('postInvite', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('sends POST with body and returns parsed result', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ accepted: true }),
    } as unknown as Response)

    const result = await postInvite({ code: 'BETA-2026-ALPHA' })
    expect(result).toEqual({ accepted: true })
    expect(globalThis.fetch).toHaveBeenCalledWith('api/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'BETA-2026-ALPHA' }),
    })
  })

  it('throws ApiError on invalid_code 400', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: () =>
        Promise.resolve({
          error: 'invalid_code',
          message: 'Invite code not recognized.',
        }),
    } as unknown as Response)

    await expect(postInvite({ code: 'WRONG' })).rejects.toMatchObject({
      error: 'invalid_code',
    })
  })
})

describe('postDismissSuggestion', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('POSTs to api/suggestions/dismiss with body and returns void on 200', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ ok: true }),
    } as unknown as Response)

    await expect(
      postDismissSuggestion({ entityId: 'sensor.foo', suggestionType: 'set_area_id' }),
    ).resolves.toBeUndefined()

    expect(globalThis.fetch).toHaveBeenCalledWith('api/suggestions/dismiss', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entityId: 'sensor.foo', suggestionType: 'set_area_id' }),
    })
  })

  it('throws ApiError when server returns 400 invalid_body', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: () =>
        Promise.resolve({
          error: 'invalid_body',
          message: 'entityId required',
        }),
    } as unknown as Response)

    await expect(
      postDismissSuggestion({ entityId: '', suggestionType: 'set_area_id' }),
    ).rejects.toMatchObject({
      error: 'invalid_body',
    })
  })

  it('throws ApiError when server returns 500 storage_error', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () =>
        Promise.resolve({
          error: 'storage_error',
          message: 'disk full',
        }),
    } as unknown as Response)

    await expect(
      postDismissSuggestion({ entityId: 'sensor.foo', suggestionType: 'set_area_id' }),
    ).rejects.toMatchObject({
      error: 'storage_error',
    })
  })
})
