import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { getUserLanguage, getUserTimeZone, type UserLanguage } from './userPreferences'

const messages = {
  es: {
    'nav.primary': 'Principal', 'nav.home': 'Inicio', 'nav.workspaces': 'Espacios',
    'nav.blueprints': 'Plantillas', 'nav.outputs': 'Resultados', 'nav.explore': 'Explorar',
    'nav.search': 'Buscar', 'nav.collapse': 'Contraer barra lateral', 'nav.expand': 'Expandir barra lateral',
    'nav.openMenu': 'Abrir menú', 'nav.closeMenu': 'Cerrar menú',
    'sidebar.favorites': 'Favoritos', 'sidebar.recent': 'Espacios recientes',
    'sidebar.favoriteEmpty': 'Marca un espacio como favorito para mantenerlo aquí.',
    'sidebar.noMatches': 'Sin coincidencias.', 'sidebar.noWorkspaces': 'Aún no hay espacios.',
    'sidebar.showAll': 'Ver todos', 'sidebar.showAllCount': 'Ver todos ({count})',
    'home.title': '¿En qué estamos trabajando?',
    'home.subtitle': 'Haz una pregunta, crea un resultado o construye una app que trabaje con tus herramientas y datos.',
    'home.examples': 'Para comenzar',
    'home.example.one.label': 'Prepara una reunión 1:1',
    'home.example.one.description': 'Un documento con contexto, temas para revisar y una petición',
    'home.example.one.prompt': 'Crea un documento para preparar mi próxima reunión 1:1: contexto actual, temas para revisar, pendientes de la última reunión y una petición clara.',
    'home.example.team.label': 'Crea una presentación de equipo',
    'home.example.team.description': 'Diapositivas con avances, riesgos y decisiones necesarias',
    'home.example.team.prompt': 'Crea una presentación para mi próxima reunión de equipo: estado actual, avances, riesgos, bloqueos y decisiones necesarias. Primero pregúntame en qué trabaja el equipo.',
    'home.example.data.label': 'Encuentra hallazgos en mis datos',
    'home.example.data.description': 'Convierte una hoja de cálculo o CSV en tendencias y recomendaciones',
    'home.example.data.prompt': 'Convierte los datos que compartiré en un análisis narrativo: tendencias, anomalías, conclusiones y recomendaciones concretas.',
    'home.example.workflow.label': 'Automatiza un flujo de trabajo',
    'home.example.workflow.description': 'Activa un agente cuando llegue un correo nuevo',
    'home.example.workflow.prompt': 'Crea un flujo de agente que se ejecute cuando llegue un correo nuevo: léelo, decide qué hacer y actúa o redacta una respuesta. Pregúntame qué bandeja debe observar y qué debe gestionar.',
    'home.example.app.label': 'Construye una herramienta rápida',
    'home.example.app.description': 'Una app interactiva, calculadora o panel pequeño',
    'home.example.app.prompt': 'Construye una pequeña herramienta interactiva que pueda usar aquí. Pregúntame qué debe hacer y luego créala.',
    'composer.waiting': 'Esperando al agente…', 'composer.new': 'Inicia una conversación…',
    'composer.followup': 'Haz una pregunta de seguimiento…', 'composer.drop': 'Suelta los archivos para adjuntarlos',
    'composer.limit': 'Los mensajes admiten hasta 5 archivos adjuntos', 'composer.options': 'Abrir opciones del chat',
    'composer.upload': 'Subir archivo', 'composer.resource': 'Agregar recurso', 'composer.model': 'Seleccionar modelo',
    'composer.noAgent': 'Sin agente', 'composer.stop': 'Detener agente', 'composer.send': 'Enviar mensaje',
    'profile.title': 'Perfil', 'profile.subtitle': 'Gestiona los datos, el avatar y la seguridad de tu cuenta.',
    'profile.preferences': 'Idioma y zona horaria', 'profile.language': 'Idioma', 'profile.timeZone': 'Zona horaria',
    'profile.preferencesHelp': 'Los cambios se aplican de inmediato a los textos, fechas y horas de esta sesión. El idioma predeterminado es español.',
    'profile.account': 'Cuenta', 'profile.avatarHelp': 'Haz clic en el avatar para subir una foto nueva',
    'profile.displayName': 'Nombre visible', 'profile.userId': 'ID de usuario', 'profile.security': 'Seguridad',
    'profile.loading': 'Cargando perfil…', 'profile.save': 'Guardar', 'profile.cancel': 'Cancelar',
    'profile.editName': 'Editar nombre visible', 'profile.copyId': 'Copiar ID de usuario',
    'profile.currentPassword': 'Contraseña actual', 'profile.newPassword': 'Contraseña nueva',
    'profile.confirmPassword': 'Confirmar contraseña nueva', 'profile.changePassword': 'Cambiar contraseña',
    'profile.changingPassword': 'Cambiando…', 'profile.passwordHint': 'Debe tener al menos 8 caracteres',
    'profile.enterName': 'Ingresa un nombre visible', 'profile.enterCurrentPassword': 'Ingresa tu contraseña actual',
    'profile.enterNewPassword': 'Ingresa una contraseña nueva',
    'profile.nameRequired': 'El nombre visible no puede estar vacío', 'profile.nameUpdated': 'Nombre visible actualizado',
    'profile.nameUpdateFailed': 'No se pudo actualizar el nombre visible',
    'profile.idCopied': 'ID de usuario copiado', 'profile.copyFailed': 'No se pudo copiar',
    'profile.passwordTooShort': 'La contraseña debe tener al menos 8 caracteres',
    'profile.passwordMismatch': 'Las contraseñas no coinciden',
    'menu.profile': 'Perfil', 'menu.providers': 'Proveedores', 'menu.admin': 'Administración',
    'menu.signOut': 'Cerrar sesión', 'menu.open': 'Abrir menú de perfil', 'utility.gatekeepers': 'Conexiones',
    'theme.system': 'Sistema', 'theme.light': 'Claro', 'theme.dark': 'Oscuro',
    'theme.systemResolved': 'Sistema ({mode})', 'theme.switch': '{current}. Cambiar a {next}.',
    'command.palette': 'Buscador de espacios y acciones',
    'command.searchPlaceholder': 'Buscar espacios y acciones…', 'command.actions': 'Acciones',
    'command.newWorkspace': 'Nuevo espacio', 'command.workspace': 'Espacio',
    'command.template': 'Plantilla', 'command.format': 'Formato',
    'command.untitledWorkspace': 'Espacio sin título', 'command.noResults': 'Sin resultados.',
    'command.navigate': 'navegar', 'command.open': 'abrir', 'command.close': 'cerrar',
    'command.newFormat': 'Nuevo {format}', 'format.document': 'documento', 'format.sheet': 'hoja',
    'format.analysis': 'análisis', 'format.slides': 'presentación', 'format.app': 'app',
    'format.workflow': 'flujo', 'format.board': 'tablero', 'format.list': 'lista', 'format.result': 'resultado',
    'status.company': 'Empresa', 'status.selectCompany': 'Cambiar empresa', 'status.noCompany': 'Sin empresa',
    'status.plan': 'Plan', 'status.noPlan': 'Sin plan',
    'billing.eyebrow': 'Mi cuenta', 'billing.title': 'Plan y facturación',
    'billing.subtitle': 'Revisa tu plan, administra tus pagos y consulta el historial de facturas.',
    'billing.currentPlan': 'Plan actual', 'billing.perMonth': 'al mes', 'billing.perYear': 'al año',
    'billing.customInterval': 'periodo personalizado', 'billing.status': 'Estado', 'billing.renewal': 'Próxima renovación',
    'billing.managePayment': 'Administrar pago', 'billing.cancel': 'Cancelar plan', 'billing.cancelling': 'Cancelando…',
    'billing.cancelConfirm': '¿Quieres cancelar el plan al terminar el periodo actual?',
    'billing.cancellationScheduled': 'La cancelación quedó programada para el final del periodo actual.',
    'billing.invoices': 'Facturas', 'billing.noInvoices': 'Aún no hay facturas asociadas a este plan.', 'billing.pay': 'Pagar',
    'billing.status.trialing': 'En prueba', 'billing.status.active': 'Activo', 'billing.status.past_due': 'Pago pendiente',
    'billing.status.paused': 'Pausado', 'billing.status.canceled': 'Cancelado',
    'billing.invoiceStatus.draft': 'Borrador', 'billing.invoiceStatus.open': 'Pendiente', 'billing.invoiceStatus.paid': 'Pagada',
    'billing.invoiceStatus.void': 'Anulada', 'billing.invoiceStatus.uncollectible': 'Incobrable',
  },
  en: {
    'nav.primary': 'Primary', 'nav.home': 'Home', 'nav.workspaces': 'Workspaces',
    'nav.blueprints': 'Templates', 'nav.outputs': 'Outputs', 'nav.explore': 'Explore',
    'nav.search': 'Search', 'nav.collapse': 'Collapse sidebar', 'nav.expand': 'Expand sidebar',
    'nav.openMenu': 'Open menu', 'nav.closeMenu': 'Close menu',
    'sidebar.favorites': 'Favorites', 'sidebar.recent': 'Recent workspaces',
    'sidebar.favoriteEmpty': 'Favorite a workspace to keep it here.',
    'sidebar.noMatches': 'No matches.', 'sidebar.noWorkspaces': 'No workspaces yet.',
    'sidebar.showAll': 'Show all', 'sidebar.showAllCount': 'Show all ({count})',
    'home.title': 'What are we working on?',
    'home.subtitle': 'Ask a question, create an output, or build an app that works with your tools and data.',
    'home.examples': 'Get started',
    'home.example.one.label': 'Write a 1:1 pre-read',
    'home.example.one.description': 'A doc with a snapshot, things to inspect, and one ask',
    'home.example.one.prompt': 'Create a document to prepare for my next 1:1: a current snapshot, things to inspect, carryover items from last time, and one clear ask.',
    'home.example.team.label': 'Build a team meeting deck',
    'home.example.team.description': 'Slides with progress, risks, and decisions needed',
    'home.example.team.prompt': 'Create a slide deck for my next team meeting: where things stand, progress, risks, blockers, and decisions needed. Ask me what the team is working on first.',
    'home.example.data.label': 'Find insights in my data',
    'home.example.data.description': 'Turn a spreadsheet or CSV into trends and recommendations',
    'home.example.data.prompt': 'Turn data I will share into a narrative analysis: trends, anomalies, conclusions, and concrete recommendations.',
    'home.example.workflow.label': 'Automate a workflow',
    'home.example.workflow.description': 'Trigger an agent when a new email arrives',
    'home.example.workflow.prompt': 'Create an agent workflow that runs when a new email arrives: read it, decide what to do, and act or draft a reply. Ask which inbox to watch and what it should handle.',
    'home.example.app.label': 'Build a quick tool',
    'home.example.app.description': 'A small interactive app, calculator, or dashboard',
    'home.example.app.prompt': 'Build a small interactive tool I can use here. Ask what it should do, then create it.',
    'composer.waiting': 'Waiting for agent…', 'composer.new': 'Start a new conversation…',
    'composer.followup': 'Ask a follow-up…', 'composer.drop': 'Drop files to attach',
    'composer.limit': 'Messages are limited to 5 attachments', 'composer.options': 'Open chat options',
    'composer.upload': 'Upload file', 'composer.resource': 'Add resource', 'composer.model': 'Select model',
    'composer.noAgent': 'No agent', 'composer.stop': 'Stop agent', 'composer.send': 'Send message',
    'profile.title': 'Profile', 'profile.subtitle': 'Manage your account details, avatar, and security.',
    'profile.preferences': 'Language and time zone', 'profile.language': 'Language', 'profile.timeZone': 'Time zone',
    'profile.preferencesHelp': 'Changes apply immediately to text, dates, and times in this session. The default language is Spanish.',
    'profile.account': 'Account', 'profile.avatarHelp': 'Click the avatar to upload a new photo',
    'profile.displayName': 'Display name', 'profile.userId': 'User ID', 'profile.security': 'Security',
    'profile.loading': 'Loading profile…', 'profile.save': 'Save', 'profile.cancel': 'Cancel',
    'profile.editName': 'Edit display name', 'profile.copyId': 'Copy user ID',
    'profile.currentPassword': 'Current password', 'profile.newPassword': 'New password',
    'profile.confirmPassword': 'Confirm new password', 'profile.changePassword': 'Change password',
    'profile.changingPassword': 'Changing…', 'profile.passwordHint': 'Must be at least 8 characters',
    'profile.enterName': 'Enter display name', 'profile.enterCurrentPassword': 'Enter current password',
    'profile.enterNewPassword': 'Enter new password',
    'profile.nameRequired': 'Display name cannot be empty', 'profile.nameUpdated': 'Display name updated',
    'profile.nameUpdateFailed': 'Failed to update display name',
    'profile.idCopied': 'User ID copied', 'profile.copyFailed': 'Failed to copy',
    'profile.passwordTooShort': 'Password must be at least 8 characters',
    'profile.passwordMismatch': 'Passwords do not match',
    'menu.profile': 'Profile', 'menu.providers': 'Providers', 'menu.admin': 'Admin',
    'menu.signOut': 'Sign out', 'menu.open': 'Open profile menu', 'utility.gatekeepers': 'Connections',
    'theme.system': 'System', 'theme.light': 'Light', 'theme.dark': 'Dark',
    'theme.systemResolved': 'System ({mode})', 'theme.switch': '{current}. Switch to {next}.',
    'command.palette': 'Workspace and action search',
    'command.searchPlaceholder': 'Search workspaces and actions…', 'command.actions': 'Actions',
    'command.newWorkspace': 'New workspace', 'command.workspace': 'Workspace',
    'command.template': 'Template', 'command.format': 'Format',
    'command.untitledWorkspace': 'Untitled workspace', 'command.noResults': 'No results.',
    'command.navigate': 'navigate', 'command.open': 'open', 'command.close': 'close',
    'command.newFormat': 'New {format}', 'format.document': 'document', 'format.sheet': 'sheet',
    'format.analysis': 'analysis', 'format.slides': 'presentation', 'format.app': 'app',
    'format.workflow': 'workflow', 'format.board': 'board', 'format.list': 'list', 'format.result': 'result',
    'status.company': 'Company', 'status.selectCompany': 'Switch company', 'status.noCompany': 'No company',
    'status.plan': 'Plan', 'status.noPlan': 'No plan',
    'billing.eyebrow': 'My account', 'billing.title': 'Plan and billing',
    'billing.subtitle': 'Review your plan, manage payments, and see your invoice history.',
    'billing.currentPlan': 'Current plan', 'billing.perMonth': 'per month', 'billing.perYear': 'per year',
    'billing.customInterval': 'custom period', 'billing.status': 'Status', 'billing.renewal': 'Next renewal',
    'billing.managePayment': 'Manage payment', 'billing.cancel': 'Cancel plan', 'billing.cancelling': 'Cancelling…',
    'billing.cancelConfirm': 'Cancel the plan at the end of the current period?',
    'billing.cancellationScheduled': 'Cancellation is scheduled for the end of the current period.',
    'billing.invoices': 'Invoices', 'billing.noInvoices': 'There are no invoices for this plan yet.', 'billing.pay': 'Pay',
    'billing.status.trialing': 'Trial', 'billing.status.active': 'Active', 'billing.status.past_due': 'Payment due',
    'billing.status.paused': 'Paused', 'billing.status.canceled': 'Canceled',
    'billing.invoiceStatus.draft': 'Draft', 'billing.invoiceStatus.open': 'Open', 'billing.invoiceStatus.paid': 'Paid',
    'billing.invoiceStatus.void': 'Void', 'billing.invoiceStatus.uncollectible': 'Uncollectible',
  },
} as const

