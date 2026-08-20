import type { Board, QuadrantId, Task } from './types'

const STORAGE_KEY = 'todo-matrix.state.v2'
const LEGACY_TASKS_KEY = 'todo-matrix.tasks.v1'

interface State {
  boards: Board[]
  tasks: Task[]
  activeBoardId: string
}

type Listener = () => void

const QUADRANT_IDS: ReadonlySet<string> = new Set(['do', 'schedule', 'delegate', 'eliminate'])

export function dateBoardName(date = new Date()): string {
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function isBoard(value: unknown): value is Board {
  if (typeof value !== 'object' || value === null) return false
  const b = value as Record<string, unknown>
  return typeof b.id === 'string' && typeof b.name === 'string' && typeof b.createdAt === 'number'
}

function isTask(value: unknown): value is Task {
  if (typeof value !== 'object' || value === null) return false
  const t = value as Record<string, unknown>
  return (
    typeof t.id === 'string' &&
    typeof t.boardId === 'string' &&
    typeof t.text === 'string' &&
    typeof t.done === 'boolean' &&
    typeof t.createdAt === 'number' &&
    // order is backfilled for tasks saved before manual ordering existed
    (typeof t.order === 'number' || t.order === undefined) &&
    typeof t.quadrant === 'string' &&
    QUADRANT_IDS.has(t.quadrant)
  )
}

function normalizeOrders(tasks: Task[]): void {
  const groups = new Map<string, Task[]>()
  for (const t of tasks) {
    const key = `${t.boardId}\n${t.quadrant}`
    const group = groups.get(key)
    if (group) group.push(t)
    else groups.set(key, [t])
  }
  for (const group of groups.values()) {
    if (group.some((t) => typeof t.order !== 'number')) {
      group.sort((a, b) => Number(a.done) - Number(b.done) || b.createdAt - a.createdAt)
    } else {
      group.sort((a, b) => a.order - b.order)
    }
    group.forEach((t, i) => (t.order = i))
  }
}

function newBoard(name: string): Board {
  return { id: crypto.randomUUID(), name, createdAt: Date.now() }
}

function load(): State {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<State>
      const boards = Array.isArray(parsed.boards) ? parsed.boards.filter(isBoard) : []
      if (boards.length > 0) {
        const boardIds = new Set(boards.map((b) => b.id))
        const tasks = (Array.isArray(parsed.tasks) ? parsed.tasks.filter(isTask) : []).filter((t) =>
          boardIds.has(t.boardId),
        )
        const activeBoardId =
          typeof parsed.activeBoardId === 'string' && boardIds.has(parsed.activeBoardId)
            ? parsed.activeBoardId
            : boards[0].id
        normalizeOrders(tasks)
        return { boards, tasks, activeBoardId }
      }
    }
  } catch {
    // fall through to migration / fresh state
  }

  // Migrate single-board v1 data if present.
  const board = newBoard(dateBoardName())
  let tasks: Task[] = []
  try {
    const legacy = localStorage.getItem(LEGACY_TASKS_KEY)
    if (legacy) {
      const parsed = JSON.parse(legacy)
      if (Array.isArray(parsed)) {
        tasks = parsed
          .map((t) => ({ ...t, boardId: board.id }))
          .filter(isTask)
      }
      localStorage.removeItem(LEGACY_TASKS_KEY)
    }
  } catch {
    // ignore unreadable legacy data
  }
  normalizeOrders(tasks)
  return { boards: [board], tasks, activeBoardId: board.id }
}

