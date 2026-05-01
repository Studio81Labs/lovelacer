import { describe, it, expect, vi } from 'vitest'
import type { Connection, MessageBase } from 'home-assistant-js-websocket'
import { HaClient } from '../client.js'
import {
  HaApplyError,
  type ApplyDashboardOptions,
  type HaDashboardEntry,
} from '../dashboards.js'
import type { LovelaceConfig } from '@lovelacer/generator'

const config: LovelaceConfig = {
  title: 'Lovelacer — Home',
  views: [
    {
      type: 'sections',
      title: 'Home',
      path: 'home',
      icon: 'mdi:home-variant',
      sections: [],
    },
  ],
}

const lovelacerHome: HaDashboardEntry = {
  id: 'd1',
  url_path: 'lovelacer-home',
  title: 'Lovelacer — Home',
  icon: 'mdi:home-variant',
  show_in_sidebar: true,
  require_admin: false,
  mode: 'storage',
}

const otherDashboard: HaDashboardEntry = {
  id: 'd2',
  url_path: 'overview',
  title: 'Overview',
  icon: null,
  show_in_sidebar: true,
  require_admin: false,
  mode: 'storage',
}

function makeClient(): { client: HaClient; send: ReturnType<typeof vi.fn> } {
  const send = vi.fn()
  const fakeConnection = {
    sendMessagePromise: send,
    addEventListener: vi.fn(),
    connected: true,
    close: vi.fn(),
  } as unknown as Connection
  const client = new HaClient({
    url: 'ws://test',
    token: 'fake',
  })
  ;(client as unknown as { connection: Connection }).connection = fakeConnection
  return { client, send }
}

describe('listDashboards', () => {
  it('forwards lovelace/dashboards/list and returns the array', async () => {
    const { client, send } = makeClient()
    send.mockResolvedValueOnce([lovelacerHome, otherDashboard])
    const result = await client.listDashboards()
    expect(send).toHaveBeenCalledWith({ type: 'lovelace/dashboards/list' })
    expect(result).toEqual([lovelacerHome, otherDashboard])
  })

  it('throws when not connected', async () => {
    const client = new HaClient({ url: 'ws://test', token: 'fake' })
    await expect(client.listDashboards()).rejects.toThrow(/not connected/)
  })
})

describe('applyDashboard — when dashboard missing', () => {
  it('sends list, then create, then save', async () => {
    const { client, send } = makeClient()
    send.mockResolvedValueOnce([otherDashboard])
    send.mockResolvedValueOnce(null)
    send.mockResolvedValueOnce(null)

    const result = await client.applyDashboard(config)

    expect(send).toHaveBeenCalledTimes(3)
    expect(send.mock.calls[0]![0]).toEqual({ type: 'lovelace/dashboards/list' })
    expect(send.mock.calls[1]![0]).toEqual({
      type: 'lovelace/dashboards/create',
      url_path: 'lovelacer-home',
      title: 'Lovelacer — Home',
      icon: 'mdi:home-variant',
      show_in_sidebar: true,
      require_admin: false,
      mode: 'storage',
    })
    expect(send.mock.calls[2]![0]).toEqual({
      type: 'lovelace/config/save',
      url_path: 'lovelacer-home',
      config,
    })
    expect(result).toEqual({ urlPath: 'lovelacer-home', created: true })
  })
})

describe('applyDashboard — when dashboard exists', () => {
  it('skips create, just saves', async () => {
    const { client, send } = makeClient()
    send.mockResolvedValueOnce([lovelacerHome])
    send.mockResolvedValueOnce(null)

    const result = await client.applyDashboard(config)

    expect(send).toHaveBeenCalledTimes(2)
    expect(send.mock.calls[0]![0]).toEqual({ type: 'lovelace/dashboards/list' })
    expect(send.mock.calls[1]![0]).toEqual({
      type: 'lovelace/config/save',
      url_path: 'lovelacer-home',
      config,
    })
    expect(result).toEqual({ urlPath: 'lovelacer-home', created: false })
  })
})

