import { describe, expect, it } from 'vitest'
import { createBearerTokenAuth } from '../client.js'

describe('createBearerTokenAuth', () => {
  it('uses Home Assistant default websocket path when no websocket URL override is provided', () => {
    const auth = createBearerTokenAuth({
      url: 'http://localhost:8123',
      token: 'token',
    })

    expect(auth.wsUrl).toBe('ws://localhost:8123/api/websocket')
    expect(auth.accessToken).toBe('token')
  })

  it('uses the Supervisor websocket proxy URL when provided', () => {
    const auth = createBearerTokenAuth({
      url: 'http://supervisor/core/api',
      websocketUrl: 'ws://supervisor/core/websocket',
      token: 'supervisor-token',
    })

    expect(auth.wsUrl).toBe('ws://supervisor/core/websocket')
    expect(auth.accessToken).toBe('supervisor-token')
  })
})
