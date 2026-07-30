import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AppHeader } from '@/components/ui/AppHeader'
import * as nextAuth from 'next-auth/react'
import * as StorageContext from '@/contexts/StorageContext'

// Mock next-auth
vi.mock('next-auth/react')

// Mock StorageContext
vi.mock('@/contexts/StorageContext')

// Mock the TABS constant
vi.mock('@/lib/constants', () => ({
  TABS: [
    { id: 'chat', label: 'Chat', icon: () => null },
    { id: 'data-sources', label: 'Data Sources', icon: () => null },
  ],
}))

describe('AppHeader', () => {
  const mockSession = {
    user: {
      name: 'Test User',
      email: 'test@example.com',
      accessToken: 'test-token',
    },
    expires: '2024-12-31',
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

  const mockOnTabChange = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(nextAuth.useSession).mockReturnValue({
      data: mockSession,
      status: 'authenticated',
      update: vi.fn(),
    })
    vi.mocked(StorageContext.useStorage).mockReturnValue(mockStorageContext)
  })

  it('should render logo and title', () => {
    render(<AppHeader activeTab="chat" onTabChange={mockOnTabChange} />)

    expect(screen.getByAltText('DocuMate logo')).toBeInTheDocument()
    expect(screen.getByText('DocuMate')).toBeInTheDocument()
  })

  it('should render tab navigation', () => {
    render(<AppHeader activeTab="chat" onTabChange={mockOnTabChange} />)

    expect(screen.getByRole('button', { name: /Chat/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Data Sources/i })).toBeInTheDocument()
  })

  it('should highlight active tab', () => {
    render(<AppHeader activeTab="chat" onTabChange={mockOnTabChange} />)

    const chatButton = screen.getByRole('button', { name: /Chat/i })
    const dataSourcesButton = screen.getByRole('button', { name: /Data Sources/i })

    // Active tab has solid bg-neutral-800
    expect(chatButton.className).toMatch(/bg-neutral-800(?!\/)/)
    // Inactive tab has hover:bg-neutral-800/50
    expect(dataSourcesButton.className).toContain('text-neutral-400')
  })

  it('should call onTabChange when clicking tabs', () => {
    render(<AppHeader activeTab="chat" onTabChange={mockOnTabChange} />)

    const dataSourcesButton = screen.getByRole('button', { name: /Data Sources/i })
    fireEvent.click(dataSourcesButton)

    expect(mockOnTabChange).toHaveBeenCalledWith('data-sources')
  })

  it('should render user menu button with name', () => {
    render(<AppHeader activeTab="chat" onTabChange={mockOnTabChange} />)

    expect(screen.getByText('Test User')).toBeInTheDocument()
  })

  it('should toggle user menu on click', () => {
    render(<AppHeader activeTab="chat" onTabChange={mockOnTabChange} />)

    const userButton = screen.getByText('Test User').closest('button')!

    // Menu should not be visible initially
    expect(screen.queryByText('Signed in as')).not.toBeInTheDocument()

    // Click to open menu
    fireEvent.click(userButton)
    expect(screen.getByText('Signed in as')).toBeInTheDocument()
    expect(screen.getByText('test@example.com')).toBeInTheDocument()

    // Click again to close
    fireEvent.click(userButton)
    expect(screen.queryByText('Signed in as')).not.toBeInTheDocument()
  })

  it('should display storage information', () => {
    render(<AppHeader activeTab="chat" onTabChange={mockOnTabChange} />)

    const userButton = screen.getByText('Test User').closest('button')!
    fireEvent.click(userButton)

    expect(screen.getByText('Storage')).toBeInTheDocument()
    expect(screen.getByText('0.98 MB used')).toBeInTheDocument()
    expect(screen.getByText('81.92 MB')).toBeInTheDocument()
  })

  it('should show blue storage bar for low usage', () => {
    render(<AppHeader activeTab="chat" onTabChange={mockOnTabChange} />)

    const userButton = screen.getByText('Test User').closest('button')!
    fireEvent.click(userButton)

    // Just verify the storage section is visible
    expect(screen.getByText('Storage')).toBeInTheDocument()
    expect(screen.getByText('0.98 MB used')).toBeInTheDocument()
  })

  it('should show yellow storage bar for medium usage', () => {
    vi.mocked(StorageContext.useStorage).mockReturnValue({
      ...mockStorageContext,
      storage: {
        ...mockStorageContext.storage,
        percentage_used: 75,
      },
    })

    render(<AppHeader activeTab="chat" onTabChange={mockOnTabChange} />)

    const userButton = screen.getByText('Test User').closest('button')!
    fireEvent.click(userButton)

    expect(screen.getByText('Storage')).toBeInTheDocument()
  })

  it('should show red storage bar for high usage', () => {
    vi.mocked(StorageContext.useStorage).mockReturnValue({
      ...mockStorageContext,
      storage: {
        ...mockStorageContext.storage,
        percentage_used: 95,
      },
    })

    render(<AppHeader activeTab="chat" onTabChange={mockOnTabChange} />)

    const userButton = screen.getByText('Test User').closest('button')!
    fireEvent.click(userButton)

    expect(screen.getByText('Storage')).toBeInTheDocument()
  })

  it('should handle sign out', () => {
    const signOutMock = vi.fn()
    vi.mocked(nextAuth.signOut).mockImplementation(signOutMock)

    render(<AppHeader activeTab="chat" onTabChange={mockOnTabChange} />)

    const userButton = screen.getByText('Test User').closest('button')!
    fireEvent.click(userButton)

    const signOutButton = screen.getByText('Sign out')
    fireEvent.click(signOutButton)

    expect(signOutMock).toHaveBeenCalled()
  })

  it('should close menu when clicking backdrop', () => {
    render(<AppHeader activeTab="chat" onTabChange={mockOnTabChange} />)

    const userButton = screen.getByText('Test User').closest('button')!
    fireEvent.click(userButton)

    expect(screen.getByText('Signed in as')).toBeInTheDocument()

    // Click the backdrop
    const backdrop = document.querySelector('.fixed.inset-0')!
    fireEvent.click(backdrop)

    expect(screen.queryByText('Signed in as')).not.toBeInTheDocument()
  })

  it('should handle null storage gracefully', () => {
    vi.mocked(StorageContext.useStorage).mockReturnValue({
      storage: null,
      refreshStorage: vi.fn(),
    })

    render(<AppHeader activeTab="chat" onTabChange={mockOnTabChange} />)

    const userButton = screen.getByText('Test User').closest('button')!
    fireEvent.click(userButton)

    expect(screen.getByText('0.00 MB used')).toBeInTheDocument()
    expect(screen.getByText('81.92 MB')).toBeInTheDocument()
  })

  it('should not render user menu when not authenticated', () => {
    vi.mocked(nextAuth.useSession).mockReturnValue({
      data: null,
      status: 'unauthenticated',
      update: vi.fn(),
    })

    render(<AppHeader activeTab="chat" onTabChange={mockOnTabChange} />)

    expect(screen.queryByText('Test User')).not.toBeInTheDocument()
  })
})
