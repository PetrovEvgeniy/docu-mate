import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { server } from './mocks/server'

describe('Test Setup', () => {
  it('should render a simple component', () => {
    const TestComponent = () => <div>Hello Test</div>
    render(<TestComponent />)
    expect(screen.getByText('Hello Test')).toBeInTheDocument()
  })

  it('should have MSW server configured', () => {
    expect(server).toBeDefined()
  })

  it('should have environment variables', () => {
    expect(process.env.NEXT_PUBLIC_API_URL).toBe('http://localhost:8000')
  })
})