export class TaskStore {
  private state: State = load()
  private listeners = new Set<Listener>()

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    listener()
    return () => this.listeners.delete(listener)
  }

  // --- boards ---------------------------------------------------------------

  get boards(): Board[] {
    return [...this.state.boards].sort((a, b) => a.createdAt - b.createdAt)
  }

  get activeBoardId(): string {
    return this.state.activeBoardId
  }

  get activeBoard(): Board {
    return this.state.boards.find((b) => b.id === this.state.activeBoardId) ?? this.state.boards[0]
  }

  addBoard(): Board {
    const base = dateBoardName()
    const names = new Set(this.state.boards.map((b) => b.name))
    let name = base
    for (let n = 2; names.has(name); n++) name = `${base} (${n})`
    const board = newBoard(name)
    this.state.boards.push(board)
    this.state.activeBoardId = board.id
    this.commit()
    return board
  }

  renameBoard(id: string, name: string): void {
    const board = this.state.boards.find((b) => b.id === id)
    const trimmed = name.trim()
    if (!board || !trimmed || board.name === trimmed) return
    board.name = trimmed
    this.commit()
  }

  removeBoard(id: string): void {
    if (!this.state.boards.some((b) => b.id === id)) return
    this.state.boards = this.state.boards.filter((b) => b.id !== id)
    this.state.tasks = this.state.tasks.filter((t) => t.boardId !== id)
    if (this.state.boards.length === 0) this.state.boards.push(newBoard(dateBoardName()))
    if (!this.state.boards.some((b) => b.id === this.state.activeBoardId)) {
      this.state.activeBoardId = this.boards[this.boards.length - 1].id
    }
    this.commit()
  }

  setActiveBoard(id: string): void {
    if (id === this.state.activeBoardId || !this.state.boards.some((b) => b.id === id)) return
    this.state.activeBoardId = id
    this.commit()
  }

  taskCount(boardId: string): number {
    return this.state.tasks.filter((t) => t.boardId === boardId).length
  }

  // --- tasks (scoped to the active board) ------------------------------------

  getByQuadrant(quadrant: QuadrantId): Task[] {
    return this.state.tasks
      .filter((t) => t.boardId === this.state.activeBoardId && t.quadrant === quadrant)
      .sort((a, b) => a.order - b.order)
  }

  add(text: string, quadrant: QuadrantId): void {
    const trimmed = text.trim()
    if (!trimmed) return
    const group = this.getByQuadrant(quadrant)
    this.state.tasks.push({
      id: crypto.randomUUID(),
      boardId: this.state.activeBoardId,
      text: trimmed,
      quadrant,
      done: false,
      createdAt: Date.now(),
      order: (group[0]?.order ?? 1) - 1,
    })
    this.commit()
  }

  toggle(id: string): void {
    const task = this.state.tasks.find((t) => t.id === id)
    if (!task) return
    task.done = !task.done
    this.commit()
  }

  /**
   * Move a task into a quadrant at a specific position.
   * `beforeId` is the task it should land in front of; null appends to the end.
   * Works both across quadrants and for reordering within one.
   */
  move(id: string, quadrant: QuadrantId, beforeId: string | null = null): void {
    const task = this.state.tasks.find((t) => t.id === id)
    if (!task || beforeId === id) return

    const target = this.state.tasks
      .filter((t) => t.boardId === task.boardId && t.quadrant === quadrant && t.id !== id)
      .sort((a, b) => a.order - b.order)

    let index = beforeId ? target.findIndex((t) => t.id === beforeId) : target.length
    if (index === -1) index = target.length
    target.splice(index, 0, task)

    if (task.quadrant === quadrant && target.every((t, i) => t.order === i)) return
    task.quadrant = quadrant
    target.forEach((t, i) => (t.order = i))
    this.commit()
  }

  remove(id: string): void {
    this.state.tasks = this.state.tasks.filter((t) => t.id !== id)
    this.commit()
  }

  clearCompleted(): number {
    const before = this.state.tasks.length
    this.state.tasks = this.state.tasks.filter((t) => t.boardId !== this.state.activeBoardId || !t.done)
    if (this.state.tasks.length !== before) this.commit()
    return before - this.state.tasks.length
  }

  get completedCount(): number {
    return this.state.tasks.filter((t) => t.boardId === this.state.activeBoardId && t.done).length
  }

  private commit(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state))
    } catch {
      // Storage full or unavailable — keep the in-memory state working.
    }
    for (const listener of this.listeners) listener()
  }
}
