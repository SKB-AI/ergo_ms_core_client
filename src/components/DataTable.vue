<template>
  <div class="data-table">
    <div v-if="useCards" class="data-table-cards">
      <div v-if="sortableColumns.length" class="data-table-cards__sort" role="toolbar" :aria-label="t('components.dataTable.sortToolbar')">
        <button v-for="column in sortableColumns" :key="column.key" type="button" class="data-table-sort data-table-sort--chip" :class="{ 'data-table-sort--active': isSortedColumn(column) }" :aria-label="t('components.dataTable.sortColumn', { column: column.label })" :aria-pressed="isSortedColumn(column)" @click="handleSort(column)">
          <span>{{ column.label }}</span>
          <component :is="sortIcon(column)" :size="14" aria-hidden="true" />
        </button>
      </div>
      <div v-if="!displayItems.length" class="data-table-cards__empty">
        <slot name="empty">{{ resolvedEmptyText }}</slot>
      </div>
      <article v-for="(item, idx) in displayItems" v-else :key="getItemKey(item, idx)" class="data-table-card" :class="[getRowClass(item, idx), { 'data-table-card--clickable': clickable }]" @click="handleRowClick(item, idx)">
        <div v-if="showNumberColumn" class="data-table-card__meta text-muted">
          № {{ displayNumberOffset + idx + 1 }}
        </div>
        <div v-for="column in cardBodyColumns" :key="column.key" class="data-table-card__row">
          <div v-if="column.label" class="data-table-card__label">{{ column.label }}</div>
          <div class="data-table-card__value" :class="column.cellClass">
            <slot :name="`cell-${column.key}`" :item="item" :index="idx" :column="column">
              {{ getCellValue(item, column) }}
            </slot>
          </div>
        </div>
        <div v-if="actionsColumn" class="data-table-card__actions" @click.stop>
          <slot :name="`cell-${actionsColumn.key}`" :item="item" :index="idx" :column="actionsColumn">
            {{ getCellValue(item, actionsColumn) }}
          </slot>
        </div>
      </article>
    </div>

    <div v-else class="table-responsive">
      <table class="table table-hover align-middle mb-0" :class="tableClass">
        <thead class="data-table-header">
          <tr>
            <th v-if="showNumberColumn" style="width: 50px;">№</th>
            <th v-for="column in visibleColumns" :key="column.key" :class="[column.headerClass, { 'data-table-header--sortable': column.sortable }]" :style="column.headerStyle" :aria-sort="ariaSort(column)">
              <button v-if="column.sortable" type="button" class="data-table-sort" :class="{ 'data-table-sort--active': isSortedColumn(column) }" :aria-label="t('components.dataTable.sortColumn', { column: column.label })" @click="handleSort(column)">
                <span>{{ column.label }}</span>
                <component :is="sortIcon(column)" :size="14" aria-hidden="true"/>
              </button>
              <template v-else>{{ column.label }}</template>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!displayItems.length" class="data-table-empty-row">
            <td :colspan="totalColumnCount" class="data-table-empty-cell">
              <slot name="empty">{{ resolvedEmptyText }}</slot>
            </td>
          </tr>
          <tr v-for="(item, idx) in displayItems" v-else :key="getItemKey(item, idx)" :class="getRowClass(item, idx)" @click="handleRowClick(item, idx)">
            <td v-if="showNumberColumn" class="text-muted">{{ displayNumberOffset + idx + 1 }}</td>
            <td v-for="column in visibleColumns" :key="column.key" :class="column.cellClass" :style="column.cellStyle">
              <slot :name="`cell-${column.key}`" :item="item" :index="idx" :column="column">
                {{ getCellValue(item, column) }}
              </slot>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <Pagination v-if="enablePagination" :model-value="currentPage" :total-pages="totalPages" :total-items="paginationTotalItems" :page-size="itemsPerPage" :visible-count="displayItems.length" :variant="paginationVariant" layout="toolbar" :has-next-page="paginationHasNext" :has-previous-page="paginationHasPrevious" @update:model-value="handlePageChange"/>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { ArrowUpDown, ChevronDown, ChevronUp } from '@lucide/vue'
import Pagination from '@/components/Pagination.vue'
import { BREAKPOINTS, useBreakpoint } from '@/composables/useBreakpoint.js'
import { useAppI18n } from '@/i18n/useAppI18n.js'

const { t } = useAppI18n()

