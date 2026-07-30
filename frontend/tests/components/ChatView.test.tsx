import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ChatView } from '@/components/chat/ChatView'
import * as useChatHook from '@/hooks/useChat'

// Mock the useChat hook
vi.mock('@/hooks/useChat')

// Mock child components
vi.mock('@/components/chat/MessageBubble', () => ({
  MessageBubble: ({ message }: any) => (
    <div data-testid={`message-${message.id}`}>{message.content}</div>
  ),
}))

vi.mock('@/components/chat/TypingIndicator', () => ({
  TypingIndicator: () => <div data-testid="typing-indicator">Typing...</div>,
}))

vi.mock('@/components/chat/EmptyChatState', () => ({
  EmptyChatState: () => <div data-testid="empty-state">No messages yet</div>,
}))

vi.mock('@/components/chat/ChatSidebar', () => ({
  ChatSidebar: ({ sessions, currentSessionId, onSelectSession, onNewSession, onDeleteSession }: any) => (
    <div data-testid="chat-sidebar">
      <button onClick={onNewSession} data-testid="new-session-btn">New Session</button>
      {sessions.map((s: any) => (
        <div key={s.id} data-testid={`session-${s.id}`}>
          <button onClick={() => onSelectSession(s.id)}>Session {s.id}</button>
          <button onClick={() => onDeleteSession(s.id)} data-testid={`delete-${s.id}`}>Delete</button>
        </div>
      ))}
    </div>
  ),
}))

describe('ChatView', () => {
  const mockUseChat = {
    input: '',
    setInput: vi.fn(),
    messages: [],
    isChatLoading: false,
    handleSubmit: vi.fn((e: any) => e.preventDefault()),
    sessions: [],
    isLoadingSessions: false,
    currentSessionId: null,
    loadSession: vi.fn(),
    createNewSession: vi.fn(),
    handleDeleteSession: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useChatHook.useChat).mockReturnValue(mockUseChat)
  })

  it('should render empty state when no messages', () => {
    render(<ChatView />)

    expect(screen.getByTestId('empty-state')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Ask a question about your documents...')).toBeInTheDocument()
  })

  it('should render messages when present', () => {
    vi.mocked(useChatHook.useChat).mockReturnValue({
      ...mockUseChat,
      messages: [
        { id: '1', role: 'user', content: 'Hello', created_at: new Date() },
        { id: '2', role: 'assistant', content: 'Hi there!', created_at: new Date() },
      ],
    })

    render(<ChatView />)

    expect(screen.getByTestId('message-1')).toHaveTextContent('Hello')
    expect(screen.getByTestId('message-2')).toHaveTextContent('Hi there!')
    expect(screen.queryByTestId('empty-state')).not.toBeInTheDocument()
  })

  it('should show typing indicator when loading', () => {
    vi.mocked(useChatHook.useChat).mockReturnValue({
      ...mockUseChat,
      isChatLoading: true,
      messages: [{ id: '1', role: 'user', content: 'Question', created_at: new Date() }],
    })

    render(<ChatView />)

    expect(screen.getByTestId('typing-indicator')).toBeInTheDocument()
  })

  it('should handle input change', () => {
    const setInputMock = vi.fn()
    vi.mocked(useChatHook.useChat).mockReturnValue({
      ...mockUseChat,
      setInput: setInputMock,
    })

    render(<ChatView />)

    const input = screen.getByPlaceholderText('Ask a question about your documents...')
    fireEvent.change(input, { target: { value: 'Test question' } })

    expect(setInputMock).toHaveBeenCalledWith('Test question')
  })

  it('should handle form submission', () => {
    const handleSubmitMock = vi.fn((e: any) => e.preventDefault())
    vi.mocked(useChatHook.useChat).mockReturnValue({
      ...mockUseChat,
      input: 'Test question',
      handleSubmit: handleSubmitMock,
    })

    render(<ChatView />)

    const form = screen.getByRole('button', { name: /send/i }).closest('form')
    fireEvent.submit(form!)

    expect(handleSubmitMock).toHaveBeenCalled()
  })

  it('should disable send button when input is empty', () => {
    vi.mocked(useChatHook.useChat).mockReturnValue({
      ...mockUseChat,
      input: '',
    })

    render(<ChatView />)

    const sendButton = screen.getByRole('button', { name: /send/i })
    expect(sendButton).toBeDisabled()
  })

  it('should disable send button when loading', () => {
    vi.mocked(useChatHook.useChat).mockReturnValue({
      ...mockUseChat,
      input: 'Test',
      isChatLoading: true,
    })

    render(<ChatView />)

    const sendButton = screen.getByRole('button', { name: /send/i })
    expect(sendButton).toBeDisabled()
  })

  it('should enable send button with valid input', () => {
    vi.mocked(useChatHook.useChat).mockReturnValue({
      ...mockUseChat,
      input: 'Test question',
      isChatLoading: false,
    })

    render(<ChatView />)

    const sendButton = screen.getByRole('button', { name: /send/i })
    expect(sendButton).not.toBeDisabled()
  })

  it('should render sidebar with sessions', () => {
    vi.mocked(useChatHook.useChat).mockReturnValue({
      ...mockUseChat,
      sessions: [
        { id: 'session-1', title: 'Chat 1', created_at: new Date(), updated_at: new Date() },
        { id: 'session-2', title: 'Chat 2', created_at: new Date(), updated_at: new Date() },
      ],
    })

    render(<ChatView />)

    expect(screen.getByTestId('chat-sidebar')).toBeInTheDocument()
    expect(screen.getByTestId('session-session-1')).toBeInTheDocument()
    expect(screen.getByTestId('session-session-2')).toBeInTheDocument()
  })

  it('should handle session selection', () => {
    const loadSessionMock = vi.fn()
    vi.mocked(useChatHook.useChat).mockReturnValue({
      ...mockUseChat,
      loadSession: loadSessionMock,
      sessions: [
        { id: 'session-1', title: 'Chat 1', created_at: new Date(), updated_at: new Date() },
      ],
    })

    render(<ChatView />)

    const sessionButton = screen.getByText('Session session-1')
    fireEvent.click(sessionButton)

    expect(loadSessionMock).toHaveBeenCalledWith('session-1')
  })

  it('should handle new session creation', () => {
    const createNewSessionMock = vi.fn()
    vi.mocked(useChatHook.useChat).mockReturnValue({
      ...mockUseChat,
      createNewSession: createNewSessionMock,
    })

    render(<ChatView />)

    const newSessionButton = screen.getByTestId('new-session-btn')
    fireEvent.click(newSessionButton)

    expect(createNewSessionMock).toHaveBeenCalled()
  })

  it('should handle session deletion', () => {
    const handleDeleteSessionMock = vi.fn()
    vi.mocked(useChatHook.useChat).mockReturnValue({
      ...mockUseChat,
      handleDeleteSession: handleDeleteSessionMock,
      sessions: [
        { id: 'session-1', title: 'Chat 1', created_at: new Date(), updated_at: new Date() },
      ],
    })

    render(<ChatView />)

    const deleteButton = screen.getByTestId('delete-session-1')
    fireEvent.click(deleteButton)

    expect(handleDeleteSessionMock).toHaveBeenCalledWith('session-1')
  })
})
