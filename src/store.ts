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
    typeof t.quadrant === 'string' &&
    QUADRANT_IDS.has(t.quadrant)
  )
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
      .sort((a, b) => Number(a.done) - Number(b.done) || b.createdAt - a.createdAt)
  }

  add(text: string, quadrant: QuadrantId): void {
    const trimmed = text.trim()
    if (!trimmed) return
    this.state.tasks.push({
      id: crypto.randomUUID(),
      boardId: this.state.activeBoardId,
      text: trimmed,
      quadrant,
      done: false,
      createdAt: Date.now(),
    })
    this.commit()
  }

  toggle(id: string): void {
    const task = this.state.tasks.find((t) => t.id === id)
    if (!task) return
    task.done = !task.done
    this.commit()
  }

  move(id: string, quadrant: QuadrantId): void {
    const task = this.state.tasks.find((t) => t.id === id)
    if (!task || task.quadrant === quadrant) return
    task.quadrant = quadrant
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
