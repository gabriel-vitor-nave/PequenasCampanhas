import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthPage } from './AuthPage'

const mocks = vi.hoisted(() => ({ authenticate: vi.fn() }))
vi.mock('./service', () => ({ accountService: mocks }))
vi.mock('./AuthProvider', () => ({ useAuth: () => ({ user: null, loading: false }) }))
describe('username and password forms', () => {
  beforeEach(() => { vi.clearAllMocks() })
  it('shows exactly username and password, with no email or recovery flow', () => {
    render(<MemoryRouter initialEntries={['/entrar']}><AuthPage /></MemoryRouter>)
    expect(screen.getByLabelText('Usuário')).toHaveAttribute('autocomplete', 'username')
    expect(screen.getByLabelText('Senha')).toBeInTheDocument()
    expect(document.querySelectorAll('form input')).toHaveLength(2)
    expect(document.querySelector('input[type="email"]')).toBeNull()
    expect(screen.queryByText(/Esqueci minha senha/)).toBeNull()
  })
  it('submits username/password and displays a translated credential failure', async () => {
    mocks.authenticate.mockRejectedValue(new Error('invalid_credentials'))
    render(<MemoryRouter initialEntries={['/entrar']}><AuthPage /></MemoryRouter>)
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Usuário'), 'kbum')
    await user.type(screen.getByLabelText('Senha'), 'incorrect-password')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(mocks.authenticate).toHaveBeenCalledWith('login', 'kbum', 'incorrect-password')
    expect(await screen.findByRole('alert')).toHaveTextContent('Usuário ou senha incorretos.')
  })
  it('registers with the same two fields and does not request confirmation', async () => {
    mocks.authenticate.mockResolvedValue(undefined)
    render(<MemoryRouter initialEntries={['/cadastro']}><AuthPage /></MemoryRouter>)
    fireEvent.change(screen.getByLabelText('Usuário'), { target: { value: 'jogador' } })
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'a-strong-password' } })
    fireEvent.submit(screen.getByRole('button', { name: /Criar conta e entrar/ }).closest('form')!)
    await waitFor(() => expect(mocks.authenticate).toHaveBeenCalledWith('register', 'jogador', 'a-strong-password'))
    expect(document.querySelectorAll('form input')).toHaveLength(2)
    expect(screen.queryByText(/confirme|caixa de entrada|e-mail/i)).toBeNull()
  })
})
