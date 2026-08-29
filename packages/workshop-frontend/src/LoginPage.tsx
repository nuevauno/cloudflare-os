import { useState, FormEvent } from 'react'
import { Link } from '@tanstack/react-router'
import { RpcStub } from 'capnweb'
import { PublicApi } from '@gadgets/workshop-shared/api'
import { Input, Button, Banner, Loader } from '@cloudflare/kumo'
import { hashPassword } from './passwordHash'
import { useServerConfig, useServerConfigError, useSiteName } from './ServerConfigContext'
import { useDocumentTitle } from './useDocumentTitle'
import { useConnectionLost } from './RpcContext'
import OAuthButtons from './components/auth/OAuthButtons'
import NuevaunoIdentity from './components/NuevaunoIdentity'
import { useI18n } from './i18n'


interface LoginPageProps {
  rpcStub: RpcStub<PublicApi>
  onLoginSuccess?: () => void
}

export default function LoginPage({ rpcStub, onLoginSuccess }: LoginPageProps) {
  const { t } = useI18n()
  const resetParams = new URLSearchParams(window.location.search)
  const resetToken = resetParams.get('reset') ?? ''
  const resetUser = resetParams.get('user') ?? ''
  const passwordResetSuccess = resetParams.get('password-reset') === 'success'
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [recoveryMode, setRecoveryMode] = useState(Boolean(resetToken && resetUser))
  const [recoverySent, setRecoverySent] = useState(passwordResetSuccess)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const serverConfig = useServerConfig()
  const serverConfigError = useServerConfigError()
  const siteName = useSiteName()
  const connectionLost = useConnectionLost()
  useDocumentTitle(t('auth.loginTitle'))

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!username || !password || loading) return
    setLoading(true)
    setError(null)

    try {
      const passwordHash = await hashPassword(username, password)
      const token = await rpcStub.login(username, passwordHash)
      if (token) {
        localStorage.setItem('authToken', token)
        if (onLoginSuccess) {
          onLoginSuccess()
        } else {
          window.location.reload()
        }
      } else {
        setError(t('auth.invalidCredentials'))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.loginFailed'))
    } finally {
      setLoading(false)
    }
  }

  const handleRecovery = async (e: FormEvent) => {
    e.preventDefault()
    if (loading) return
    setLoading(true)
    setError(null)
    try {
      if (resetToken && resetUser) {
        if (password.length < 8 || password !== confirmPassword) {
          setError(t('auth.passwordRules'))
          return
        }
        const changed = await rpcStub.resetPassword(
          resetUser,
          resetToken,
          await hashPassword(resetUser, password),
        )
        if (!changed) {
          setError(t('auth.expiredReset'))
          return
        }
        window.location.assign('/?password-reset=success')
        return
      }
      if (!username.trim()) return
      await rpcStub.requestPasswordReset(username.trim())
      setRecoverySent(true)
    } catch {
      setRecoverySent(true)
    } finally {
      setLoading(false)
    }
  }

  // Until the deployment config loads we don't know which auth methods are enabled, so don't guess:
  // defaulting to the password form would show it even where it's disabled (and hide configured
  // OAuth providers). This is especially important when the server is unreachable — serverConfig
  // stays null — so render a loading / connection state instead of a misconfigured form.
  if (!serverConfig) {
    if (serverConfigError && !connectionLost) {
      return (
        <div
          role="alert"
          className="flex h-full min-h-0 flex-col items-center justify-center gap-4 overflow-y-auto bg-kumo-base px-4 py-8"
        >
          <p className="text-sm text-kumo-danger text-center">
            {t('auth.configFailed')}
          </p>
          <Button variant="secondary" onClick={() => window.location.reload()}>{t('auth.retry')}</Button>
        </div>
      )
    }
    return (
      <div className="flex h-full min-h-0 flex-col items-center justify-center gap-4 overflow-y-auto bg-kumo-base px-4 py-8">
        <Loader size="lg" />
        <p className="text-sm text-kumo-subtle text-center">
          {connectionLost ? t('auth.offline') : t('auth.loading')}
        </p>
      </div>
    )
  }

  const authVendors = serverConfig.authVendors ?? []
  const passwordAuthEnabled = serverConfig.passwordAuthEnabled

  return (
    <div className="relative flex h-full min-h-0 flex-col items-center justify-start overflow-y-auto bg-kumo-base px-4 py-8">
      {/* Dot grid — fades from top to bottom */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, var(--color-kumo-line) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
          maskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 70%)',
          WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 70%)',
        }}
      />

      <div className="relative my-auto w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <NuevaunoIdentity siteName={siteName} size={56} showOs={false} className="mb-3 text-2xl text-kumo-default" />
          <p className="text-sm text-kumo-subtle mt-1">
            {recoveryMode ? t('auth.recoveryTitle') : t('auth.loginSubtitle')}
          </p>
        </div>

        {passwordAuthEnabled && (
          <>
            {recoverySent && !recoveryMode && (
              <Banner
                variant="default"
                title={passwordResetSuccess ? t('auth.resetSuccess') : t('auth.resetSent')}
                className="mb-4"
              />
            )}
            {recoveryMode ? (
              <form onSubmit={handleRecovery} className="space-y-4">
                {!resetToken && (
                  <Input
                    className="w-full"
                    label={t('auth.username')}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoFocus
                    autoComplete="username"
                    disabled={loading}
                    placeholder="tu@empresa.com"
                  />
                )}
                {resetToken && (
                  <>
                    <Input
                      className="w-full"
                      type="password"
                      label={t('auth.newPassword')}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoFocus
                      autoComplete="new-password"
                      disabled={loading}
                      placeholder={t('auth.minimumPassword')}
                    />
                    <Input
                      className="w-full"
                      type="password"
                      label={t('auth.repeatPassword')}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      autoComplete="new-password"
                      disabled={loading}
                      placeholder={t('auth.repeatPassword')}
                    />
                  </>
                )}
                {error && <Banner variant="error" title={error} />}
                <Button
                  type="submit"
                  variant="primary"
                  loading={loading}
                  disabled={resetToken ? password.length < 8 || password !== confirmPassword : !username.trim()}
                  className="w-full justify-center"
                >
                  {resetToken ? t('auth.savePassword') : t('auth.sendLink')}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setRecoveryMode(false)}
                  className="w-full justify-center"
                >
                  {t('auth.backToLogin')}
                </Button>
              </form>
            ) : (
            <>
            {/* Username / password form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                className="w-full"
                label={t('auth.username')}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
                autoComplete="username"
                disabled={loading}
                placeholder="tu@empresa.com"
              />

              <Input
                className="w-full"
                type="password"
                label={t('auth.password')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                disabled={loading}
                placeholder="••••••••"
              />

              {error && (
                <Banner variant="error" title={error} />
              )}

              <Button
                type="submit"
                variant="primary"
                disabled={!username || !password}
                loading={loading}
                className="w-full justify-center"
              >
                {t('auth.submit')}
              </Button>
            </form>

            <button
              type="button"
              onClick={() => { setRecoveryMode(true); setRecoverySent(false); setError(null) }}
              className="mt-4 w-full text-center text-sm text-kumo-brand hover:underline"
            >
              {t('auth.forgotPassword')}
            </button>

            <p className="text-center text-sm text-kumo-subtle mt-6">
              {t('auth.noAccount')}{' '}
              <Link to="/signup" className="text-kumo-brand hover:underline font-normal">
                {t('auth.createAccount')}
              </Link>
            </p>
            </>
            )}
          </>
        )}

        {/* Gatekeeper sign-in options, shown whenever any auth vendor is configured. */}
        {authVendors.length > 0 && (
          <div className={passwordAuthEnabled ? 'mt-6' : ''}>
            {passwordAuthEnabled && (
              <div className="flex items-center gap-3 mb-4">
                <div className="h-px flex-1 bg-kumo-line" />
                <span className="text-xs text-kumo-subtle">{t('auth.or')}</span>
                <div className="h-px flex-1 bg-kumo-line" />
              </div>
            )}
            {!passwordAuthEnabled && error && (
              <Banner variant="error" title={error} className="mb-4" />
            )}
            <OAuthButtons rpcStub={rpcStub} vendors={authVendors} onSuccess={onLoginSuccess} />
          </div>
        )}
      </div>
    </div>
  )
}
