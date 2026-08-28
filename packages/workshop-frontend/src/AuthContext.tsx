import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { RpcStub } from 'capnweb'
import { AuthenticatedApi, AiChatAuthorInfo, type BeginSupportSessionRequest, type BillingOverviewView, type BusinessSessionView } from '@gadgets/workshop-shared/api'
import { applyUserPreferences } from './userPreferences'

interface AuthContextType {
  authenticatedApi: RpcStub<AuthenticatedApi>
  logout: () => void
  /** Current user info, fetched once on mount. Null while loading. */
  currentUser: AiChatAuthorInfo | null
  /** Whether the current user is a deployment admin. False while loading / for non-admins. */
  isAdmin: boolean
  businessSession: BusinessSessionView | null
  billingOverview: BillingOverviewView | null
  refreshBusinessSession: () => Promise<void>
  refreshBillingOverview: () => Promise<void>
  selectBusinessContext: (organizationId: string, companyId: string) => Promise<void>
  beginSupportSession: (input: BeginSupportSessionRequest) => Promise<void>
  endSupportSession: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

interface AuthProviderProps {
  children: ReactNode
  authenticatedApi: RpcStub<AuthenticatedApi>
  onLogout: () => void
}

export function AuthProvider({ children, authenticatedApi, onLogout }: AuthProviderProps) {
  const [currentUser, setCurrentUser] = useState<AiChatAuthorInfo | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [businessSession, setBusinessSession] = useState<BusinessSessionView | null>(null)
  const [billingOverview, setBillingOverview] = useState<BillingOverviewView | null>(null)

  const refreshBusinessSession = async () => {
    setBusinessSession(await authenticatedApi.getBusinessSession())
  }
  const selectBusinessContext = async (organizationId: string, companyId: string) => {
    let session: BusinessSessionView
    if (businessSession?.support) {
      const support = businessSession.support
      const ownerSession = await authenticatedApi.endSupportSession()
      setBusinessSession(ownerSession)
      setIsAdmin(true)
      const remainingMinutes = Math.max(1, Math.ceil((Date.parse(support.expiresAt) - Date.now()) / 60_000))
      session = await authenticatedApi.beginSupportSession({
        targetSubject: businessSession.effectiveSubject,
        organizationId,
        companyId,
        reason: support.reason,
        durationMinutes: remainingMinutes,
      })
      setIsAdmin(false)
    } else {
      session = await authenticatedApi.selectBusinessContext(organizationId, companyId)
    }
    setBusinessSession(session)
    try {
      setBillingOverview(await authenticatedApi.getBillingOverview(organizationId))
    } catch {
      setBillingOverview(null)
    }
  }
  const refreshBillingOverview = async () => {
    if (!businessSession?.activeOrganizationId) return setBillingOverview(null)
    setBillingOverview(await authenticatedApi.getBillingOverview(businessSession.activeOrganizationId))
  }
  const beginSupportSession = async (input: BeginSupportSessionRequest) => {
    setBusinessSession(await authenticatedApi.beginSupportSession(input))
    setIsAdmin(await authenticatedApi.amIAdmin())
  }
  const endSupportSession = async () => {
    setBusinessSession(await authenticatedApi.endSupportSession())
    setIsAdmin(await authenticatedApi.amIAdmin())
  }

  useEffect(() => {
    let cancelled = false
    authenticatedApi.whoami().then((info) => {
      if (!cancelled) setCurrentUser(info)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [authenticatedApi])

  useEffect(() => {
    let cancelled = false
    const organizationId = businessSession?.activeOrganizationId
    if (!organizationId) {
      setBillingOverview(null)
      return
    }
    authenticatedApi.getBillingOverview(organizationId).then((overview) => {
      if (!cancelled) setBillingOverview(overview)
    }).catch(() => {
      if (!cancelled) setBillingOverview(null)
    })
    return () => { cancelled = true }
  }, [authenticatedApi, businessSession?.activeOrganizationId])

  useEffect(() => {
    let cancelled = false
    authenticatedApi.getBusinessSession().then((session) => {
      if (!cancelled) setBusinessSession(session)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [authenticatedApi])

  useEffect(() => {
    let cancelled = false
    authenticatedApi.getOwnPreferences().then((preferences) => {
      if (!cancelled && preferences) applyUserPreferences(preferences.language, preferences.timeZone)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [authenticatedApi])

  useEffect(() => {
    let cancelled = false
    authenticatedApi.amIAdmin().then((admin) => {
      if (!cancelled) setIsAdmin(admin)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [authenticatedApi])

  return (
    <AuthContext.Provider value={{ authenticatedApi, logout: onLogout, currentUser, isAdmin, businessSession, billingOverview, refreshBusinessSession, refreshBillingOverview, selectBusinessContext, beginSupportSession, endSupportSession }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuthenticatedApi() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuthenticatedApi must be used within an AuthProvider')
  }
  return context
}

/** Returns the auth context when inside an AuthProvider, or null on public pages. */
export function useOptionalAuthenticatedApi(): AuthContextType | null {
  return useContext(AuthContext)
}
