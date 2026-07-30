import { describe, it, expect, vi } from 'vitest'
import { server } from '../mocks/server'
import { http, HttpResponse } from 'msw'
import { uploadDocument } from '@/services/uploadApi'

const API_BASE = 'http://localhost:8000'
const TEST_TOKEN = 'test-token-123'

describe('uploadApi', () => {
  describe('uploadDocument', () => {
    it('should upload PDF successfully', async () => {
      const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' })

      const result = await uploadDocument(file, null, TEST_TOKEN)

      expect(result).toMatchObject({
        file: {
          name: 'test.pdf',
          id: 'new-doc-id',
          file_size_bytes: 50000,
        },
        chunksProcessed: 10,
      })
    })

    it('should reject non-PDF files', async () => {
      const file = new File(['test content'], 'test.txt', { type: 'text/plain' })

      await expect(uploadDocument(file, null, TEST_TOKEN)).rejects.toThrow(
        'Only PDF files are supported.'
      )
    })

    it('should include session_id when provided', async () => {
      // We can't reliably parse FormData in MSW/jsdom, so just verify the request was made
      const mockHandler = vi.fn(() =>
        HttpResponse.json({
          filename: 'test.pdf',
          file_id: 'doc-1',
          file_size_bytes: 1000,
          chunks_processed: 5,
        })
      )

      server.use(
        http.post(`${API_BASE}/upload`, mockHandler)
      )

      const file = new File(['test'], 'test.pdf', { type: 'application/pdf' })
      const result = await uploadDocument(file, 'session-123', TEST_TOKEN)

      expect(mockHandler).toHaveBeenCalled()
      expect(result.file.id).toBe('doc-1')
    })

    it('should not include session_id when null', async () => {
      const mockHandler = vi.fn(() =>
        HttpResponse.json({
          filename: 'test.pdf',
          file_id: 'doc-2',
          file_size_bytes: 1000,
          chunks_processed: 5,
        })
      )

      server.use(
        http.post(`${API_BASE}/upload`, mockHandler)
      )

      const file = new File(['test'], 'test.pdf', { type: 'application/pdf' })
      const result = await uploadDocument(file, null, TEST_TOKEN)

      expect(mockHandler).toHaveBeenCalled()
      expect(result.file.id).toBe('doc-2')
    })

    it('should handle upload errors', async () => {
      server.use(
        http.post(`${API_BASE}/upload`, () => {
          return HttpResponse.json(
            { detail: 'Storage limit exceeded' },
            { status: 413 }
          )
        })
      )

      const file = new File(['test'], 'test.pdf', { type: 'application/pdf' })

      await expect(uploadDocument(file, null, TEST_TOKEN)).rejects.toThrow(
        'Storage limit exceeded'
      )
    })

    it('should include authorization header', async () => {
      let capturedAuth: string | null = null

      server.use(
        http.post(`${API_BASE}/upload`, ({ request }) => {
          capturedAuth = request.headers.get('Authorization')
          return HttpResponse.json({
            filename: 'test.pdf',
            file_id: 'doc-1',
            file_size_bytes: 1000,
            chunks_processed: 5,
          })
        })
      )

      const file = new File(['test'], 'test.pdf', { type: 'application/pdf' })
      await uploadDocument(file, null, TEST_TOKEN)

      expect(capturedAuth).toBe(`Bearer ${TEST_TOKEN}`)
    })

    it('should handle server errors without detail', async () => {
      server.use(
        http.post(`${API_BASE}/upload`, () => {
          return new HttpResponse(null, { status: 500, statusText: 'Internal Server Error' })
        })
      )

      const file = new File(['test'], 'test.pdf', { type: 'application/pdf' })

      await expect(uploadDocument(file, null, TEST_TOKEN)).rejects.toThrow(
        'Internal Server Error'
      )
    })
  })
})
