import type {
  AnalyzeOutput,
  ApiError,
  ApplyResult,
  LovelaceConfig,
  PreviewOutput,
} from './types.js'

/**
 * Wraps a `fetch()` to a backend route in the standard error envelope.
 * URL is document-relative (no leading slash) so the request stays inside
 * the add-on path under HA Supervisor ingress (`/api/hassio_ingress/<token>/`).
 * Vite's dev proxy resolves the same path to the backend at :3000.
 */
async function postJson<T>(path: string, body?: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      ...(body !== undefined && { body: JSON.stringify(body) }),
    })
  } catch (cause) {
    throw {
      error: 'network',
      message: cause instanceof Error ? cause.message : String(cause),
    } satisfies ApiError
  }

  if (!res.ok) {
    const parsed: unknown = await res.json().catch(() => null)
    // Validate the server actually sent the ApiError envelope shape
    // before forwarding. A malformed body (e.g. { error: 42 }) shouldn't
    // be cast through and confuse downstream consumers — fall back to
    // the generic network envelope instead.
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

export function postAnalyze(): Promise<AnalyzeOutput> {
  return postJson<AnalyzeOutput>('api/analyze')
}

export function postPreview(): Promise<PreviewOutput> {
  return postJson<PreviewOutput>('api/preview')
}

export function postApply(body: { config: LovelaceConfig }): Promise<ApplyResult> {
  return postJson<ApplyResult>('api/apply', body)
}
