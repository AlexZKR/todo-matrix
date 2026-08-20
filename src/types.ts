export type QuadrantId = 'do' | 'schedule' | 'delegate' | 'eliminate'

export interface Board {
  id: string
  name: string
  createdAt: number
}

export interface Task {
  id: string
  boardId: string
  text: string
  quadrant: QuadrantId
  done: boolean
  createdAt: number
}

export interface QuadrantMeta {
  id: QuadrantId
  title: string
  hint: string
}

export const QUADRANTS: QuadrantMeta[] = [
  { id: 'do', title: 'Do', hint: 'Urgent · Important' },
  { id: 'schedule', title: 'Schedule', hint: 'Not urgent · Important' },
  { id: 'delegate', title: 'Delegate', hint: 'Urgent · Not important' },
  { id: 'eliminate', title: 'Eliminate', hint: 'Not urgent · Not important' },
]
