import type { QuadrantId } from './types'

// Pointer-based drag & drop that works with mouse and touch alike.
// Drags start immediately from the ⠿ handle (which has touch-action: none),
// or from anywhere on a task after a small movement threshold for mouse users.

const MOUSE_DRAG_THRESHOLD = 5
const EDGE_SCROLL_ZONE = 70
const EDGE_SCROLL_MAX_SPEED = 14

interface PendingDrag {
  taskId: string
  source: HTMLElement
  pointerId: number
  startX: number
  startY: number
}

interface ActiveDrag extends PendingDrag {
  ghost: HTMLElement
  sourceHeight: number
  grabDX: number
  grabDY: number
  lastX: number
  lastY: number
  raf: number
}

export function initDragController(
  onDrop: (taskId: string, quadrant: QuadrantId, beforeId: string | null) => void,
): void {
  let pending: PendingDrag | null = null
  let active: ActiveDrag | null = null
  let dropTarget: HTMLElement | null = null
  let beforeId: string | null = null

  // A card-sized slot that the surrounding tasks part around, showing
  // exactly where the dragged card will land.
  const placeholder = document.createElement('li')
  placeholder.className = 'drop-placeholder'

  // Quadrant heights are frozen while dragging: if they resized as the
  // placeholder moved, the page would reflow under the pointer and the
  // drop target would oscillate.
  let lockedQuadrants: HTMLElement[] = []

  document.addEventListener('pointerdown', (e) => {
    if (active || pending || e.button !== 0) return
    const target = e.target as Element
    const task = target.closest<HTMLElement>('.task')
    if (!task || !task.dataset.id) return

    if (target.closest('.drag-handle')) {
      e.preventDefault()
      pending = { taskId: task.dataset.id, source: task, pointerId: e.pointerId, startX: e.clientX, startY: e.clientY }
      start(e)
    } else if (e.pointerType === 'mouse' && !target.closest('button, input, a, label')) {
      pending = { taskId: task.dataset.id, source: task, pointerId: e.pointerId, startX: e.clientX, startY: e.clientY }
    }
  })

  document.addEventListener('pointermove', (e) => {
    if (pending && !active && e.pointerId === pending.pointerId) {
      if (Math.hypot(e.clientX - pending.startX, e.clientY - pending.startY) >= MOUSE_DRAG_THRESHOLD) start(e)
      return
    }
    if (active && e.pointerId === active.pointerId) {
      active.lastX = e.clientX
      active.lastY = e.clientY
      positionGhost(e.clientX, e.clientY)
      updateDropTarget(e.clientX, e.clientY)
    }
  })

  document.addEventListener('pointerup', (e) => {
    if (active && e.pointerId === active.pointerId) {
      const quadrant = dropTarget?.dataset.quadrant as QuadrantId | undefined
      const taskId = active.taskId
      const before = beforeId
      cleanup()
      if (quadrant) onDrop(taskId, quadrant, before)
    }
    pending = null
  })

  document.addEventListener('pointercancel', (e) => {
    if (active && e.pointerId === active.pointerId) cleanup()
    pending = null
  })

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && active) cleanup()
  })

  function start(e: PointerEvent): void {
    if (!pending) return
    const source = pending.source
    const rect = source.getBoundingClientRect()
    const ghost = source.cloneNode(true) as HTMLElement
    ghost.classList.add('drag-ghost')
    ghost.style.width = `${rect.width}px`
    document.body.append(ghost)
    document.body.classList.add('is-dragging')

    lockedQuadrants = [...document.querySelectorAll<HTMLElement>('.quadrant')]
    for (const q of lockedQuadrants) q.style.height = `${q.getBoundingClientRect().height}px`

    // The placeholder takes the card's slot in the list; the card itself is
    // hidden so only the ghost under the pointer represents it.
    placeholder.style.height = `${rect.height}px`
    source.parentElement?.insertBefore(placeholder, source.nextSibling)
    source.classList.add('dragging')

    active = {
      ...pending,
      ghost,
      sourceHeight: rect.height,
      grabDX: e.clientX - rect.left,
      grabDY: e.clientY - rect.top,
      lastX: e.clientX,
      lastY: e.clientY,
      raf: 0,
    }
    pending = null
    positionGhost(e.clientX, e.clientY)
    updateDropTarget(e.clientX, e.clientY)
    active.raf = requestAnimationFrame(edgeScroll)
  }

  function positionGhost(x: number, y: number): void {
    if (!active) return
    active.ghost.style.transform = `translate(${x - active.grabDX}px, ${y - active.grabDY}px) rotate(2deg)`
  }

  function updateDropTarget(x: number, y: number): void {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>('.quadrant') ?? null
    if (el !== dropTarget) {
      dropTarget?.classList.remove('drop-target')
      dropTarget = el
      dropTarget?.classList.add('drop-target')
    }
    updateInsertionPoint(y)
  }

  // Place the slot between the tasks whose midpoints straddle the pointer,
  // and remember which task the drop should land in front of.
  function updateInsertionPoint(y: number): void {
    if (!dropTarget || !active) {
      placeholder.remove()
      beforeId = null
      return
    }
    const list = dropTarget.querySelector<HTMLElement>('[data-tasks]')!
    const items = [...list.querySelectorAll<HTMLElement>(':scope > .task:not(.dragging)')]
    const beforeEl = items.find((item) => {
      const r = item.getBoundingClientRect()
      return y < r.top + r.height / 2
    })
    beforeId = beforeEl?.dataset.id ?? null

    const inPlace =
      placeholder.parentElement === list &&
      (beforeEl ? placeholder.nextElementSibling === beforeEl : list.lastElementChild === placeholder)
    if (inPlace) return

    if (beforeEl) list.insertBefore(placeholder, beforeEl)
    else list.append(placeholder)

    // Grow the slot from 0 so neighboring cards slide apart instead of jumping.
    placeholder.style.height = '0px'
    placeholder.getBoundingClientRect()
    placeholder.style.height = `${active.sourceHeight}px`
  }

  // Scroll the page while dragging near the viewport edges, so tasks can
  // travel between quadrants that don't fit on screen together (mobile).
  function edgeScroll(): void {
    if (!active) return
    const y = active.lastY
    const h = document.documentElement.clientHeight
    let dy = 0
    if (y < EDGE_SCROLL_ZONE) dy = -Math.ceil(((EDGE_SCROLL_ZONE - y) / EDGE_SCROLL_ZONE) * EDGE_SCROLL_MAX_SPEED)
    else if (y > h - EDGE_SCROLL_ZONE)
      dy = Math.ceil(((y - (h - EDGE_SCROLL_ZONE)) / EDGE_SCROLL_ZONE) * EDGE_SCROLL_MAX_SPEED)
    if (dy !== 0) {
      window.scrollBy(0, dy)
      updateDropTarget(active.lastX, active.lastY)
    }
    active.raf = requestAnimationFrame(edgeScroll)
  }

  function cleanup(): void {
    if (!active) return
    cancelAnimationFrame(active.raf)
    active.ghost.remove()
    active.source.classList.remove('dragging')
    document.body.classList.remove('is-dragging')
    dropTarget?.classList.remove('drop-target')
    placeholder.remove()
    for (const q of lockedQuadrants) q.style.height = ''
    lockedQuadrants = []
    dropTarget = null
    beforeId = null
    active = null
  }
}
