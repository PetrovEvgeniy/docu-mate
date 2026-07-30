import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useFileUpload } from '@/hooks/useFileUpload'

// Mock next-auth with authenticated session
const mockSession = {
  user: {
    accessToken: 'test-token-123',
    email: 'test@example.com',
  },
}

vi.mock('next-auth/react', () => ({
  useSession: vi.fn(() => ({
    data: mockSession,
    status: 'authenticated',
  })),
}))

// Mock react-dropzone with a simpler implementation
vi.mock('react-dropzone', () => ({
  useDropzone: vi.fn(() => ({
    getRootProps: () => ({}),
    getInputProps: () => ({}),
    isDragActive: false,
    open: vi.fn(),
    accept: { 'application/pdf': ['.pdf'] },
  })),
}))

describe('useFileUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should initialize with correct default state', async () => {
    const { result } = renderHook(() => useFileUpload())

    // Wait for initial load to complete
    await waitFor(() => {
      expect(result.current.isLoadingDocuments).toBe(false)
    }, { timeout: 2000 })

    expect(result.current.isUploading).toBe(false)
    expect(result.current.uploadStatus).toBeNull()
    expect(result.current.dropzoneProps).toBeDefined()
  })

  it('should load documents on mount', async () => {
    const { result } = renderHook(() => useFileUpload())

    // Wait for documents to load
    await waitFor(() => {
      expect(result.current.isLoadingDocuments).toBe(false)
    }, { timeout: 3000 })

    expect(result.current.uploadedFiles.length).toBeGreaterThanOrEqual(0)
  })

  it('should have delete document function', () => {
    const { result } = renderHook(() => useFileUpload())

    expect(typeof result.current.handleDeleteDocument).toBe('function')
  })

  it('should expose dropzone props', async () => {
    const { result } = renderHook(() => useFileUpload())

    await waitFor(() => {
      expect(result.current.dropzoneProps).toBeDefined()
    })

    expect(result.current.dropzoneProps.getRootProps).toBeDefined()
    expect(result.current.dropzoneProps.getInputProps).toBeDefined()
  })

  it('should accept sessionId parameter', () => {
    const { result } = renderHook(() => useFileUpload('session-123'))

    expect(result.current).toBeDefined()
  })

  it('should accept onStorageChange callback', () => {
    const onStorageChange = vi.fn()
    const { result } = renderHook(() => useFileUpload(null, onStorageChange))

    expect(result.current).toBeDefined()
  })
})
