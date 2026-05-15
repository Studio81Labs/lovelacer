<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { useI18n } from 'vue-i18n'
import EntityRow from './EntityRow.vue'
import RoomIconPicker from './RoomIconPicker.vue'
import { entityMatchesSearch, normalizeEntitySearch } from '../entity-search.js'
import { roomIdToIcon } from '../icons.js'
import type {
  AnalyzedRoom,
  EntityDiff,
  RoomDiffSummary,
  RoomDisplayOverride,
} from '../api/types.js'

const { t } = useI18n()

const props = defineProps<{
  rooms: AnalyzedRoom[]
  roomOrder?: string[] | undefined
  draftResetKey?: number | string | undefined
  diffByRoom?: Record<string, RoomDiffSummary>
  diffByEntityId?: Map<string, EntityDiff>
  roomOverrides?: Record<string, RoomDisplayOverride>
  /**
   * P2-7 — when true, EntityRow children render in read-only mode
   * (no override dropdowns, no hide toggles). Forwarded as-is.
   */
  readOnly?: boolean
}>()

const emit = defineEmits<{
  reorder: [roomIds: string[]]
  'save-room': [roomId: string, override: RoomDisplayOverride]
}>()

const searchQuery = ref('')
const editingRoomId = ref<string | null>(null)
const openRoomIds = ref(new Set<string>())
const editName = ref('')
const editIcon = ref('')
const editShowNameOnCard = ref(true)
const hasSearch = computed(() => normalizeEntitySearch(searchQuery.value) !== '')
const draggedRoomId = ref<string | null>(null)
const draftRoomOrder = ref<string[] | null>(null)
const dropCommitted = ref(false)
const activeRoomOrder = computed(() => draftRoomOrder.value ?? props.roomOrder ?? [])
const orderedRooms = computed(() => orderRooms(props.rooms, activeRoomOrder.value))
const filteredRooms = computed(() =>
  orderedRooms.value
    .map((room) => {
      const assignments = room.assignments.filter((a) =>
        entityMatchesSearch(searchQuery.value, a.entityId, entityIdToFriendly(a.entityId)),
      )

      return {
        ...room,
        assignments,
        entityCount: hasSearch.value ? assignments.length : room.entityCount,
      }
    })
    .filter((room) => !hasSearch.value || room.assignments.length > 0),
)
const canReorder = computed(
  () => !hasSearch.value && props.readOnly !== true && orderedRooms.value.length > 1,
)
type DropPlacement = 'before' | 'after'

watch(
  () => [props.roomOrder, props.draftResetKey] as const,
  () => {
    draftRoomOrder.value = null
  },
)

function orderRooms(rooms: AnalyzedRoom[], roomOrder: string[]): AnalyzedRoom[] {
  const preferred = new Map<string, number>()
  roomOrder.forEach((roomId, index) => {
    if (!preferred.has(roomId)) preferred.set(roomId, index)
  })

  return [...rooms].sort((a, b) => {
    const aIndex = preferred.get(a.id)
    const bIndex = preferred.get(b.id)

    if (aIndex !== undefined && bIndex !== undefined) return aIndex - bIndex
    if (aIndex !== undefined) return -1
    if (bIndex !== undefined) return 1
    return a.displayName.localeCompare(b.displayName)
  })
}

function openRoomEdit(room: AnalyzedRoom): void {
  const override = props.roomOverrides?.[room.id]
  editingRoomId.value = room.id
  openRoomIds.value = new Set([...openRoomIds.value, room.id])
  editName.value = override?.name ?? room.displayName
  editIcon.value = normalizeRoomIcon(override?.icon ?? room.icon, room.id)
  editShowNameOnCard.value = override?.showNameOnCard !== false
}

function saveRoomEdit(roomId: string): void {
  emit('save-room', roomId, {
    name: editName.value,
    icon: editIcon.value,
    showNameOnCard: editShowNameOnCard.value,
  })
  editingRoomId.value = null
}

function resetRoomEdit(roomId: string): void {
  emit('save-room', roomId, { name: '', icon: '', showNameOnCard: true })
  editingRoomId.value = null
}

