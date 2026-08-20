import './style.css'
import { QUADRANTS, type QuadrantId, type Task } from './types'
import { TaskStore } from './store'
import { initTheme } from './theme'
import { initDragController } from './dnd'

const VISIBLE_TASK_LIMIT = 5

const store = new TaskStore()
const app = document.querySelector<HTMLDivElement>('#app')!

// Per-quadrant UI state, reset when switching boards.
let shownBoardId = store.activeBoardId
const showAll = new Set<QuadrantId>()
const expandedEmpty = new Set<QuadrantId>()

app.innerHTML = `
  <header class="topbar">
    <div class="topbar-title">
      <h1>Todo Matrix</h1>
      <p class="tagline">Eisenhower matrix — decide what to do, and when</p>
    </div>
    <div class="topbar-actions">
      <button id="clear-done" class="ghost-btn" hidden>Clear done</button>
      <button id="theme-toggle" class="icon-btn" type="button"></button>
    </div>
  </header>
  <nav class="boards" aria-label="Boards">
    <div class="board-chips" data-chips></div>
    <button id="new-board" class="ghost-btn new-board-btn" type="button">+ Board</button>
  </nav>
  <main class="matrix" aria-label="Eisenhower matrix">
    <span class="axis axis-x axis-urgent">Urgent</span>
    <span class="axis axis-x axis-not-urgent">Not urgent</span>
    <span class="axis axis-y axis-important">Important</span>
    <span class="axis axis-y axis-not-important">Not important</span>
    ${QUADRANTS.map(
      (q) => `
      <section class="quadrant quadrant-${q.id}" data-quadrant="${q.id}">
        <header class="quadrant-head" data-head>
          <h2>${q.title}</h2>
          <span class="quadrant-hint">${q.hint}</span>
          <span class="count" data-count></span>
        </header>
        <ul class="tasks" data-tasks></ul>
        <button class="more-btn" data-more type="button" hidden></button>
        <form class="add-form" data-add>
          <input type="text" name="text" placeholder="Add a task…" autocomplete="off" maxlength="500" aria-label="Add task to ${q.title}" />
          <button type="submit" aria-label="Add">+</button>
        </form>
      </section>`,
    ).join('')}
  </main>
`

initTheme(document.querySelector<HTMLButtonElement>('#theme-toggle')!)
initDragController((taskId, quadrant) => store.move(taskId, quadrant))

const clearDoneBtn = document.querySelector<HTMLButtonElement>('#clear-done')!
clearDoneBtn.addEventListener('click', () => store.clearCompleted())

document.querySelector<HTMLButtonElement>('#new-board')!.addEventListener('click', () => store.addBoard())

// --- boards bar --------------------------------------------------------------

const chipsEl = app.querySelector<HTMLDivElement>('[data-chips]')!

function renderBoards(): void {
  const boards = store.boards
  chipsEl.replaceChildren(
    ...boards.map((board) => {
      const chip = document.createElement('div')
      chip.className = 'chip' + (board.id === store.activeBoardId ? ' active' : '')

      const name = document.createElement('button')
      name.type = 'button'
      name.className = 'chip-name'
      name.textContent = board.name
      name.title = board.id === store.activeBoardId ? 'Double-click to rename' : `Switch to ${board.name}`
      name.addEventListener('click', () => store.setActiveBoard(board.id))
      name.addEventListener('dblclick', () => startRename(chip, board.id, board.name))
      chip.append(name)

      if (board.id === store.activeBoardId) {
        const rename = document.createElement('button')
        rename.type = 'button'
        rename.className = 'chip-action'
        rename.textContent = '✎'
        rename.ariaLabel = `Rename board ${board.name}`
        rename.addEventListener('click', () => startRename(chip, board.id, board.name))
        chip.append(rename)

        if (boards.length > 1) {
          const del = document.createElement('button')
          del.type = 'button'
          del.className = 'chip-action chip-delete'
          del.textContent = '✕'
          del.ariaLabel = `Delete board ${board.name}`
          del.addEventListener('click', () => {
            const count = store.taskCount(board.id)
            const ok =
              count === 0 ||
              confirm(`Delete board “${board.name}” and its ${count} task${count === 1 ? '' : 's'}?`)
            if (ok) store.removeBoard(board.id)
          })
          chip.append(del)
        }
      }
      return chip
    }),
  )
}

