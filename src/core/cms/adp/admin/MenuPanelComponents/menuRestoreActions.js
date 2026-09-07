/**
 * Восстановление меню из ядра и живых модулей; отмена через showUndoableSuccess.
 */

import { showUndoableSuccess } from '@/js/utils/toast.js'
import { tGlobal } from '@/i18n/index.js'
import { logError } from '@/js/utils/logError.js'
import {
  restoreMenuFromMigrations,
  undoRestoreMenu,
} from '@/core/cms/js/menuService.js'

/**
 * @param {{
 *   isRestoring: import('vue').Ref<boolean>,
 *   reloadMenuPanel: () => Promise<void>,
 *   toast: { success: Function, error: Function },
 * }} ctx
 */
export async function runRestoreMenuFromMigrations(ctx) {
  const { isRestoring, reloadMenuPanel, toast } = ctx
  if (isRestoring.value) {
    return
  }

  isRestoring.value = true
  try {
    const result = await restoreMenuFromMigrations()
    await reloadMenuPanel()
    const undoToken = result?.undo_token
    if (!undoToken) {
      toast.success(tGlobal('admin.menu.restored'))
      return
    }
    showUndoableSuccess(tGlobal('admin.menu.restored'), {
      onUndo: async () => {
        try {
          await undoRestoreMenu(undoToken)
          await reloadMenuPanel()
          toast.success(tGlobal('admin.menu.restoreUndone'))
        } catch (error) {
          logError('[MenuPanel] Undo restore menu error:', error)
          toast.error(error.message || tGlobal('admin.menu.restoreUndoError'))
          throw error
        }
      },
      undoAudit: {
        kind: 'menu.restore_from_migrations',
        label: tGlobal('admin.menu.undoRestoreKind'),
        entityType: 'menu',
        sourceModule: 'core.cms.adp',
      },
    })
  } catch (error) {
    logError('[MenuPanel] Restore menu error:', error)
    toast.error(error.message || tGlobal('admin.menu.restoreError'))
  } finally {
    isRestoring.value = false
  }
}