function setRoomOpen(roomId: string, isOpen: boolean): void {
  const next = new Set(openRoomIds.value)
  if (isOpen) {
    next.add(roomId)
  } else {
    next.delete(roomId)
    if (editingRoomId.value === roomId) {
      editingRoomId.value = null
    }
  }
  openRoomIds.value = next
}

function onDragStart(roomId: string, event: DragEvent): void {
  if (!canReorder.value) {
    event.preventDefault()
    return
  }
  draggedRoomId.value = roomId
  dropCommitted.value = false
  event.dataTransfer?.setData('application/x-lovelacer-room-id', roomId)
  event.dataTransfer?.setData('text/plain', roomId)
  if (event.dataTransfer !== null) {
    event.dataTransfer.effectAllowed = 'move'
    const row = (event.currentTarget as HTMLElement | null)?.closest(
      '[data-testid="room-row"]',
    ) as HTMLElement | null
    if (row !== null && typeof event.dataTransfer.setDragImage === 'function') {
      const rect = row.getBoundingClientRect()
      event.dataTransfer.setDragImage(row, event.clientX - rect.left, event.clientY - rect.top)
    }
  }
}

function onDragOver(targetRoomId: string, event: DragEvent): void {
  if (!canReorder.value) return
  event.preventDefault()
  if (event.dataTransfer !== null) {
    event.dataTransfer.dropEffect = 'move'
  }

  const sourceRoomId = draggedRoomId.value ?? event.dataTransfer?.getData('text/plain') ?? ''
  if (sourceRoomId === '' || sourceRoomId === targetRoomId) return
  draftRoomOrder.value = moveRoom(
    orderedRooms.value,
    sourceRoomId,
    targetRoomId,
    getDropPlacement(event),
  )
}

function onDrop(targetRoomId: string, event: DragEvent): void {
  if (!canReorder.value) return
  event.preventDefault()
  const sourceRoomId = draggedRoomId.value ?? event.dataTransfer?.getData('text/plain') ?? ''
  draggedRoomId.value = null
  if (draftRoomOrder.value !== null) {
    dropCommitted.value = true
    emit('reorder', draftRoomOrder.value)
    return
  }
  if (sourceRoomId === targetRoomId) {
    draftRoomOrder.value = null
    return
  }
  if (sourceRoomId === '') return

  const next = moveRoom(orderedRooms.value, sourceRoomId, targetRoomId, getDropPlacement(event))
  if (next === null) return
  dropCommitted.value = true
  emit('reorder', next)
}

function onListDrop(event: DragEvent): void {
  event.preventDefault()
  draggedRoomId.value = null
  if (draftRoomOrder.value !== null) {
    dropCommitted.value = true
    emit('reorder', draftRoomOrder.value)
  }
}

function onDragEnd(): void {
  if (!dropCommitted.value) {
    draftRoomOrder.value = null
  }
  dropCommitted.value = false
  draggedRoomId.value = null
}

function getDropPlacement(event: DragEvent): DropPlacement {
  const row = (event.currentTarget as HTMLElement | null)?.closest(
    '[data-testid="room-row"]',
  ) as HTMLElement | null
  const rect = row?.getBoundingClientRect()
  if (rect === undefined || rect.height <= 0) return 'before'
  return event.clientY > rect.top + rect.height / 2 ? 'after' : 'before'
}

function moveRoom(
  rooms: AnalyzedRoom[],
  sourceRoomId: string,
  targetRoomId: string,
  placement: DropPlacement,
): string[] | null {
  const roomIds = rooms.map((room) => room.id)
  const sourceIndex = roomIds.indexOf(sourceRoomId)
  const targetIndex = roomIds.indexOf(targetRoomId)
  if (sourceIndex === -1 || targetIndex === -1) return null

  const next = [...roomIds]
  const [source] = next.splice(sourceIndex, 1)
  if (source === undefined) return null
  const adjustedTargetIndex = next.indexOf(targetRoomId)
  const insertIndex = placement === 'after' ? adjustedTargetIndex + 1 : adjustedTargetIndex
  next.splice(insertIndex, 0, source)
  return next
}

function confidencePillClass(confidence: number): string {
  if (confidence >= 0.8) return 'bg-forest-50 text-forest-700'
  if (confidence >= 0.5) return 'bg-amber-100 text-amber-700'
  return 'bg-danger-50 text-danger-700'
}