function startRename(chip: HTMLElement, boardId: string, currentName: string): void {
  if (chip.querySelector('input')) return
  const input = document.createElement('input')
  input.type = 'text'
  input.className = 'chip-rename'
  input.value = currentName
  input.maxLength = 60
  input.ariaLabel = 'Board name'
  let done = false
  const commit = () => {
    if (done) return
    done = true
    store.renameBoard(boardId, input.value)
    renderBoards()
  }
  input.addEventListener('blur', commit)
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') commit()
    if (e.key === 'Escape') {
      done = true
      renderBoards()
    }
  })
  chip.replaceChildren(input)
  input.focus()
  input.select()
}

// --- tasks -------------------------------------------------------------------

function renderTask(task: Task): HTMLLIElement {
  const li = document.createElement('li')
  li.className = 'task' + (task.done ? ' done' : '')
  li.dataset.id = task.id

  const handle = document.createElement('span')
  handle.className = 'drag-handle'
  handle.textContent = '⠿'
  handle.ariaLabel = 'Drag to another quadrant'

  const checkbox = document.createElement('input')
  checkbox.type = 'checkbox'
  checkbox.checked = task.done
  checkbox.ariaLabel = task.done ? 'Mark as not done' : 'Mark as done'
  checkbox.addEventListener('change', () => store.toggle(task.id))

  const text = document.createElement('span')
  text.className = 'task-text'
  text.textContent = task.text

  const deleteBtn = document.createElement('button')
  deleteBtn.className = 'task-btn delete-btn'
  deleteBtn.type = 'button'
  deleteBtn.textContent = '✕'
  deleteBtn.ariaLabel = 'Delete task'
  deleteBtn.addEventListener('click', () => store.remove(task.id))

  li.append(handle, checkbox, text, deleteBtn)
  return li
}

function render(): void {
  if (shownBoardId !== store.activeBoardId) {
    shownBoardId = store.activeBoardId
    showAll.clear()
    expandedEmpty.clear()
  }

  renderBoards()

  for (const section of app.querySelectorAll<HTMLElement>('.quadrant')) {
    const quadrant = section.dataset.quadrant as QuadrantId
    const tasks = store.getByQuadrant(quadrant)
    const expanded = showAll.has(quadrant)
    const visible = expanded ? tasks : tasks.slice(0, VISIBLE_TASK_LIMIT)

    section.querySelector<HTMLUListElement>('[data-tasks]')!.replaceChildren(...visible.map(renderTask))

    const moreBtn = section.querySelector<HTMLButtonElement>('[data-more]')!
    const hiddenCount = tasks.length - visible.length
    if (expanded && tasks.length > VISIBLE_TASK_LIMIT) {
      moreBtn.hidden = false
      moreBtn.textContent = 'Show less ▴'
    } else if (hiddenCount > 0) {
      moreBtn.hidden = false
      moreBtn.textContent = `Show ${hiddenCount} more ▾`
    } else {
      moreBtn.hidden = true
    }

    const open = tasks.filter((t) => !t.done).length
    section.querySelector<HTMLElement>('[data-count]')!.textContent = open ? String(open) : ''

    section.classList.toggle('empty', tasks.length === 0)
    section.classList.toggle('expanded', expandedEmpty.has(quadrant))
  }
  clearDoneBtn.hidden = store.completedCount === 0
}

store.subscribe(render)

// --- interactions ---------------------------------------------------------------

for (const section of app.querySelectorAll<HTMLElement>('.quadrant')) {
  const quadrant = section.dataset.quadrant as QuadrantId

  section.querySelector<HTMLButtonElement>('[data-more]')!.addEventListener('click', () => {
    if (showAll.has(quadrant)) showAll.delete(quadrant)
    else showAll.add(quadrant)
    render()
  })

  // On mobile, empty quadrants collapse to just their header;
  // tapping the header reveals the add form.
  section.querySelector<HTMLElement>('[data-head]')!.addEventListener('click', () => {
    if (!section.classList.contains('empty')) return
    if (expandedEmpty.has(quadrant)) {
      expandedEmpty.delete(quadrant)
    } else {
      expandedEmpty.add(quadrant)
    }
    render()
    if (expandedEmpty.has(quadrant)) {
      section.querySelector<HTMLInputElement>('.add-form input')?.focus({ preventScroll: true })
    }
  })

  section.querySelector<HTMLFormElement>('[data-add]')!.addEventListener('submit', (e) => {
    e.preventDefault()
    const form = e.currentTarget as HTMLFormElement
    const input = form.elements.namedItem('text') as HTMLInputElement
    store.add(input.value, quadrant)
    input.value = ''
    input.focus()
  })
}
