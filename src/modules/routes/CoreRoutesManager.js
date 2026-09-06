/**
 * МЕНЕДЖЕР БАЗОВЫХ РОУТОВ СИСТЕМЫ
 * 
 * Управляет core и auth роутами из конфигурации
 * 
 * ВАЖНО: Использует глобы из ModuleLoader для единой точки загрузки
 */

import { logError, logWarn } from '@/js/utils/logError.js'
import { ModuleLoader } from '../core/ModuleLoader.js'
import { authRoutes as fileAuthRoutes, coreRoutes as fileCoreRoutes } from '@/config/routes.js'
import {
  buildNormalizedComponentsMap,
  componentPathToGlobKey,
  createDeferredComponentImport,
  findComponentLoader,
} from './resolveComponentLoader.js'

const sharedLoader = new ModuleLoader()

function asRouteList(value) {
  return Array.isArray(value) ? value : []
}

export class CoreRoutesManager {
  constructor(coreRoutesConfig) {
    const fromArg = coreRoutesConfig && typeof coreRoutesConfig === 'object'
      ? coreRoutesConfig
      : {}
    const coreList = asRouteList(fromArg.coreRoutes)
    const authList = asRouteList(fromArg.authRoutes)
    const fileCore = asRouteList(fileCoreRoutes)
    const fileAuth = asRouteList(fileAuthRoutes)
    this.coreRoutesConfig = {
      coreRoutes: coreList.length ? coreList : fileCore,
      authRoutes: authList.some((route) => route?.name === 'Login') ? authList : fileAuth,
    }
  }

  getComponentsMap() {
    return buildNormalizedComponentsMap(sharedLoader.getGlobsByType('components', 'all'))
  }

  /**
   * Получает функцию загрузки компонента
   * @param {string} componentPath - путь к компоненту
   * @returns {Function|null}
   */
  getComponentLoader(componentPath) {
    if (typeof componentPath === 'function') {
      return componentPath
    }

    const loader = findComponentLoader(componentPath, this.getComponentsMap())

    if (!loader) {
      logWarn(`Компонент не найден: ${componentPath} (искали: ${componentPathToGlobKey(componentPath)})`)
    }

    return loader || null
  }

  /**
   * Преобразует путь компонента в динамический импорт
   * @param {string} componentPath - путь к компоненту
   * @returns {Function}
   */
  transformComponentPath(componentPath) {
    const loader = this.getComponentLoader(componentPath)

    if (!loader) {
      logError('Не удалось преобразовать путь', componentPath)
    }

    return createDeferredComponentImport(componentPath, () => this.getComponentsMap())
  }

  /**
   * Преобразует роут из JSON формата в объект Vue Router
   * @param {Object} route - роут из конфигурации
   * @returns {Object}
   */
  transformRoute(route) {
    const transformedRoute = { ...route }

    if (route.component && typeof route.component === 'string') {
      transformedRoute.component = this.transformComponentPath(route.component)
    }

    return transformedRoute
  }

  /**
   * Загружает core роуты
   * @returns {Array}
   */
  loadCoreRoutes() {
    try {
      return this.coreRoutesConfig.coreRoutes.map(route => 
        this.transformRoute(route)
      )
    } catch (error) {
      logError('Ошибка загрузки core роутов:', error)
      return []
    }
  }

  /**
   * Загружает auth роуты
   * @returns {Array}
   */
  loadAuthRoutes() {
    try {
      return this.coreRoutesConfig.authRoutes.map(route =>
        this.transformRoute(route)
      )
    } catch (error) {
      logError('Ошибка загрузки auth роутов:', error)
      return []
    }
  }

  /**
   * Получает все базовые роуты (core + auth)
   * @returns {Array}
   */
  getAllCoreRoutes() {
    return [
      ...this.loadCoreRoutes(),
      ...this.loadAuthRoutes()
    ]
  }

  /**
   * Получает роут по имени
   * @param {string} routeName - имя роута
   * @returns {Object|undefined}
   */
  getCoreRouteByName(routeName) {
    const allRoutes = this.getAllCoreRoutes()
    return allRoutes.find(route => route.name === routeName)
  }

  /**
   * Получает все имена роутов
   * @returns {Array<string>}
   */
  getAllCoreRouteNames() {
    const allRoutes = this.getAllCoreRoutes()
    return allRoutes.map(route => route.name).filter(Boolean)
  }

  /**
   * Проверяет, является ли роут auth роутом
   * @param {string} routeName - имя роута
   * @returns {boolean}
   */
  isAuthRoute(routeName) {
    const authRoutes = this.loadAuthRoutes()
    return authRoutes.some(route => route.name === routeName)
  }
}

export default CoreRoutesManager

