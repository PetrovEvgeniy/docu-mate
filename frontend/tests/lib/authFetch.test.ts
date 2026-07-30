import { describe, it, expect, vi, beforeEach } from 'vitest'
import { authFetch } from '@/lib/authFetch'

// Mock the auth module
vi.mock('@/auth', () => ({
  auth: vi.fn(),
}))

import { auth } from '@/auth'

describe('authFetch', () => {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
  const mockAuth = auth as ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
  })

  it('should make fetch request without auth token when no session', async () => {
    mockAuth.mockResolvedValue(null)
    const mockFetch = global.fetch as ReturnType<typeof vi.fn>
    mockFetch.mockResolvedValue(new Response('{}'))

    await authFetch('/test')

    expect(mockFetch).toHaveBeenCalledWith(
      `${API_URL}/test`,
      expect.objectContaining({
        headers: {},
      })
    )
  })

  it('should include auth token when session exists', async () => {
    mockAuth.mockResolvedValue({
      user: {
        accessToken: 'test-token-123',
      },
    })
    const mockFetch = global.fetch as ReturnType<typeof vi.fn>
    mockFetch.mockResolvedValue(new Response('{}'))

    await authFetch('/test')

    expect(mockFetch).toHaveBeenCalledWith(
      `${API_URL}/test`,
      expect.objectContaining({
        headers: {
          Authorization: 'Bearer test-token-123',
        },
      })
    )
  })

  it('should merge custom headers with auth header', async () => {
    mockAuth.mockResolvedValue({
      user: {
        accessToken: 'test-token-123',
      },
    })
    const mockFetch = global.fetch as ReturnType<typeof vi.fn>
    mockFetch.mockResolvedValue(new Response('{}'))

    await authFetch('/test', {
      headers: {
        'Content-Type': 'application/json',
      },
    })

    expect(mockFetch).toHaveBeenCalledWith(
      `${API_URL}/test`,
      expect.objectContaining({
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token-123',
        },
      })
    )
  })

  it('should pass through fetch options', async () => {
    mockAuth.mockResolvedValue(null)
    const mockFetch = global.fetch as ReturnType<typeof vi.fn>
    mockFetch.mockResolvedValue(new Response('{}'))

    await authFetch('/test', {
      method: 'POST',
      body: JSON.stringify({ data: 'test' }),
    })

    expect(mockFetch).toHaveBeenCalledWith(
      `${API_URL}/test`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ data: 'test' }),
      })
    )
  })

  it('should construct correct URL with API_URL', async () => {
    mockAuth.mockResolvedValue(null)
    const mockFetch = global.fetch as ReturnType<typeof vi.fn>
    mockFetch.mockResolvedValue(new Response('{}'))

    await authFetch('/documents')

    expect(mockFetch).toHaveBeenCalledWith(
      `${API_URL}/documents`,
      expect.any(Object)
    )
  })
})