export type MessageKey = keyof typeof messages.es
type Variables = Record<string, string | number>
type I18nValue = { language: UserLanguage; timeZone: string; t: (key: MessageKey, variables?: Variables) => string }
const I18nContext = createContext<I18nValue | null>(null)

function interpolate(language: UserLanguage, key: MessageKey, variables?: Variables): string {
  let text: string = messages[language][key]
  for (const [name, value] of Object.entries(variables ?? {})) text = text.replaceAll(`{${name}}`, String(value))
  return text
}

const fallbackI18n: I18nValue = {
  language: 'es', timeZone: 'America/Santiago', t: (key, variables) => interpolate('es', key, variables),
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState(() => ({ language: getUserLanguage(), timeZone: getUserTimeZone() }))
  useEffect(() => {
    const update = () => setPreferences({ language: getUserLanguage(), timeZone: getUserTimeZone() })
    document.documentElement.lang = preferences.language
    window.addEventListener('nuevauno:preferences', update)
    window.addEventListener('storage', update)
    return () => { window.removeEventListener('nuevauno:preferences', update); window.removeEventListener('storage', update) }
  }, [preferences.language])
  const value = useMemo<I18nValue>(() => ({
    ...preferences, t: (key, variables) => interpolate(preferences.language, key, variables),
  }), [preferences])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nValue {
  return useContext(I18nContext) ?? fallbackI18n
}

export function translate(language: UserLanguage, key: MessageKey, variables?: Variables): string {
  return interpolate(language, key, variables)
}
