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
  grabDX: number
  grabDY: number
  lastX: number
  lastY: number
  raf: number
}

export function initDragController(onDrop: (taskId: string, quadrant: QuadrantId) => void): void {
  let pending: PendingDrag | null = null
  let active: ActiveDrag | null = null
  let dropTarget: HTMLElement | null = null

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
      cleanup()
      if (quadrant) onDrop(taskId, quadrant)
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
    source.classList.add('dragging')

    active = {
      ...pending,
      ghost,
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
    active.ghost.style.transform = `translate(${x - active.grabDX}px, ${y - active.grabDY}px)`
  }

  function updateDropTarget(x: number, y: number): void {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>('.quadrant') ?? null
    if (el === dropTarget) return
    dropTarget?.classList.remove('drop-target')
    dropTarget = el
    dropTarget?.classList.add('drop-target')
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
    dropTarget = null
    active = null
  }
}
