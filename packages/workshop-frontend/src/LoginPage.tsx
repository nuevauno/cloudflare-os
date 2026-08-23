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


interface LoginPageProps {
  rpcStub: RpcStub<PublicApi>
  onLoginSuccess?: () => void
}

export default function LoginPage({ rpcStub, onLoginSuccess }: LoginPageProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const serverConfig = useServerConfig()
  const serverConfigError = useServerConfigError()
  const siteName = useSiteName()
  const connectionLost = useConnectionLost()
  useDocumentTitle('Ingresar')

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
        setError('Usuario o contraseña incorrectos')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible ingresar')
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
            No fue posible cargar la configuración.
          </p>
          <Button variant="secondary" onClick={() => window.location.reload()}>Reintentar</Button>
        </div>
      )
    }
    return (
      <div className="flex h-full min-h-0 flex-col items-center justify-center gap-4 overflow-y-auto bg-kumo-base px-4 py-8">
        <Loader size="lg" />
        <p className="text-sm text-kumo-subtle text-center">
          {connectionLost ? 'Sin conexión. Reintentando…' : 'Cargando…'}
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
          <NuevaunoIdentity siteName={siteName} size={40} className="mb-3 text-xl text-kumo-default" />
          <p className="text-sm text-kumo-subtle mt-1">Ingresa a tu cuenta</p>
        </div>

        {passwordAuthEnabled && (
          <>
            {/* Username / password form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                className="w-full"
                label="Usuario"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
                autoComplete="username"
                disabled={loading}
                placeholder="tu-usuario"
              />

              <Input
                className="w-full"
                type="password"
                label="Contraseña"
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
                Ingresar
              </Button>
            </form>

            <p className="text-center text-sm text-kumo-subtle mt-6">
              ¿Aún no tienes una cuenta?{' '}
              <Link to="/signup" className="text-kumo-brand hover:underline font-medium">
                Crear cuenta
              </Link>
            </p>
          </>
        )}

        {/* Gatekeeper sign-in options, shown whenever any auth vendor is configured. */}
        {authVendors.length > 0 && (
          <div className={passwordAuthEnabled ? 'mt-6' : ''}>
            {passwordAuthEnabled && (
              <div className="flex items-center gap-3 mb-4">
                <div className="h-px flex-1 bg-kumo-line" />
                <span className="text-xs text-kumo-subtle">o</span>
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
