/**
 * Сопоставление путей @/... из routes.js с ключами import.meta.glob.
 */

/**
 * @param {string} componentPath
 * @returns {string|null}
 */
export function componentPathToGlobKey(componentPath) {
  if (!componentPath || typeof componentPath !== 'string') {
    return null
  }

  if (componentPath.startsWith('@/modules/')) {
    return componentPath.replace('@/modules/', '../../../../../modules/').replace(/\\/g, '/')
  }

  if (componentPath.startsWith('@/')) {
    return componentPath.replace('@/', '../../').replace(/\\/g, '/')
  }

  return null
}

/**
 * @param {Object<string, Function>} rawMap
 * @returns {Object<string, Function>}
 */
export function buildNormalizedComponentsMap(rawMap) {
  const normalized = {}

  for (const [path, loader] of Object.entries(rawMap)) {
    normalized[path.replace(/\\/g, '/')] = loader
  }

  return normalized
}

/**
 * @param {string} componentPath
 * @param {Object<string, Function>} componentsMap
 * @returns {Function|null}
 */
export function findComponentLoader(componentPath, componentsMap) {
  const searchPath = componentPathToGlobKey(componentPath)
  if (!searchPath) {
    return null
  }

  return componentsMap[searchPath] ?? null
}

/**
 * Lazy loader: сначала glob, в dev — import по алиасу Vite (новые .vue до перезапуска).
 * @param {string} componentPath
 * @param {() => Object<string, Function>} getComponentsMap
 * @returns {() => Promise<*>}
 */
function wrapStaleAwareLoad(promise) {
  return promise.catch((error) => {
    void import('@/js/staleClientGuard.js').then(({ isStaleClientError, recoverFromStaleClient }) => {
      if (isStaleClientError(error)) {
        recoverFromStaleClient('deferred-component')
      }
    })
    throw error
  })
}

export function createDeferredComponentImport(componentPath, getComponentsMap) {
  return () => {
    const loader = findComponentLoader(componentPath, getComponentsMap())

    if (loader) {
      return wrapStaleAwareLoad(Promise.resolve().then(() => loader()))
    }

    // Новые .vue до перезапуска Vite: glob ещё без файла.
    // import('@/...') с @vite-ignore не резолвит алиас. new URL от этого файла
    // даёт рабочий /@fs/ путь только когда сам модуль уже с /@fs/; иначе
    // получается http://host/modules/... и 404, который ложно считает клиент устаревшим.
    if (import.meta.env.DEV && import.meta.url.includes('/@fs/')) {
      const relativePath = componentPathToGlobKey(componentPath)
      if (relativePath) {
        return wrapStaleAwareLoad(
          import(/* @vite-ignore */ new URL(relativePath, import.meta.url).href),
        )
      }
    }

    return Promise.reject(new Error(`Component not found: ${componentPath}`))
  }
}