const props = defineProps({
  items: {
    type: Array,
    required: true,
    default: () => []
  },
  columns: {
    type: Array,
    required: true,
    default: () => []
  },
  showNumberColumn: {
    type: Boolean,
    default: true
  },
  numberOffset: {
    type: Number,
    default: 0
  },
  tableClass: {
    type: String,
    default: ''
  },
  rowClass: {
    type: [String, Function],
    default: ''
  },
  clickable: {
    type: Boolean,
    default: false
  },
  getItemKey: {
    type: Function,
    default: (item, index) => item?.id ?? index
  },
  // Пагинация
  enablePagination: {
    type: Boolean,
    default: false
  },
  currentPage: {
    type: Number,
    default: 1
  },
  itemsPerPage: {
    type: Number,
    default: 10
  },
  totalItems: {
    type: Number,
    default: null
  },
  /** Серверная пагинация: has_next / has_previous; при totalItems — полный блок страниц */
  hasNextPage: {
    type: Boolean,
    default: null,
  },
  hasPreviousPage: {
    type: Boolean,
    default: null,
  },
  emptyText: {
    type: String,
    default: undefined,
  },
  /**
   * Брейкпоинт, ниже которого таблица становится карточками.
   * 'sm' | 'md' | 'lg' | 'xl' | 'xxl' | 'never'
   */
  cardsBelow: {
    type: String,
    default: 'sm',
    validator: (value) => ['sm', 'md', 'lg', 'xl', 'xxl', 'never', ''].includes(value),
  },
  sortKey: {
    type: String,
    default: '',
  },
  sortDirection: {
    type: String,
    default: 'asc',
    validator: (value) => ['asc', 'desc'].includes(value),
  },
})

const emit = defineEmits(['rowClick', 'update:currentPage', 'pageChange', 'update:sortKey', 'update:sortDirection'])

const resolvedEmptyText = computed(
  () => props.emptyText ?? t('components.dataTable.noData'),
)

const { width, isSmUp } = useBreakpoint()

function isColumnVisible(column) {
  if (column.hideOnCompact === true && width.value < BREAKPOINTS.md) {
    return false
  }
  const hideBelow = column.hideBelow
  if (!hideBelow) {
    return true
  }
  const minWidth = BREAKPOINTS[hideBelow]
  if (minWidth == null) {
    return true
  }
  return width.value >= minWidth
}

const visibleColumns = computed(() => props.columns.filter(isColumnVisible))

const useCards = computed(() => {
  if (!props.cardsBelow || props.cardsBelow === 'never') {
    return false
  }
  const minWidth = BREAKPOINTS[props.cardsBelow]
  if (minWidth == null) {
    return false
  }
  return width.value < minWidth
})

function isActionsColumn(column) {
  return column.key === 'actions' || column.cardRole === 'actions'
}

const actionsColumn = computed(() =>
  visibleColumns.value.find(isActionsColumn) || null,
)

const cardBodyColumns = computed(() =>
  visibleColumns.value.filter((column) => !isActionsColumn(column)),
)

const sortableColumns = computed(() =>
  visibleColumns.value.filter((column) => column.sortable),
)

function isSortedColumn(column) {
  return Boolean(column?.sortable && column.key && props.sortKey === column.key)
}

function ariaSort(column) {
  if (!column?.sortable) {
    return undefined
  }
  if (!isSortedColumn(column)) {
    return 'none'
  }
  return props.sortDirection === 'desc' ? 'descending' : 'ascending'
}

function sortIcon(column) {
  if (!isSortedColumn(column)) {
    return ArrowUpDown
  }
  return props.sortDirection === 'desc' ? ChevronDown : ChevronUp
}

function handleSort(column) {
  if (!column?.sortable || !column.key) {
    return
  }
  if (props.sortKey === column.key) {
    emit('update:sortDirection', props.sortDirection === 'asc' ? 'desc' : 'asc')
    return
  }
  emit('update:sortKey', column.key)
  emit('update:sortDirection', 'asc')
}

function getCellValue(item, column) {
  if (column.value) {
    return typeof column.value === 'function' ? column.value(item) : item[column.value]
  }
  return item[column.key] ?? ''
}

function getRowClass(item, idx) {
  const classes = []
  
  if (props.clickable) {
    classes.push('table-row-click')
  }
  
  if (typeof props.rowClass === 'function') {
    const customClass = props.rowClass(item, idx)
    if (customClass) classes.push(customClass)
  } else if (props.rowClass) {
    classes.push(props.rowClass)
  }
  
  return classes.join(' ')
}

function handleRowClick(item, idx) {
  if (props.clickable) {
    emit('rowClick', item, idx)
  }
}

function handlePageChange(page) {
  emit('update:currentPage', page)
  emit('pageChange', page)
}

