import type {
  AnalyzeOutput,
  ApiError,
  ApplyResult,
  LovelaceConfig,
  Override,
  PreviewOutput,
} from './types.js'

/**
 * Wraps a `fetch()` to a backend route in the standard error envelope.
 * URL is document-relative (no leading slash) so the request stays inside
 * the add-on path under HA Supervisor ingress (`/api/hassio_ingress/<token>/`).
 * Vite's dev proxy resolves the same path to the backend at :3000.
 */
async function fetchJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(path, init)
  } catch (cause) {
    throw {
      error: 'network',
      message: cause instanceof Error ? cause.message : String(cause),
    } satisfies ApiError
  }

  if (!res.ok) {
    const parsed: unknown = await res.json().catch(() => null)
    if (
      parsed !== null &&
      typeof parsed === 'object' &&
      typeof (parsed as { error?: unknown }).error === 'string' &&
      typeof (parsed as { message?: unknown }).message === 'string'
    ) {
      throw parsed as ApiError
    }
    throw {
      error: 'network',
      message: `HTTP ${res.status}`,
    } satisfies ApiError
  }

  return res.json() as Promise<T>
}

const JSON_HEADERS = { 'Content-Type': 'application/json' } as const

export function postAnalyze(): Promise<AnalyzeOutput> {
  return fetchJson<AnalyzeOutput>('api/analyze', { method: 'POST', headers: JSON_HEADERS })
}

export function postPreview(): Promise<PreviewOutput> {
  return fetchJson<PreviewOutput>('api/preview', { method: 'POST', headers: JSON_HEADERS })
}

export function postApply(body: { config: LovelaceConfig }): Promise<ApplyResult> {
  return fetchJson<ApplyResult>('api/apply', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
  })
}

export function getOverrides(): Promise<{ overrides: Override[] }> {
  return fetchJson('api/overrides')
}

export function putOverrides(body: {
  overrides: Override[]
}): Promise<{ overrides: Override[] }> {
  return fetchJson('api/overrides', {
    method: 'PUT',
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
  })
}
