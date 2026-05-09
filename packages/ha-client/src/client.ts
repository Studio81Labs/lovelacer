import {
  Auth,
  createConnection,
  createLongLivedTokenAuth,
  type Connection,
  type AuthData,
  type MessageBase,
} from 'home-assistant-js-websocket'
import { pino, type Logger } from 'pino'
import type {
  HaAreaRegistryEntry,
  HaDeviceRegistryEntry,
  HaEntityRegistryEntry,
  HaFloorRegistryEntry,
} from '@lovelacer/shared'
import {
  DEFAULT_APPLY_OPTIONS,
  HaApplyError,
  type ApplyDashboardOptions,
  type ApplyDashboardResult,
  type HaDashboardEntry,
  type LovelaceDashboardConfig,
} from './dashboards.js'

// home-assistant-js-websocket expects WebSocket on globalThis.
// In Node we polyfill with `ws`. The lib's runtime check is structural
// and accepts `ws`'s implementation despite type-shape differences.
import WebSocket from 'ws'
;(globalThis as unknown as { WebSocket: unknown }).WebSocket = WebSocket

export interface HaClientOptions {
  url: string
  websocketUrl?: string
  token: string
  logger?: Logger
}

export interface BearerTokenAuthOptions {
  url: string
  websocketUrl?: string
  token: string
}

class FixedWebSocketUrlAuth extends Auth {
  constructor(
    data: AuthData,
    private readonly fixedWebSocketUrl: string,
  ) {
    super(data)
  }

  override get wsUrl(): string {
    return this.fixedWebSocketUrl
  }
}

export function createBearerTokenAuth(options: BearerTokenAuthOptions): Auth {
  const auth = createLongLivedTokenAuth(options.url, options.token)
  if (options.websocketUrl === undefined) return auth

  return new FixedWebSocketUrlAuth(auth.data, options.websocketUrl)
}

export class HaClient {
  private connection: Connection | null = null
  private readonly options: HaClientOptions
  private readonly logger: Logger

  constructor(options: HaClientOptions) {
    this.options = options
    this.logger = options.logger ?? pino({ level: 'info' })
  }

  async connect(): Promise<void> {
    if (this.connection) return

    const auth = createBearerTokenAuth(this.options)
    // setupRetry: -1 retries the initial connection forever with built-in
    // backoff. Important for the HA add-on case, where the supervisor may
    // start the add-on before HA Core is ready to accept WebSocket clients.
    this.connection = await createConnection({ auth, setupRetry: -1 })

    this.connection.addEventListener('disconnected', () => {
      this.logger.warn('HA connection lost — reconnecting automatically')
    })

    this.connection.addEventListener('ready', () => {
      this.logger.info('HA connection ready')
    })

    this.logger.info({ url: this.options.url }, 'connected to Home Assistant')
  }

  async disconnect(): Promise<void> {
    this.connection?.close()
    this.connection = null
  }

  isConnected(): boolean {
    return this.connection?.connected ?? false
  }

  async getEntityRegistry(): Promise<HaEntityRegistryEntry[]> {
    return this.send<HaEntityRegistryEntry[]>({ type: 'config/entity_registry/list' })
  }

  async getDeviceRegistry(): Promise<HaDeviceRegistryEntry[]> {
    return this.send<HaDeviceRegistryEntry[]>({ type: 'config/device_registry/list' })
  }

  async getAreaRegistry(): Promise<HaAreaRegistryEntry[]> {
    return this.send<HaAreaRegistryEntry[]>({ type: 'config/area_registry/list' })
  }

  async getFloorRegistry(): Promise<HaFloorRegistryEntry[]> {
    return this.send<HaFloorRegistryEntry[]>({ type: 'config/floor_registry/list' })
  }

  async listDashboards(): Promise<HaDashboardEntry[]> {
    return this.send<HaDashboardEntry[]>({ type: 'lovelace/dashboards/list' })
  }

  async applyDashboard(
    config: LovelaceDashboardConfig,
    options?: ApplyDashboardOptions,
  ): Promise<ApplyDashboardResult> {
    const opts = { ...DEFAULT_APPLY_OPTIONS, ...options }

    // Surface the "not connected" guard up front, unwrapped — callers
    // (and tests) expect that specific error message verbatim. Once we're
    // past this check, real transport failures get wrapped in HaApplyError
    // so route handlers can branch on which step broke.
    if (!this.connection) {
      throw new Error('HaClient not connected — call connect() first')
    }

    let dashboards: HaDashboardEntry[]
    try {
      dashboards = await this.listDashboards()
    } catch (cause) {
      throw new HaApplyError('list', 'failed to list HA dashboards', cause)
    }

    const existing = dashboards.find((d) => d.url_path === opts.urlPath)
    if (existing === undefined) {
      try {
        await this.send({
          type: 'lovelace/dashboards/create',
          url_path: opts.urlPath,
          title: opts.title,
          icon: opts.icon,
          show_in_sidebar: opts.showInSidebar,
          require_admin: opts.requireAdmin,
          mode: 'storage',
        })
      } catch (cause) {
        throw new HaApplyError('create', `failed to create dashboard ${opts.urlPath}`, cause)
      }
    }

    try {
      await this.send({
        type: 'lovelace/config/save',
        url_path: opts.urlPath,
        config,
      })
    } catch (cause) {
      throw new HaApplyError('save', `failed to save dashboard config for ${opts.urlPath}`, cause)
    }

    return { urlPath: opts.urlPath, created: existing === undefined }
  }

  /**
   * Generic WebSocket send. Internal use; prefer the typed methods above.
   */
  private async send<T>(message: MessageBase): Promise<T> {
    if (!this.connection) {
      throw new Error('HaClient not connected — call connect() first')
    }
    return this.connection.sendMessagePromise<T>(message)
  }
}