function confidenceLabel(confidence: number): string {
  return t('roomList.avgConfidence', { percent: Math.round(confidence * 100) })
}

function roomIconLabelId(roomId: string): string {
  return `room-icon-label-${roomId}`
}

function roomDisplayName(room: AnalyzedRoom): string {
  const overrideName = props.roomOverrides?.[room.id]?.name?.trim()
  return overrideName || room.displayName
}

function roomDisplayIcon(room: AnalyzedRoom): string {
  return normalizeRoomIcon(props.roomOverrides?.[room.id]?.icon ?? room.icon, room.id)
}

function normalizeRoomIcon(icon: string | undefined, roomId: string): string {
  return icon?.trim() || roomIdToIcon(roomId)
}

/**
 * `RoomAssignment` doesn't carry `friendlyName`. Until the API surfaces
 * it on assignments, derive a fallback from the entityId — readable
 * enough for the alpha demo.
 *   light.kitchen_ceiling → Kitchen Ceiling
 */
function entityIdToFriendly(entityId: string): string {
  const parts = entityId.split('.')
  if (parts.length < 2) return entityId
  const objectId = parts.slice(1).join('.')
  return objectId
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}
</script>

<template>
  <div
    v-if="rooms.length === 0"
    class="rounded border border-stone-200 bg-stone-50 p-6 text-sm text-stone-600"
  >
    {{ t('roomList.empty') }}
  </div>

  <div v-else class="space-y-2">
    <label class="block">
      <span class="sr-only">{{ t('sectionSearch.roomsLabel') }}</span>
      <input
        v-model="searchQuery"
        type="search"
        data-testid="section-search"
        :aria-label="t('sectionSearch.roomsLabel')"
        :placeholder="t('sectionSearch.roomsPlaceholder')"
        class="w-full rounded border border-stone-300 bg-white px-3 py-2 text-sm text-stone-800 placeholder:text-stone-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-100"
      />
    </label>

    <div
      v-if="hasSearch && filteredRooms.length === 0"
      class="rounded border border-stone-200 bg-stone-50 p-4 text-sm text-stone-600"
    >
      {{ t('sectionSearch.empty') }}
    </div>

    <ul
      v-else
      data-testid="room-list"
      class="divide-y divide-stone-100 rounded-lg border border-stone-200 bg-white"
      @dragover.prevent
      @drop="onListDrop"
    >
      <li
        v-for="room in filteredRooms"
        :key="room.id"
        data-testid="room-row"
        :class="{
          'bg-amber-50/50': draggedRoomId === room.id,
          'transition-colors': draggedRoomId !== null,
        }"
        @dragover="onDragOver(room.id, $event)"
        @drop.stop="onDrop(room.id, $event)"
      >
        <details
          class="group"
          :open="openRoomIds.has(room.id)"
          @toggle="setRoomOpen(room.id, ($event.currentTarget as HTMLDetailsElement).open)"
        >
          <summary
            class="flex cursor-pointer items-center justify-between gap-4 px-5 py-3 hover:bg-stone-50"
          >
            <div class="flex min-w-0 items-center gap-3">
              <button
                type="button"
                data-testid="room-drag-handle"
                :aria-label="t('roomList.dragHandle', { room: roomDisplayName(room) })"
                :title="t('roomList.dragHandle', { room: roomDisplayName(room) })"
                :disabled="!canReorder"
                :draggable="canReorder"
                class="cursor-grab rounded p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700 disabled:cursor-not-allowed disabled:opacity-40"
                @click.prevent.stop
                @dragstart.stop="onDragStart(room.id, $event)"
                @dragend="onDragEnd"
              >
                <Icon icon="mdi:drag-vertical" class="h-4 w-4" />
              </button>
              <Icon :icon="roomDisplayIcon(room)" class="h-5 w-5 text-stone-700" />
              <span data-testid="room-name" class="truncate text-sm font-medium text-stone-900">{{
                roomDisplayName(room)
              }}</span>
              <button
                v-if="readOnly !== true && openRoomIds.has(room.id)"
                type="button"
                data-testid="room-edit-button"
                :aria-label="t('roomList.editRoom', { room: roomDisplayName(room) })"
                :title="t('roomList.editRoom', { room: roomDisplayName(room) })"
                class="rounded p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
                @click.prevent.stop="openRoomEdit(room)"
              >
                <Icon icon="mdi:pencil" class="h-4 w-4" />
              </button>
            </div>

            <div class="flex items-center gap-3 text-xs text-stone-600">
              <span>{{
                t('roomList.entities', { count: room.entityCount }, room.entityCount)
              }}</span>
              <template v-if="(diffByRoom ?? {})[room.id]">
                <span
                  v-if="(diffByRoom ?? {})[room.id]!.added > 0"
                  data-testid="room-diff-added"
                  class="rounded bg-forest-50 px-2 py-0.5 text-xs font-medium text-forest-700"
                  >{{
                    t('roomList.diffAdded', { count: (diffByRoom ?? {})[room.id]!.added })
                  }}</span
                >
                <span
                  v-if="(diffByRoom ?? {})[room.id]!.movedOut > 0"
                  data-testid="room-diff-moved-out"
                  class="rounded bg-stone-200 px-2 py-0.5 text-xs font-medium text-stone-700"
                  >{{
                    t('roomList.diffMovedOut', {
                      count: (diffByRoom ?? {})[room.id]!.movedOut,
                    })
                  }}</span
                >
              </template>
              <span
                data-testid="confidence-pill"
                class="rounded px-2 py-0.5 text-xs font-medium"
                :class="confidencePillClass(room.averageConfidence)"
              >
                {{ confidenceLabel(room.averageConfidence) }}
              </span>
            </div>
          </summary>

          <div
            v-if="editingRoomId === room.id"
            class="grid gap-3 border-t border-stone-100 bg-stone-50 px-5 py-4 sm:grid-cols-[1fr_14rem_auto_auto]"
          >
            <label class="block min-w-0">
              <span class="mb-1 block text-xs font-medium text-stone-600">{{
                t('roomList.nameLabel')
              }}</span>
              <input
                v-model="editName"
                data-testid="room-name-input"
                class="w-full rounded border border-stone-300 bg-white px-3 py-2 text-sm text-stone-800 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-100"
              />
            </label>
            <div class="block min-w-0">
              <span
                :id="roomIconLabelId(room.id)"
                class="mb-1 block text-xs font-medium text-stone-600"
              >
                {{ t('roomList.iconLabel') }}
              </span>
              <RoomIconPicker v-model="editIcon" :labelled-by="roomIconLabelId(room.id)" />
            </div>
            <label class="flex items-center gap-2 self-end pb-2 text-sm text-stone-700">
              <input
                v-model="editShowNameOnCard"
                data-testid="room-show-name-toggle"
                type="checkbox"
              />
              <span>{{ t('roomList.showNameOnCard') }}</span>
            </label>
            <div class="flex items-end gap-2">
              <button
                type="button"
                data-testid="room-reset-button"
                class="rounded border border-stone-300 bg-white px-3 py-2 text-xs font-medium text-stone-700 hover:bg-stone-100"
                @click="resetRoomEdit(room.id)"
              >
                {{ t('roomList.reset') }}
              </button>
              <button
                type="button"
                data-testid="room-save-button"
                class="rounded bg-stone-900 px-3 py-2 text-xs font-medium text-white hover:bg-stone-700"
                @click="saveRoomEdit(room.id)"
              >
                {{ t('roomList.save') }}
              </button>
            </div>
          </div>

          <ul class="divide-y divide-stone-100 border-t border-stone-100 bg-stone-50/30">
            <li
              v-for="a in room.assignments"
              :key="a.entityId"
              data-testid="room-entity-list-row"
              class="odd:bg-white even:bg-stone-50/25 hover:bg-amber-50/10 transition-colors"
            >
              <EntityRow
                :entity-id="a.entityId"
                :friendly-name="entityIdToFriendly(a.entityId)"
                :room-id="a.roomId"
                :read-only="readOnly ?? false"
                v-bind="{
                  ...(a.manual !== undefined ? { manual: a.manual } : {}),
                  ...((diffByEntityId ?? new Map()).has(a.entityId)
                    ? { diff: (diffByEntityId ?? new Map()).get(a.entityId) }
                    : {}),
                }"
              />
            </li>
          </ul>
        </details>
      </li>
    </ul>
  </div>
</template>
