import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthPage } from './AuthPage'

const mocks = vi.hoisted(() => ({ signInWithPassword: vi.fn(), signUp: vi.fn(), resetPasswordForEmail: vi.fn() }))
vi.mock('../../lib/supabase', () => ({ backend: () => ({ auth: mocks }) }))
vi.mock('./AuthProvider', () => ({ useAuth: () => ({ user: null, loading: false }) }))
describe('authentication forms', () => {
  beforeEach(() => { vi.clearAllMocks() })
  it('submits credentials to auth and shows a translated failure', async () => {
    mocks.signInWithPassword.mockResolvedValue({ error: { code: 'invalid_credentials' } })
    render(<MemoryRouter initialEntries={['/entrar']}><AuthPage /></MemoryRouter>)
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('E-mail'), 'user@example.com')
    await user.type(screen.getByLabelText('Senha'), 'invalid-password')
    await user.click(screen.getByRole('button', { name: /Entrar na plataforma/ }))
    expect(mocks.signInWithPassword).toHaveBeenCalledWith({ email: 'user@example.com', password: 'invalid-password' })
    expect(await screen.findByRole('alert')).toHaveTextContent('E-mail ou senha incorretos.')
  })
  it('does not claim that an unknown recovery account exists', async () => {
    mocks.resetPasswordForEmail.mockResolvedValue({ error: null })
    render(<MemoryRouter initialEntries={['/recuperar-senha']}><AuthPage /></MemoryRouter>)
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'unknown@example.com' } })
    fireEvent.submit(screen.getByRole('button', { name: /Enviar link/ }).closest('form')!)
    expect(await screen.findByRole('status')).toHaveTextContent('Se este e-mail possuir uma conta')
    expect(mocks.resetPasswordForEmail).toHaveBeenCalledWith('unknown@example.com', { redirectTo: `${window.location.origin}/auth/nova-senha` })
  })
  it('includes display name and confirmation redirect on signup', async () => {
    mocks.signUp.mockResolvedValue({ error: null })
    render(<MemoryRouter initialEntries={['/cadastro']}><AuthPage /></MemoryRouter>)
    fireEvent.change(screen.getByLabelText('Nome de exibição'), { target: { value: 'Minha Pessoa' } })
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'user@example.com' } })
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'a-strong-password' } })
    fireEvent.submit(screen.getByRole('button', { name: /Criar conta/ }).closest('form')!)
    await waitFor(() => expect(mocks.signUp).toHaveBeenCalledWith(expect.objectContaining({ options: { data: { display_name: 'Minha Pessoa' }, emailRedirectTo: `${window.location.origin}/auth/callback` } })))
    expect(await screen.findByRole('status')).toHaveTextContent('confirmar o e-mail')
  })
})
