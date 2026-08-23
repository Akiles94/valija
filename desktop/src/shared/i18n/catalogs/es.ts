import type { Catalog } from "./en.js";

/**
 * Neutral Latin American Spanish, "tú" forms, no voseo (D-V(c)). Structural
 * completeness against `en.ts` is enforced by the `const es: Catalog = {...}`
 * annotation below — a missing or misspelled key is a typecheck failure.
 *
 * Four surfaces here are security copy, reviewed as such (§8.17): the
 * passphrase warning (createVault), the clipboard warning (recoveryKit), the
 * relocation refusals (relocate), and the migration confirmation (migration).
 */
export const es: Catalog = {
  common: {
    appName: "Valija",
    cancel: "Cancelar",
    continueAction: "Continuar",
    back: "Atrás",
    next: "Siguiente",
    skip: "Omitir",
    copy: "Copiar",
    copied: "Copiado",
    tryAgain: "Reintentar",
    close: "Cerrar",
    settings: "Configuración",
    loading: "Cargando…",
    connected: "Conectado",
    notConnected: "No conectado",
  },

  noVault: {
    title: "Todavía no hay una bóveda en este equipo.",
    createVault: "Crear una bóveda",
    haveOne: "Ya tengo una",
    haveOneExplainer:
      "Valija busca una bóveda en ~/.valija de forma predeterminada. Si la tuya está en otro lugar, por ejemplo dentro de una carpeta sincronizada, indícale a la aplicación dónde está y no se moverá nada.",
  },

  createVault: {
    title: "Crea tu bóveda",
    passphraseLabel: "Frase de contraseña",
    passphraseConfirmLabel: "Confirma la frase de contraseña",
    minLengthWarning: "Las frases de contraseña deben tener al menos 8 caracteres.",
    lossWarning:
      "Si la pierdes junto con el kit de recuperación, tus datos se pierden. No existe forma de restablecerla.",
    mismatchError: "Esas frases de contraseña no coinciden.",
    deriving: "Creando tu bóveda cifrada (aproximadamente un segundo)…",
    submit: "Crear bóveda",
  },

  recoveryKit: {
    title: "Tu kit de recuperación",
    englishNotice:
      "Esto está escrito y guardado en inglés a propósito, para que se lea igual en cualquier equipo, en cualquier idioma, dentro de varios años.",
    copyKey: "Copiar clave",
    copyKeyWarning:
      "Mientras esté en el portapapeles, otras aplicaciones de este equipo pueden leerla.",
    acknowledge: "Ya guardé esto en un lugar seguro fuera de línea",
    confirm: "Continuar",
  },

  onboarding: {
    slide1Title: "Esto es Valija",
    slide1Body:
      "Una bóveda local y cifrada para el contexto que usas con herramientas de IA: Claude, ChatGPT, Cursor y cualquier otra que hable MCP.",
    slide2Title: "Guarda una vez, úsalo en todas partes",
    slide2Body:
      "Guardar contenido ocurre desde dentro de una herramienta de IA que hayas conectado, no desde esta ventana. Conecta una herramienta o importa tu historial de chats para empezar.",
    slide3Title: "Explora, busca y llévalo contigo",
    slide3Body:
      "Encuentra lo que has guardado y lleva un paquete de contexto a cualquier conversación.",
    slide4Title: "Local primero, y cifrado",
    slide4Body:
      "Nada sale de este equipo a menos que tú mismo lo copies. No existe un restablecimiento de contraseña: el kit de recuperación es la única otra forma de entrar.",
    getStarted: "Comenzar",
    replayHelp: "Ver de nuevo el recorrido de bienvenida",
  },

  locked: {
    title: "Desbloquea tu bóveda",
    passphraseLabel: "Frase de contraseña",
    unlock: "Desbloquear",
    useRecoveryKey: "Solo tengo mi clave de recuperación",
    recoveryKeyLabel: "Clave de recuperación",
    forkTitle: "Esta bóveda cambió en otro lugar",
    forkBody:
      "La bóveda en {vaultPath} recibió cambios de otro dispositivo sin los cambios de este. No se ha fusionado ni eliminado nada; consulta el panel de sincronización para saber qué hacer.",
    goToSync: "Abrir Sincronización y seguridad",
  },

  dashboard: {
    emptyTitle: "Todavía no hay contexto guardado.",
    connectATool: "Conectar una herramienta de IA",
    importHistory: "Importar tu historial de chats",
    itemCount: {
      one: "{count} elemento",
      other: "{count} elementos",
    },
    lastActivity: "Última actividad {date}",
  },

  project: {
    typeFilterAll: "Todos los tipos",
    typeFilterImported: "Importado",
    pinned: "Fijado",
    noItems: "Todavía no hay elementos en este proyecto.",
  },

  search: {
    placeholder: "Busca en tu bóveda",
    scopeAllProjects: "Todos los proyectos",
    resultCount: {
      one: "{count} resultado",
      other: "{count} resultados",
    },
    noResults: "Sin resultados.",
  },

  pack: {
    title: "Paquete de contexto",
    copy: "Copiar",
    export: "Exportar…",
    exportFormatMarkdown: "Markdown",
    exportFormatJson: "JSON",
    notTranslatedNotice:
      "Este es tu contenido guardado, mostrado exactamente como se exportará; nunca se traduce.",
  },

  connect: {
    title: "Conecta tus herramientas de IA",
    pointsAt: "Apunta a {vaultPath}",
    connectButton: "Conectar",
    connectedDetail:
      "Se agregó valija a {configPath}. Hay una copia de seguridad de tu configuración anterior en {backupPath}. Reinicia {client} para que lo detecte.",
    nodeMissingTitle: "Node.js no está instalado en este equipo",
    nodeMissingBody:
      "Tus herramientas de IA usan valija a través de Node.js, que no está instalado en este equipo. Conectar ahora guardará el ajuste, pero la herramienta no podrá acceder a tu bóveda hasta que instales Node.js.",
    nodeMissingDocsLink: "Cómo instalar Node.js",
    manualInstructionsIntro: "También puedes agregar esto tú mismo:",
    manualInstructionsCopied: "Se copiaron las instrucciones manuales",
    failureNotInstalled: "{client} no parece estar instalado en este equipo.",
    failureInvalidConfig:
      "El archivo de configuración de {client} no es JSON válido; se dejó sin cambios.",
  },

  import: {
    title: "Importa tu historial de chats",
    explainer:
      "Esto lee un archivo de exportación que descargaste de ChatGPT o Claude. Valija nunca se comunica con ninguno de los dos servicios.",
    chooseFile: "Elegir un archivo…",
    detectingFormat: "Leyendo el archivo…",
    formatOverridePrompt: "No pudimos identificar de qué exportación se trata. Elige el formato:",
    conversationCount: {
      one: "{count} conversación encontrada",
      other: "{count} conversaciones encontradas",
    },
    filterPlaceholder: "Filtrar conversaciones",
    projectLabel: "Importar en",
    projectNewOption: "Nuevo proyecto…",
    preview: "Vista previa",
    previewSummary:
      "Se importarían {itemCount} elementos de {conversationCount} conversaciones en '{project}' (omitidas {skipped}, fallidas {failed}).",
    importButton: "Importar",
    importSummary:
      "Se importaron {itemCount} elementos de {conversationCount} conversaciones en '{project}'.",
    perConversationFailure: "{title}: {reason}",
    excludedFromPacksNotice:
      "Los elementos importados se pueden buscar y aparecen en el proyecto, pero no forman parte de los paquetes de contexto.",
    busyRetrying: "Hay otro guardado en curso; reintentando…",
  },

  diagnostics: {
    title: "Revisar mi configuración",
    run: "Ejecutar comprobaciones",
    keychainProbeNotice:
      "La comprobación del llavero escribe y elimina de inmediato una entrada de prueba en el llavero de tu sistema operativo. En macOS esto puede mostrarte un aviso.",
    copyReport: "Copiar informe",
    copyReportNotice:
      "El informe se mantiene en inglés y puede incluir uno de los mensajes de error propios de Valija, con fines de soporte técnico.",
    appNodeRow: "Node.js (esta aplicación)",
    toolNodeRow: "Node.js (tus herramientas de IA)",
    fatal: "Problema",
    warning: "Advertencia",
    ok: "Correcto",
  },

  sync: {
    title: "Sincronización y seguridad",
    vaultFolder: "Carpeta de la bóveda",
    looksLikeCloud: "Esta carpeta parece estar sincronizada por otra aplicación.",
    notRecognizedAsCloud: "Valija no puede determinar si esta carpeta se sincroniza.",
    conflictedCopiesFound: {
      one: "Se encontró 1 copia en conflicto",
      other: "Se encontraron {count} copias en conflicto",
    },
    staleBackupsFound: {
      one: "Se encontró 1 copia de seguridad de actualización sobrante",
      other: "Se encontraron {count} copias de seguridad de actualización sobrantes",
    },
    atRest: "En reposo: sin escrituras pendientes",
    notAtRest: "No está en reposo: hay una escritura en curso o se interrumpió",
    generation: "Generación {generation}",
    lastWriterThisDevice: "Este dispositivo escribió por última vez",
    lastWriterOtherDevice: "Otro dispositivo escribió por última vez",
    autoLock: "Se bloquea automáticamente tras {minutes} minutos de inactividad",
    conflictGuidance:
      "Valija no ha eliminado nada. Ambos archivos se abren con la misma frase de contraseña. No hay fusión automática: abre cada uno y decide cuál conservar.",
    moveVault: "Mover mi bóveda…",
  },

  relocate: {
    title: "Mueve tu bóveda",
    explainer:
      "Valija no se comunica con Dropbox, iCloud, OneDrive ni con nada más. La sincronización funciona porque la carpeta de tu bóveda vive dentro de una carpeta que tu propia aplicación de sincronización ya mantiene al día. Esto la mueve allí, recuerda a dónde fue y actualiza las herramientas de IA que has conectado para que sigan encontrándola.",
    chooseFolder: "Elegir una carpeta…",
    folderRecognizedAsCloud: "Esta carpeta parece estar sincronizada por otra aplicación.",
    folderNotRecognized:
      "Valija no puede confirmar que esta carpeta se sincronice; aun así puedes usarla.",
    clientsToRepoint:
      "Estas herramientas conectadas se actualizarán para apuntar a la nueva carpeta:",
    clientConfigUnreadable:
      "No se pudo leer la configuración de {client}; después recibirás instrucciones manuales para ella.",
    refusalOccupied: "Ya existe una bóveda en esa ubicación. Elige una carpeta vacía.",
    refusalUnusable: "Esa carpeta no existe o no se puede escribir en ella.",
    refusalNested:
      "Esa carpeta está dentro de la carpeta de tu bóveda actual; elige una diferente.",
    refusalSourceUnsettled:
      "Resuelve primero la copia en conflicto o la copia de seguridad sobrante en la carpeta de tu bóveda actual.",
    refusalNotAtRest:
      "Tu bóveda todavía no está en reposo; cierra cualquier otra conexión e inténtalo de nuevo.",
    lockNotice:
      "Valija bloqueará tu bóveda antes de moverla. Después tendrás que ingresar tu frase de contraseña de nuevo.",
    confirmMove: "Mover bóveda",
    moving: "Moviendo tu bóveda…",
    moveFailed: "El movimiento falló. Tu bóveda no ha cambiado en su ubicación original.",
    repointSuccess: "{clients} ahora apuntan a la nueva carpeta. Reinícialos para que lo detecten.",
    repointFailure: "{client} no se pudo actualizar automáticamente.",
    envLineIntro:
      "La línea de comandos no lee la configuración de esta aplicación. Ejecuta esto en tu terminal:",
    envLineCopied: "Se copió el comando",
    unlockAgain: "Desbloquear de nuevo",
  },

  migration: {
    title: "Esta bóveda necesita una actualización",
    body: "Valija necesita actualizar el formato de esta bóveda antes de poder abrirla. Primero se crea una copia de seguridad cifrada, así que no se pierde nada si algo sale mal.",
    backupNotice: "Se guardará una copia de seguridad de la base de datos cifrada en {backupPath}.",
    cancel: "Ahora no",
    confirm: "Actualizar y continuar",
  },

  settings: {
    title: "Configuración",
    appearance: "Apariencia",
    appearanceSystem: "Seguir el sistema",
    appearanceLight: "Claro",
    appearanceDark: "Oscuro",
    language: "Idioma",
    languageSystem: "Seguir el sistema",
    languageEnglish: "English",
    languageSpanish: "Español",
    vaultAndSync: "Bóveda y sincronización",
    openDiagnostics: "Revisar mi configuración",
    openRelocate: "Mover mi bóveda…",
    help: "Ayuda",
    replayTour: "Ver de nuevo el recorrido de bienvenida",
  },

  errors: {
    VAULT_NOT_FOUND: "No se encontró ninguna bóveda ahí.",
    VAULT_ALREADY_EXISTS: "Ya existe una bóveda ahí.",
    VAULT_LOCKED: "Tu bóveda está bloqueada. Desbloquéala e inténtalo de nuevo.",
    WRONG_PASSPHRASE: "Esa frase de contraseña no coincide con esta bóveda.",
    WEAK_PASSPHRASE: "Las frases de contraseña deben tener al menos 8 caracteres.",
    KEYCHAIN_ERROR: "Valija no pudo acceder al llavero de tu sistema operativo.",
    STORAGE_ERROR: "Algo salió mal al leer o escribir los archivos de la bóveda.",
    INVALID_DEVICE_ID: "La identidad de este dispositivo parece dañada.",
    INVALID_GENERATION: "El historial de escrituras de la bóveda parece dañado.",
    INVALID_WRITE_STAMP: "El historial de escrituras de la bóveda parece dañado.",
    VAULT_FORK_DETECTED: "Esta bóveda cambió en otro dispositivo sin los cambios de este.",
    INVALID_PROJECT_NAME: "Ese nombre de proyecto no es válido.",
    INVALID_ITEM_TYPE: "Ese tipo de elemento no es válido.",
    INVALID_TAG: "Esa etiqueta no es válida.",
    CONTENT_TOO_LARGE: "Ese contenido es demasiado grande para guardarlo.",
    CONTENT_EMPTY: "Ese contenido está vacío.",
    TOO_MANY_TAGS: "Ese elemento tiene demasiadas etiquetas.",
    PROJECT_NOT_FOUND: "Ese proyecto no existe.",
    ITEM_NOT_FOUND: "Ese elemento no existe.",
    UNSUPPORTED_SOURCE:
      "Valija no reconoce ese formato de exportación. Elige el formato manualmente.",
    MALFORMED_EXPORT: "Ese archivo de exportación parece dañado.",
    EMPTY_EXPORT: "Ese archivo de exportación no tiene nada para importar.",
    UNREADABLE_FILE: "No se pudo leer ese archivo.",
    CORRUPT_ARCHIVE: "Ese archivo comprimido parece dañado.",
    INVALID_SELECTION: "Esa selección no es válida.",
    NO_CONVERSATIONS_SELECTED: "Selecciona al menos una conversación para importar.",
    UNSUPPORTED_GENERIC_VERSION: "Esa versión de exportación no es compatible.",
    VAULT_UPGRADE_REQUIRED: "Esta bóveda necesita una actualización antes de poder abrirse.",
    RELOCATION_DESTINATION_OCCUPIED:
      "Ya existe una bóveda en esa ubicación. Elige una carpeta vacía.",
    RELOCATION_DESTINATION_UNUSABLE: "Esa carpeta no existe o no se puede escribir en ella.",
    RELOCATION_DESTINATION_NESTED:
      "Esa carpeta está dentro de la carpeta de tu bóveda actual; elige una diferente.",
    RELOCATION_SOURCE_UNSETTLED:
      "Resuelve primero la copia en conflicto o la copia de seguridad sobrante en la carpeta de tu bóveda actual.",
    RELOCATION_COPY_FAILED:
      "El movimiento falló. Tu bóveda no ha cambiado en su ubicación original.",
    RELOCATION_VERIFY_FAILED:
      "El movimiento falló. Tu bóveda no ha cambiado en su ubicación original.",
    RELOCATION_ROLLBACK_FAILED:
      "Valija no pudo terminar de deshacer un movimiento fallido. Tanto {sourcePath} como {destinationPath} podrían tener una copia; conserva solo una.",
    VAULT_MUST_BE_LOCKED: "Bloquea tu bóveda antes de moverla.",
    generic: "Algo salió mal ({code}).",
  },
};
