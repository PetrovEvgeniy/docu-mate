import { describe, it, expect } from 'vitest'
import { server } from '../mocks/server'
import { http, HttpResponse } from 'msw'
import {
  getChatSessions,
  getSessionMessages,
  deleteSession,
} from '@/services/chatSessionApi'

const API_BASE = 'http://localhost:8000'
const TEST_TOKEN = 'test-token-123'

describe('chatSessionApi', () => {
  describe('getChatSessions', () => {
    it('fetches sessions successfully', async () => {
      const sessions = await getChatSessions(TEST_TOKEN)

      expect(sessions).toHaveLength(1)
      expect(sessions[0]).toMatchObject({
        id: 'session-1',
        title: 'Test Chat Session',
      })
    })

    it('throws when request fails', async () => {
      server.use(
        http.get(`${API_BASE}/chat/sessions`, () => {
          return HttpResponse.json({ detail: 'Unauthorized' }, { status: 401 })
        }),
      )

      await expect(getChatSessions(TEST_TOKEN)).rejects.toThrow(
        'Failed to fetch chat sessions',
      )
    })
  })

  describe('getSessionMessages', () => {
    it('fetches session messages successfully', async () => {
      const messages = await getSessionMessages('session-1', TEST_TOKEN)

      expect(messages).toHaveLength(2)
      expect(messages[0]).toMatchObject({
        id: 'msg-1',
        role: 'user',
      })
    })

    it('throws when request fails', async () => {
      server.use(
        http.get(`${API_BASE}/chat/sessions/:sessionId/messages`, () => {
          return HttpResponse.json({ detail: 'Not found' }, { status: 404 })
        }),
      )

      await expect(getSessionMessages('missing', TEST_TOKEN)).rejects.toThrow(
        'Failed to fetch session messages',
      )
    })
  })

  describe('deleteSession', () => {
    it('deletes a session successfully', async () => {
      await expect(deleteSession('session-1', TEST_TOKEN)).resolves.toBeUndefined()
    })

    it('throws when delete fails', async () => {
      server.use(
        http.delete(`${API_BASE}/chat/sessions/:sessionId`, () => {
          return HttpResponse.json({ detail: 'Forbidden' }, { status: 403 })
        }),
      )

      await expect(deleteSession('session-1', TEST_TOKEN)).rejects.toThrow(
        'Failed to delete session',
      )
    })
  })
})