// Пагинация
const useServerPagination = computed(
  () => props.hasNextPage !== null && props.hasPreviousPage !== null,
)

const hasKnownTotal = computed(
  () => props.totalItems !== null && props.totalItems >= 0,
)

const useSimpleServerPagination = computed(
  () => useServerPagination.value && !hasKnownTotal.value,
)

const totalItemsCount = computed(() => {
  if (props.totalItems !== null) {
    return props.totalItems
  }
  return props.items.length
})

const totalColumnCount = computed(() => {
  return visibleColumns.value.length + (props.showNumberColumn ? 1 : 0)
})

const totalPages = computed(() => {
  return Math.max(1, Math.ceil(totalItemsCount.value / props.itemsPerPage) || 1)
})

const paginationVariant = computed(() => {
  if (useSimpleServerPagination.value) {
    return 'simple'
  }
  // На узком экране полный блок страниц слишком плотный
  if (!isSmUp.value) {
    return 'simple'
  }
  return 'full'
})

const paginationTotalItems = computed(() =>
  useSimpleServerPagination.value ? null : totalItemsCount.value,
)

const paginationHasNext = computed(() =>
  useSimpleServerPagination.value ? props.hasNextPage : null,
)

const paginationHasPrevious = computed(() =>
  useSimpleServerPagination.value ? props.hasPreviousPage : null,
)

const displayItems = computed(() => {
  if (!props.enablePagination) {
    return props.items
  }
  if (props.totalItems !== null || useServerPagination.value) {
    return props.items
  }
  const start = (props.currentPage - 1) * props.itemsPerPage
  const end = start + props.itemsPerPage
  return props.items.slice(start, end)
})

const displayNumberOffset = computed(() => {
  // При enablePagination смещение уже из currentPage — numberOffset не добавляем
  // (иначе серверные списки, передающие оба, получают удвоенные №).
  if (props.enablePagination) {
    return (props.currentPage - 1) * props.itemsPerPage
  }
  return props.numberOffset
})
</script>

<style lang="scss" scoped>
.data-table-header {
  background-color: var(--color-secondary-background);
}

.data-table-header--sortable {
  white-space: nowrap;
}

.data-table-sort {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  max-width: 100%;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  font-weight: inherit;
  letter-spacing: inherit;
  text-transform: inherit;
  text-align: inherit;
  cursor: pointer;

  &:hover,
  &:focus-visible {
    color: var(--color-accent, var(--ui-text));
  }

  svg {
    flex-shrink: 0;
    opacity: 0.55;
  }

  &--active svg {
    opacity: 1;
  }
}

.data-table-sort--chip {
  padding: 0.25rem 0.6rem;
  border: 1px solid var(--color-border, var(--ui-border));
  border-radius: 999px;
  background: var(--color-primary-background, var(--ui-surface));
  color: var(--color-primary-text, var(--ui-text));
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.03em;
  text-transform: uppercase;

  &[aria-pressed='true'] {
    border-color: var(--color-accent, var(--ui-border));
    color: var(--color-accent, var(--ui-text));
  }
}

.data-table-cards__sort {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
}

.table-row-click {
  cursor: pointer;
  
  &:hover {
    background-color: var(--color-hover-background);
  }
}

.data-table-empty-cell {
  padding: 2.5rem 1rem;
  text-align: center;
  color: var(--color-secondary-text);
}

.data-table-cards {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.data-table-cards__empty {
  padding: 2rem 1rem;
  text-align: center;
  color: var(--color-secondary-text);
  border: 1px solid var(--color-border);
  border-radius: 0.75rem;
  background: var(--color-primary-background);
}

.data-table-card {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  padding: 0.875rem 1rem;
  border: 1px solid var(--color-border);
  border-radius: 0.75rem;
  background: var(--color-primary-background);

  &--clickable {
    cursor: pointer;

    &:hover {
      background: var(--color-hover-background);
    }
  }
}

.data-table-card__meta {
  font-size: 0.75rem;
}

.data-table-card__row {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  min-width: 0;
}

.data-table-card__label {
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  color: var(--color-secondary-text);
}

.data-table-card__value {
  min-width: 0;
  font-size: 0.9375rem;
  color: var(--color-primary-text);
  word-break: break-word;
}

.data-table-card__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 0.35rem;
  padding-top: 0.35rem;
  border-top: 1px solid var(--color-border);

  :deep(.actions-cell) {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 0.35rem;
    width: 100%;
  }
}

@media (width < $ui-bp-md) {
  .table-responsive {
    font-size: 0.875rem;
  }
}
</style>