describe('applyDashboard — options', () => {
  it('uses defaults when options is undefined', async () => {
    const { client, send } = makeClient()
    send.mockResolvedValueOnce([])
    send.mockResolvedValueOnce(null)
    send.mockResolvedValueOnce(null)

    await client.applyDashboard(config)

    const createCall = send.mock.calls[1]![0] as MessageBase & Record<string, unknown>
    expect(createCall.url_path).toBe('lovelacer-home')
    expect(createCall.title).toBe('Lovelacer — Home')
    expect(createCall.icon).toBe('mdi:home-variant')
    expect(createCall.show_in_sidebar).toBe(true)
    expect(createCall.require_admin).toBe(false)
    expect(createCall.mode).toBe('storage')
  })

  it('overrides defaults from options', async () => {
    const { client, send } = makeClient()
    send.mockResolvedValueOnce([])
    send.mockResolvedValueOnce(null)
    send.mockResolvedValueOnce(null)

    const options: ApplyDashboardOptions = {
      urlPath: 'my-home',
      title: 'My Home',
      icon: 'mdi:home',
      showInSidebar: false,
      requireAdmin: true,
    }
    await client.applyDashboard(config, options)

    const createCall = send.mock.calls[1]![0] as MessageBase & Record<string, unknown>
    expect(createCall.url_path).toBe('my-home')
    expect(createCall.title).toBe('My Home')
    expect(createCall.icon).toBe('mdi:home')
    expect(createCall.show_in_sidebar).toBe(false)
    expect(createCall.require_admin).toBe(true)
  })

  it('partial options merge with defaults', async () => {
    const { client, send } = makeClient()
    send.mockResolvedValueOnce([])
    send.mockResolvedValueOnce(null)
    send.mockResolvedValueOnce(null)

    await client.applyDashboard(config, { urlPath: 'foo' })

    const createCall = send.mock.calls[1]![0] as MessageBase & Record<string, unknown>
    expect(createCall.url_path).toBe('foo')
    expect(createCall.title).toBe('Lovelacer — Home')
    expect(createCall.icon).toBe('mdi:home-variant')
  })
})

describe('applyDashboard — error handling', () => {
  it('list fails → HaApplyError with step "list" and no further calls', async () => {
    const { client, send } = makeClient()
    const cause = new Error('connection lost')
    send.mockRejectedValueOnce(cause)

    await expect(client.applyDashboard(config)).rejects.toMatchObject({
      name: 'HaApplyError',
      step: 'list',
      cause,
    })
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('create fails → HaApplyError with step "create" and save not called', async () => {
    const { client, send } = makeClient()
    const cause = new Error('permission denied')
    send.mockResolvedValueOnce([])
    send.mockRejectedValueOnce(cause)

    await expect(client.applyDashboard(config)).rejects.toMatchObject({
      name: 'HaApplyError',
      step: 'create',
      cause,
    })
    expect(send).toHaveBeenCalledTimes(2)
  })

  it('save fails → HaApplyError with step "save"', async () => {
    const { client, send } = makeClient()
    const cause = new Error('config invalid')
    send.mockResolvedValueOnce([lovelacerHome])
    send.mockRejectedValueOnce(cause)

    await expect(client.applyDashboard(config)).rejects.toMatchObject({
      name: 'HaApplyError',
      step: 'save',
      cause,
    })
  })

  it('HaApplyError exposes step and cause as readonly fields', () => {
    const cause = new Error('boom')
    const err = new HaApplyError('save', 'failed to save', cause)
    expect(err.name).toBe('HaApplyError')
    expect(err.step).toBe('save')
    expect(err.cause).toBe(cause)
    expect(err.message).toBe('failed to save')
    expect(err).toBeInstanceOf(Error)
  })

  it('throws when not connected before any WS call', async () => {
    const client = new HaClient({ url: 'ws://test', token: 'fake' })
    await expect(client.applyDashboard(config)).rejects.toThrow(/not connected/)
  })
})
