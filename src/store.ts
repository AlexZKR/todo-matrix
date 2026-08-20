import type { QuadrantId, Task } from './types'

const STORAGE_KEY = 'todo-matrix.tasks.v1'

type Listener = (tasks: Task[]) => void

function load(): Task[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isTask)
  } catch {
    return []
  }
}

function isTask(value: unknown): value is Task {
  if (typeof value !== 'object' || value === null) return false
  const t = value as Record<string, unknown>
  return (
    typeof t.id === 'string' &&
    typeof t.text === 'string' &&
    typeof t.done === 'boolean' &&
    typeof t.createdAt === 'number' &&
    (t.quadrant === 'do' || t.quadrant === 'schedule' || t.quadrant === 'delegate' || t.quadrant === 'eliminate')
  )
}

export class TaskStore {
  private tasks: Task[] = load()
  private listeners = new Set<Listener>()

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    listener(this.tasks)
    return () => this.listeners.delete(listener)
  }

  getByQuadrant(quadrant: QuadrantId): Task[] {
    return this.tasks
      .filter((t) => t.quadrant === quadrant)
      .sort((a, b) => Number(a.done) - Number(b.done) || b.createdAt - a.createdAt)
  }

  add(text: string, quadrant: QuadrantId): void {
    const trimmed = text.trim()
    if (!trimmed) return
    this.tasks.push({
      id: crypto.randomUUID(),
      text: trimmed,
      quadrant,
      done: false,
      createdAt: Date.now(),
    })
    this.commit()
  }

  toggle(id: string): void {
    const task = this.tasks.find((t) => t.id === id)
    if (!task) return
    task.done = !task.done
    this.commit()
  }

  move(id: string, quadrant: QuadrantId): void {
    const task = this.tasks.find((t) => t.id === id)
    if (!task || task.quadrant === quadrant) return
    task.quadrant = quadrant
    this.commit()
  }

  remove(id: string): void {
    this.tasks = this.tasks.filter((t) => t.id !== id)
    this.commit()
  }

  clearCompleted(): number {
    const before = this.tasks.length
    this.tasks = this.tasks.filter((t) => !t.done)
    if (this.tasks.length !== before) this.commit()
    return before - this.tasks.length
  }

  get completedCount(): number {
    return this.tasks.filter((t) => t.done).length
  }

  private commit(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.tasks))
    } catch {
      // Storage full or unavailable — keep the in-memory state working.
    }
    for (const listener of this.listeners) listener(this.tasks)
  }
}
