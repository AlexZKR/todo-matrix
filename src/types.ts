export type QuadrantId = 'do' | 'schedule' | 'delegate' | 'eliminate'

export interface Task {
  id: string
  text: string
  quadrant: QuadrantId
  done: boolean
  createdAt: number
}

export interface QuadrantMeta {
  id: QuadrantId
  title: string
  hint: string
  urgent: boolean
  important: boolean
}

export const QUADRANTS: QuadrantMeta[] = [
  { id: 'do', title: 'Do', hint: 'Urgent · Important', urgent: true, important: true },
  { id: 'schedule', title: 'Schedule', hint: 'Not urgent · Important', urgent: false, important: true },
  { id: 'delegate', title: 'Delegate', hint: 'Urgent · Not important', urgent: true, important: false },
  { id: 'eliminate', title: 'Eliminate', hint: 'Not urgent · Not important', urgent: false, important: false },
]
