import { describe, it, expect } from 'vitest'
import { server } from '../mocks/server'
import { http, HttpResponse } from 'msw'
import { sendChatMessage } from '@/services/chatApi'

const API_BASE = 'http://localhost:8000'
const TEST_TOKEN = 'test-token-123'

describe('chatApi', () => {
  describe('sendChatMessage', () => {
    it('streams response chunks and returns session id', async () => {
      const chunks: string[] = []

      const sessionId = await sendChatMessage(
        'hello',
        (chunk) => chunks.push(chunk),
        null,
        TEST_TOKEN,
      )

      expect(sessionId).toBe('session-123')
      expect(chunks.length).toBeGreaterThan(0)
      expect(chunks.join('')).toContain('mock streaming response')
    })

    it('sends authorization header and session_id when provided', async () => {
      let capturedAuth: string | null = null
      let capturedSessionId: string | undefined = undefined

      server.use(
        http.post(`${API_BASE}/chat`, async ({ request }) => {
          capturedAuth = request.headers.get('Authorization')
          const body = (await request.json()) as { session_id?: string }
          capturedSessionId = body.session_id

          const encoder = new TextEncoder()
          const stream = new ReadableStream({
            start(controller) {
              controller.enqueue(encoder.encode('ok'))
              controller.close()
            },
          })

          return new HttpResponse(stream, {
            headers: {
              'Content-Type': 'text/plain',
              'X-Session-Id': 'session-custom',
            },
          })
        }),
      )

      const sessionId = await sendChatMessage(
        'hello',
        () => undefined,
        'session-abc',
        TEST_TOKEN,
      )

      expect(capturedAuth).toBe(`Bearer ${TEST_TOKEN}`)
      expect(capturedSessionId).toBe('session-abc')
      expect(sessionId).toBe('session-custom')
    })

    it('throws API detail when request fails', async () => {
      server.use(
        http.post(`${API_BASE}/chat`, () => {
          return HttpResponse.json({ detail: 'Unauthorized' }, { status: 401 })
        }),
      )

      await expect(
        sendChatMessage('hello', () => undefined, null, TEST_TOKEN),
      ).rejects.toThrow('Unauthorized')
    })

    it('uses fallback error message when body is not JSON', async () => {
      server.use(
        http.post(`${API_BASE}/chat`, () => {
          return new HttpResponse('server error', { status: 500 })
        }),
      )

      await expect(
        sendChatMessage('hello', () => undefined, null, TEST_TOKEN),
      ).rejects.toThrow('Chat request failed.')
    })
  })
})
