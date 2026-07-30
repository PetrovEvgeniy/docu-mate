import { describe, it, expect, beforeEach } from 'vitest'
import { server } from '../mocks/server'
import { http, HttpResponse } from 'msw'
import { getDocuments, deleteDocument, getStorageInfo } from '@/services/documentApi'

const API_BASE = 'http://localhost:8000'
const TEST_TOKEN = 'test-token-123'

describe('documentApi', () => {
  describe('getDocuments', () => {
    it('should fetch documents successfully', async () => {
      const documents = await getDocuments(TEST_TOKEN)

      expect(documents).toHaveLength(1)
      expect(documents[0]).toMatchObject({
        id: 'doc-1',
        filename: 'test-document.pdf',
        file_size_bytes: 50000,
      })
    })

    it('should throw error when unauthorized', async () => {
      server.use(
        http.get(`${API_BASE}/documents`, () => {
          return HttpResponse.json(
            { detail: 'Unauthorized' },
            { status: 401 }
          )
        })
      )

      await expect(getDocuments('invalid-token')).rejects.toThrow(
        'Failed to fetch documents'
      )
    })

    it('should include authorization header', async () => {
      let capturedHeaders: Headers | null = null

      server.use(
        http.get(`${API_BASE}/documents`, ({ request }) => {
          capturedHeaders = request.headers
          return HttpResponse.json([])
        })
      )

      await getDocuments(TEST_TOKEN)

      expect(capturedHeaders?.get('Authorization')).toBe(`Bearer ${TEST_TOKEN}`)
    })
  })

  describe('deleteDocument', () => {
    it('should delete document successfully', async () => {
      server.use(
        http.delete(`${API_BASE}/documents/:fileId`, () => {
          return HttpResponse.json({
            storage_used: 1024000,
            storage_limit: 85899346,
          })
        })
      )

      const result = await deleteDocument('doc-1', TEST_TOKEN)

      expect(result).toMatchObject({
        used_bytes: 1024000,
        limit_bytes: 85899346,
      })
      expect(result.used_mb).toBeCloseTo(0.98, 2)
      expect(result.percentage_used).toBeCloseTo(1.19, 2)
    })

    it('should throw error on failure', async () => {
      server.use(
        http.delete(`${API_BASE}/documents/:fileId`, () => {
          return HttpResponse.json(
            { detail: 'Not found' },
            { status: 404 }
          )
        })
      )

      await expect(deleteDocument('nonexistent', TEST_TOKEN)).rejects.toThrow(
        'Failed to delete document'
      )
    })

    it('should send correct file ID in URL', async () => {
      let capturedFileId = ''

      server.use(
        http.delete(`${API_BASE}/documents/:fileId`, ({ params }) => {
          capturedFileId = params.fileId as string
          return HttpResponse.json({
            storage_used: 0,
            storage_limit: 85899346,
          })
        })
      )

      await deleteDocument('specific-file-123', TEST_TOKEN)

      expect(capturedFileId).toBe('specific-file-123')
    })
  })

  describe('getStorageInfo', () => {
    it('should fetch storage info successfully', async () => {
      const storageInfo = await getStorageInfo(TEST_TOKEN)

      expect(storageInfo).toMatchObject({
        used_bytes: 1024000,
        limit_bytes: 85899346,
        used_mb: 0.98,
        limit_mb: 81.92,
        percentage_used: 1.19,
      })
    })

    it('should throw error when unauthorized', async () => {
      server.use(
        http.get(`${API_BASE}/storage`, () => {
          return HttpResponse.json(
            { detail: 'Unauthorized' },
            { status: 401 }
          )
        })
      )

      await expect(getStorageInfo('invalid-token')).rejects.toThrow(
        'Failed to fetch storage info'
      )
    })
  })
})
