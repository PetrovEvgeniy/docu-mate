import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { DataSourcesView } from '@/components/data-sources/DataSourcesView'
import * as useFileUploadHook from '@/hooks/useFileUpload'
import * as StorageContext from '@/contexts/StorageContext'

// Mock the hooks
vi.mock('@/hooks/useFileUpload')
vi.mock('@/contexts/StorageContext')

describe('DataSourcesView', () => {
  const mockDropzoneProps = {
    getRootProps: vi.fn(() => ({ 'data-testid': 'dropzone' })),
    getInputProps: vi.fn(() => ({ 'data-testid': 'file-input' })),
    isDragActive: false,
    open: vi.fn(),
    accept: { 'application/pdf': ['.pdf'] },
  }

  const mockUseFileUpload = {
    isUploading: false,
    uploadStatus: null,
    uploadedFiles: [],
    isLoadingDocuments: false,
    dropzoneProps: mockDropzoneProps,
    handleDeleteDocument: vi.fn(),
  }

  const mockStorageContext = {
    storage: {
      used_bytes: 1024000,
      limit_bytes: 85899346,
      used_mb: 0.98,
      limit_mb: 81.92,
      percentage_used: 1.19,
    },
    refreshStorage: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useFileUploadHook.useFileUpload).mockReturnValue(mockUseFileUpload as any)
    vi.mocked(StorageContext.useStorage).mockReturnValue(mockStorageContext)

    // Mock window.confirm
    global.confirm = vi.fn(() => true)
  })

  it('should render title and description', () => {
    render(<DataSourcesView />)

    expect(screen.getByText('Knowledge Base')).toBeInTheDocument()
    expect(screen.getByText(/Upload PDF documents to your knowledge base/)).toBeInTheDocument()
  })

  it('should render dropzone with default state', () => {
    render(<DataSourcesView />)

    expect(screen.getByText(/Drag & drop a PDF, or click to select/)).toBeInTheDocument()
    expect(screen.getByText(/Supported formats: .pdf \(Max 10MB\)/)).toBeInTheDocument()
  })

  it('should show drag active state', () => {
    vi.mocked(useFileUploadHook.useFileUpload).mockReturnValue({
      ...mockUseFileUpload,
      dropzoneProps: {
        ...mockDropzoneProps,
        isDragActive: true,
      },
    } as any)

    render(<DataSourcesView />)

    expect(screen.getByText(/Drop your PDF here.../)).toBeInTheDocument()
  })

  it('should show uploading state', () => {
    vi.mocked(useFileUploadHook.useFileUpload).mockReturnValue({
      ...mockUseFileUpload,
      isUploading: true,
    } as any)

    render(<DataSourcesView />)

    expect(screen.getByText(/Analyzing and embedding document.../)).toBeInTheDocument()
  })

  it('should show upload status banner', () => {
    vi.mocked(useFileUploadHook.useFileUpload).mockReturnValue({
      ...mockUseFileUpload,
      uploadStatus: 'Success! Document uploaded and indexed.',
    } as any)

    render(<DataSourcesView />)

    expect(screen.getByText(/Success! Document uploaded and indexed./)).toBeInTheDocument()
  })

  it('should show loading state for documents', () => {
    vi.mocked(useFileUploadHook.useFileUpload).mockReturnValue({
      ...mockUseFileUpload,
      isLoadingDocuments: true,
    } as any)

    render(<DataSourcesView />)

    expect(screen.getByText(/Loading documents.../)).toBeInTheDocument()
  })

  it('should render uploaded files list', () => {
    vi.mocked(useFileUploadHook.useFileUpload).mockReturnValue({
      ...mockUseFileUpload,
      uploadedFiles: [
        { id: 'doc-1', name: 'test-document.pdf', file_size_bytes: 50000 },
        { id: 'doc-2', name: 'another-doc.pdf', file_size_bytes: 100000 },
      ],
    } as any)

    render(<DataSourcesView />)

    expect(screen.getByText('Your Documents (2)')).toBeInTheDocument()
    expect(screen.getByText('test-document.pdf')).toBeInTheDocument()
    expect(screen.getByText('another-doc.pdf')).toBeInTheDocument()
    expect(screen.getByText('48.83 KB')).toBeInTheDocument()
    expect(screen.getByText('97.66 KB')).toBeInTheDocument()
  })

  it('should handle document deletion with confirmation', async () => {
    const handleDeleteMock = vi.fn()
    vi.mocked(useFileUploadHook.useFileUpload).mockReturnValue({
      ...mockUseFileUpload,
      uploadedFiles: [
        { id: 'doc-1', name: 'test.pdf', file_size_bytes: 50000 },
      ],
      handleDeleteDocument: handleDeleteMock,
    } as any)

    render(<DataSourcesView />)

    const deleteButtons = screen.getAllByRole('button', { name: /delete/i })
    fireEvent.click(deleteButtons[0])

    expect(global.confirm).toHaveBeenCalledWith('Delete "test.pdf"?')
    await waitFor(() => {
      expect(handleDeleteMock).toHaveBeenCalledWith('doc-1')
    })
  })

  it('should not delete document if confirmation is cancelled', async () => {
    global.confirm = vi.fn(() => false)
    const handleDeleteMock = vi.fn()

    vi.mocked(useFileUploadHook.useFileUpload).mockReturnValue({
      ...mockUseFileUpload,
      uploadedFiles: [
        { id: 'doc-1', name: 'test.pdf', file_size_bytes: 50000 },
      ],
      handleDeleteDocument: handleDeleteMock,
    } as any)

    render(<DataSourcesView />)

    const deleteButtons = screen.getAllByRole('button', { name: /delete/i })
    fireEvent.click(deleteButtons[0])

    expect(global.confirm).toHaveBeenCalled()
    expect(handleDeleteMock).not.toHaveBeenCalled()
  })

  it('should show file ID when file size is not available', () => {
    vi.mocked(useFileUploadHook.useFileUpload).mockReturnValue({
      ...mockUseFileUpload,
      uploadedFiles: [
        { id: 'doc-123', name: 'test.pdf' },
      ],
    } as any)

    render(<DataSourcesView />)

    expect(screen.getByText('ID: doc-123')).toBeInTheDocument()
  })

  it('should pass refreshStorage callback to useFileUpload', () => {
    render(<DataSourcesView />)

    expect(useFileUploadHook.useFileUpload).toHaveBeenCalledWith(
      null,
      mockStorageContext.refreshStorage
    )
  })

  it('should not render documents list when empty', () => {
    vi.mocked(useFileUploadHook.useFileUpload).mockReturnValue({
      ...mockUseFileUpload,
      uploadedFiles: [],
      isLoadingDocuments: false,
    } as any)

    render(<DataSourcesView />)

    expect(screen.queryByText(/Your Documents/)).not.toBeInTheDocument()
  })

  it('should show error status banner', () => {
    vi.mocked(useFileUploadHook.useFileUpload).mockReturnValue({
      ...mockUseFileUpload,
      uploadStatus: 'Error: Upload failed',
    } as any)

    render(<DataSourcesView />)

    expect(screen.getByText(/Error: Upload failed/)).toBeInTheDocument()
  })
})
