// Spanish catalog - translated from en.ts
// Neutral Latin American Spanish, tú forms, no voseo

import en from "./en.js";

const es: typeof en = {
  common: {
    ok: "Aceptar",
    cancel: "Cancelar",
    continue: "Continuar",
    skip: "Omitir",
    back: "Atrás",
    next: "Siguiente",
    close: "Cerrar",
    copy: "Copiar",
    copied: "Copiado",
    error: "Error",
    warning: "Advertencia",
    loading: "Cargando...",
    settings: "Configuración",
    help: "Ayuda",
  },

  noVault: {
    title: "Aún no hay bóveda en esta máquina",
    createNew: "Crear una bóveda",
    existingVault: "Ya tengo una",
    existingExplain:
      "Señala a Valija tu carpeta de bóveda en esta u otra máquina",
  },

  createVault: {
    title: "Crea tu bóveda encriptada",
    passphrase: "Ingresa una contraseña",
    passphraseConfirm: "Confirma tu contraseña",
    passphraseHint: "Mínimo 8 caracteres",
    warning:
      "Si la pierdes a ella Y el kit de recuperación, tus datos se pierden. No hay forma de recuperarlos.",
    mismatch: "Las contraseñas no coinciden",
    creating: "Creando tu bóveda encriptada (toma aproximadamente un segundo)…",
    derived: "Contraseña aceptada. Mostrando tu kit de recuperación…",
  },

  recoveryKit: {
    title: "Tu kit de recuperación",
    explanation:
      "Este kit de recuperación está escrito y guardado en inglés para que se lea idénticamente en todas partes.",
    stored: "Ya he guardado esto en un lugar seguro sin conexión",
    cannotProceed: "Debes confirmar antes de continuar",
  },

  locked: {
    title: "La bóveda está bloqueada",
    passphrase: "Ingresa tu contraseña",
    unlocking: "Desbloqueando…",
    recoveryKey: "Solo tengo mi clave de recuperación",
  },

  migrationConfirm: {
    title: "Tu bóveda necesita una actualización de seguridad",
    description:
      "Encriptaremos y haremos copia de seguridad de tus datos durante esta actualización. Es una operación única.",
    backup: "Se creará una copia de seguridad encriptada",
    cancel: "Cancelar (la bóveda permanece bloqueada)",
    continue: "Continuar con la actualización",
  },

  forkNotice: {
    title: "Se detectó una copia duplicada de la bóveda",
    explain:
      "Esta máquina tiene una copia más antigua de tu bóveda. Consulta el panel de Sincronización para más detalles.",
  },

  dashboard: {
    title: "Tu contexto",
    noContext: "Aún no hay contexto guardado",
    connect: "Conecta una herramienta de IA",
    import: "Importa tu historial de chats",
    projectCount: { one: "1 elemento", other: "{count} elementos" },
  },

  project: {
    title: "Proyecto",
    noItems: "No hay elementos en este proyecto",
    typeFilter: "Tipo",
    allTypes: "Todos los tipos",
  },

  search: {
    title: "Buscar",
    placeholder: "Busca contexto",
    noResults: "No se encontraron resultados",
  },

  packPreview: {
    title: "Paquete de contexto",
    format: "Formato",
    markdown: "Markdown",
    json: "JSON",
    exportAs: "Exportar como…",
  },

  sync: {
    title: "Bóveda y Sincronización",
    vaultFolder: "Carpeta de bóveda",
    syncFolder: "Carpeta de sincronización reconocida",
    conflicts: "Copias en conflicto",
    staleBackups: "Copias de seguridad antiguas",
    atRest: "En reposo",
    generation: "Generación",
    lastWrite: "Última escritura por esta máquina",
    autoLock: "Bloqueo automático después de",
    idleMinutes: "Inactiva",
    moveVault: "Mover mi bóveda…",
  },

  relocate: {
    title: "Mueve tu bóveda",
    explain:
      "Valija no se comunica con Dropbox, iCloud, OneDrive ni nada más. Elige una carpeta a donde mover tus archivos de bóveda.",
    destination: "Nueva carpeta de bóveda",
    syncFolderHint: "Esta carpeta es reconocida como un servicio de sincronización",
    confirmation:
      "Valija bloqueará tu bóveda antes de moverla. Ingresarás tu contraseña nuevamente después.",
    moving: "Moviendo tu bóveda…",
    success: "Bóveda movida exitosamente",
    showExport: "Mostrar comando de terminal",
    exportHint:
      "Copia esta línea para establecer la variable de entorno en tu terminal:",
    relocking: "Bloqueando tu bóveda de nuevo…",
  },

  connectTools: {
    title: "Conecta una herramienta de IA",
    connected: "Conectada",
    notConnected: "No conectada",
    connect: "Conectar",
    connecting: "Conectando…",
    restart: "Reinicia {tool} para que aplique",
    configPath: "Archivo de configuración: {path}",
    backupPath: "Copia de seguridad creada: {path}",
    manualInstructions: "Instrucciones de conexión manual",
  },

  import: {
    title: "Importa tu historial de chats",
    explain:
      "Esto lee un archivo que descargaste. Valija nunca contacta a ChatGPT, Claude o nada más.",
    selectFile: "Elige archivo",
    format: "Formato de archivo",
    autoDetect: "Detectar automáticamente",
    conversations: "Conversaciones",
    target: "Importar a",
    targetRequired: "Elige un proyecto",
    newProject: "Nuevo proyecto",
    preview: "Vista previa",
    importing: "Importando…",
    success: "Importación completa",
    note: "Los elementos importados son buscables pero no aparecen en paquetes de contexto",
  },

  diagnostics: {
    title: "Diagnósticos",
    runDiagnostics: "Ejecutar diagnósticos",
    running: "Ejecutando verificaciones…",
    copyReport: "Copiar reporte",
    reportCopied: "Reporte copiado al portapapeles",
    checks: {
      node: "Node.js",
      sqlcipher: "SQLCipher",
      keychain: "Llavero",
      vault: "Bóveda",
      journal: "Diario",
      sync: "Sincronización",
      lineage: "Linaje",
      autoLock: "Bloqueo automático",
    },
    keychain_probe:
      "La verificación del llavero escribe y elimina inmediatamente una entrada de prueba. En macOS esto puede solicitar permiso.",
  },

  settings: {
    title: "Configuración",
    appearance: "Apariencia",
    theme: "Tema",
    systemTheme: "Seguir sistema",
    lightTheme: "Claro",
    darkTheme: "Oscuro",
    language: "Idioma",
    systemLanguage: "Seguir sistema",
    vaultSync: "Bóveda y Sincronización",
    showDiagnostics: "Ejecutar diagnósticos",
    moveVault: "Mover mi bóveda",
    help: "Ayuda",
    showWelcomeAgain: "Mostrar tour de bienvenida de nuevo",
  },

  onboarding: {
    slideOne: "¿Qué es Valija?",
    slideOneText:
      "Valija es una bóveda de contexto encriptada que te permite guardar tus conversaciones y documentos, para luego usarlos con múltiples herramientas de IA — Claude, ChatGPT, Cursor y más. Todo se mantiene en tu máquina.",
    slideTwo: "Guarda tu contexto",
    slideTwoText:
      "Guardas contexto desde dentro de una herramienta de IA que conectas — no desde esta aplicación. Valija lo recibe encriptado y lo almacena localmente.",
    slideThree: "Usa tu contexto en todas partes",
    slideThreeText:
      "Explora tus conversaciones guardadas, búscalas, toma un paquete de los elementos más relevantes y envíalo a la herramienta de IA que estés usando. Eso es todo lo que puedes hacer aquí.",
    slideFour: "Tu privacidad, tu control",
    slideFourText:
      "Todo está encriptado en reposo. Nada sale de tu máquina. No hay forma de recuperar tu contraseña y el kit de recuperación es la única otra forma de acceder.",
    getStarted: "Comenzar",
  },

  errors: {
    VAULT_NOT_FOUND: "Bóveda no encontrada",
    VAULT_ALREADY_EXISTS: "Ya existe una bóveda en esta ubicación",
    VAULT_UPGRADE_REQUIRED: "La bóveda necesita una actualización de seguridad",
    VAULT_MUST_BE_LOCKED: "La bóveda debe estar bloqueada para relocalizarla",
    INVALID_PASSPHRASE: "Contraseña inválida",
    VAULT_FORK_DETECTED: "Se detectó una copia duplicada de la bóveda",
    RELOCATION_DESTINATION_OCCUPIED: "El destino ya contiene archivos de bóveda",
    RELOCATION_DESTINATION_UNUSABLE:
      "El destino no es un directorio escribible",
    RELOCATION_DESTINATION_NESTED: "El destino no puede estar dentro de la bóveda actual",
    RELOCATION_SOURCE_UNSETTLED:
      "No se puede mover bóveda con conflictos sin resolver o copias antiguas",
    RELOCATION_COPY_FAILED: "Error al copiar archivos de bóveda",
    RELOCATION_VERIFY_FAILED: "Verificación de copia de destino falló",
    RELOCATION_ROLLBACK_FAILED:
      "No se puede completar la reubicación de forma segura — puede ser necesaria limpieza manual",
  },
};

export default es;
