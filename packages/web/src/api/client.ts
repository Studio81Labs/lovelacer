import type {
  AnalyzeOutput,
  ApiError,
  ApplyResult,
  HealthResponse,
  LatestAnalysis,
  LovelaceConfig,
  OnboardingStatus,
  Override,
  PreviewOutput,
  Settings,
  SnapshotAssignment,
  SuggestionType,
} from './types.js'

/**
 * Wraps a `fetch()` to a backend route in the standard error envelope.
 * URL is document-relative (no leading slash) so the request stays inside
 * the add-on path under HA Supervisor ingress (`/api/hassio_ingress/<token>/`).
 * Vite's dev proxy resolves the same path to the backend at :3000.
 */
// eslint-disable-next-line no-undef
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
  return fetchJson<AnalyzeOutput>('api/analyze', { method: 'POST' })
}

export function postPreview(): Promise<PreviewOutput> {
  return fetchJson<PreviewOutput>('api/preview', { method: 'POST' })
}

export function getLatestAnalysis(): Promise<LatestAnalysis | null> {
  return fetchJson<LatestAnalysis | null>('api/analysis/latest')
}

export function getHealth(): Promise<HealthResponse> {
  return fetchJson<HealthResponse>('api/health')
}

/**
 * Request shape for `postApply`. `snapshot` is optional: when provided,
 * the server snapshots `(assignments, config)` after a successful HA push
 * so future previews can diff against it. When omitted, the server keeps
 * its previous snapshot (or has none).
 */
export interface PostApplyInput {
  config: LovelaceConfig
  snapshot?: {
    assignments: SnapshotAssignment[]
    config: LovelaceConfig
  }
}

export function postApply(input: PostApplyInput): Promise<ApplyResult> {
  const body: Record<string, unknown> = { config: input.config }
  if (input.snapshot !== undefined) body.snapshot = input.snapshot
  return fetchJson<ApplyResult>('api/apply', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
  })
}

export function getOverrides(): Promise<{ overrides: Override[] }> {
  return fetchJson('api/overrides')
}

export function putOverrides(body: { overrides: Override[] }): Promise<{ overrides: Override[] }> {
  return fetchJson('api/overrides', {
    method: 'PUT',
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
  })
}

export function getInvite(): Promise<{ accepted: boolean }> {
  return fetchJson('api/invite')
}

export function postInvite(body: { code: string }): Promise<{ accepted: boolean }> {
  return fetchJson('api/invite', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
  })
}

export interface DismissSuggestionInput {
  entityId: string
  suggestionType: SuggestionType
}

/**
 * POST /api/suggestions/dismiss — record a dismissal so the suggestion
 * is filtered from every future preview. Document-relative URL so it
 * works under HA add-on ingress (`/api/hassio_ingress/<token>/...`).
 */
export async function postDismissSuggestion(input: DismissSuggestionInput): Promise<void> {
  await fetchJson<{ ok: true }>('api/suggestions/dismiss', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(input),
  })
}

export function getSettings(): Promise<{ settings: Settings }> {
  return fetchJson<{ settings: Settings }>('api/settings')
}

export function putSettings(body: { settings: Settings }): Promise<{ settings: Settings }> {
  return fetchJson<{ settings: Settings }>('api/settings', {
    method: 'PUT',
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
  })
}

export function getOnboarding(): Promise<OnboardingStatus> {
  return fetchJson<OnboardingStatus>('api/onboarding')
}

export function postOnboardingComplete(): Promise<OnboardingStatus> {
  return fetchJson<OnboardingStatus>('api/onboarding/complete', {
    method: 'POST',
  })
}
