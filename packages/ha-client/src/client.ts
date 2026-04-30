import {
  createConnection,
  createLongLivedTokenAuth,
  type Connection,
  type MessageBase,
} from 'home-assistant-js-websocket'
import { pino, type Logger } from 'pino'
import type {
  HaAreaRegistryEntry,
  HaDeviceRegistryEntry,
  HaEntityRegistryEntry,
  HaFloorRegistryEntry,
} from '@lovelacer/shared'

// home-assistant-js-websocket expects WebSocket on globalThis.
// In Node we polyfill with `ws`. The lib's runtime check is structural
// and accepts `ws`'s implementation despite type-shape differences.
import WebSocket from 'ws'
;(globalThis as unknown as { WebSocket: unknown }).WebSocket = WebSocket

export interface HaClientOptions {
  url: string
  token: string
  logger?: Logger
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

    const auth = createLongLivedTokenAuth(this.options.url, this.options.token)
    this.connection = await createConnection({ auth })

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
