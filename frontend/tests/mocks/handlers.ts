import { http, HttpResponse } from 'msw'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export const handlers = [
  // Auth endpoints
  http.post(`${API_BASE}/auth/register`, async ({ request }) => {
    const body = await request.json() as any
    return HttpResponse.json({
      id: 'user-1',
      email: body.email,
      name: body.name,
      total_storage_bytes: 0,
      storage_limit_bytes: 85899346,
    })
  }),

  http.post(`${API_BASE}/auth/login`, async ({ request }) => {
    const body = await request.json() as any
    if (body.email === 'test@example.com' && body.password === 'password') {
      return HttpResponse.json({
        access_token: 'mock-token-123',
        token_type: 'bearer',
        user: {
          id: 'user-1',
          email: 'test@example.com',
          name: 'Test User',
          total_storage_bytes: 1024000,
          storage_limit_bytes: 85899346,
        },
      })
    }
    return HttpResponse.json(
      { detail: 'Invalid credentials' },
      { status: 401 }
    )
  }),

  http.get(`${API_BASE}/auth/me`, ({ request }) => {
    const auth = request.headers.get('Authorization')
    if (!auth || !auth.startsWith('Bearer ')) {
      return HttpResponse.json({ detail: 'Unauthorized' }, { status: 401 })
    }
    return HttpResponse.json({
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test User',
      total_storage_bytes: 1024000,
      storage_limit_bytes: 85899346,
    })
  }),

  // Document endpoints
  http.get(`${API_BASE}/documents`, ({ request }) => {
    const auth = request.headers.get('Authorization')
    if (!auth) {
      return HttpResponse.json({ detail: 'Unauthorized' }, { status: 401 })
    }
    return HttpResponse.json([
      {
        id: 'doc-1',
        filename: 'test-document.pdf',
        file_size_bytes: 50000,
        chunk_count: 10,
        uploaded_at: '2024-01-01T00:00:00Z',
      },
    ])
  }),

  http.post(`${API_BASE}/upload`, async ({ request }) => {
    const auth = request.headers.get('Authorization')
    if (!auth) {
      return HttpResponse.json({ detail: 'Unauthorized' }, { status: 401 })
    }

    // Note: We can't reliably parse FormData in MSW/jsdom tests
    // Just return a mock response
    return HttpResponse.json({
      filename: 'test.pdf',
      file_id: 'new-doc-id',
      file_size_bytes: 50000,
      chunks_processed: 10,
      status: 'success',
    })
  }),

  http.delete(`${API_BASE}/documents/:fileId`, ({ request }) => {
    const auth = request.headers.get('Authorization')
    if (!auth) {
      return HttpResponse.json({ detail: 'Unauthorized' }, { status: 401 })
    }
    return HttpResponse.json({ status: 'success' })
  }),

  // Storage endpoint
  http.get(`${API_BASE}/storage`, ({ request }) => {
    const auth = request.headers.get('Authorization')
    if (!auth) {
      return HttpResponse.json({ detail: 'Unauthorized' }, { status: 401 })
    }
    return HttpResponse.json({
      used_bytes: 1024000,
      limit_bytes: 85899346,
      used_mb: 0.98,
      limit_mb: 81.92,
      percentage_used: 1.19,
    })
  }),

  // Chat endpoints
  http.post(`${API_BASE}/chat`, async ({ request }) => {
    const auth = request.headers.get('Authorization')
    if (!auth) {
      return HttpResponse.json({ detail: 'Unauthorized' }, { status: 401 })
    }

    // Mock streaming response
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      start(controller) {
        const words = 'This is a mock streaming response from the chat API.'.split(' ')
        let index = 0

        const interval = setInterval(() => {
          if (index < words.length) {
            controller.enqueue(encoder.encode(words[index] + ' '))
            index++
          } else {
            clearInterval(interval)
            controller.close()
          }
        }, 50)
      },
    })

    return new HttpResponse(stream, {
      headers: {
        'Content-Type': 'text/plain',
        'X-Session-Id': 'session-123',
      },
    })
  }),

  http.get(`${API_BASE}/chat/sessions`, ({ request }) => {
    const auth = request.headers.get('Authorization')
    if (!auth) {
      return HttpResponse.json({ detail: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(request.url)
    const skip = parseInt(url.searchParams.get('skip') || '0')
    const limit = parseInt(url.searchParams.get('limit') || '10')

    const allSessions = [
      {
        id: 'session-1',
        title: 'Test Chat Session',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
    ]

    const sessions = allSessions.slice(skip, skip + limit)

    return HttpResponse.json({
      sessions,
      total: allSessions.length,
      skip,
      limit,
    })
  }),

  http.get(`${API_BASE}/chat/sessions/:sessionId/messages`, ({ request }) => {
    const auth = request.headers.get('Authorization')
    if (!auth) {
      return HttpResponse.json({ detail: 'Unauthorized' }, { status: 401 })
    }
    return HttpResponse.json([
      {
        id: 'msg-1',
        role: 'user',
        content: 'Hello',
        created_at: '2024-01-01T00:00:00Z',
      },
      {
        id: 'msg-2',
        role: 'assistant',
        content: 'Hi there!',
        created_at: '2024-01-01T00:01:00Z',
      },
    ])
  }),

  http.delete(`${API_BASE}/chat/sessions/:sessionId`, ({ request }) => {
    const auth = request.headers.get('Authorization')
    if (!auth) {
      return HttpResponse.json({ detail: 'Unauthorized' }, { status: 401 })
    }
    return HttpResponse.json({ status: 'success' })
  }),
]

// Error handlers for specific test scenarios
export const errorHandlers = {
  networkError: http.post(`${API_BASE}/chat`, () => {
    return HttpResponse.error()
  }),

  storageLimit: http.post(`${API_BASE}/upload`, () => {
    return HttpResponse.json(
      { detail: 'Storage limit exceeded. You have 0.5 MB remaining.' },
      { status: 413 }
    )
  }),

  unauthorized: http.get(`${API_BASE}/documents`, () => {
    return HttpResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  }),
}
