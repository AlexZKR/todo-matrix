import './style.css'
import { QUADRANTS, type QuadrantId, type Task } from './types'
import { TaskStore } from './store'
import { initTheme } from './theme'

const store = new TaskStore()
const app = document.querySelector<HTMLDivElement>('#app')!

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
  <main class="matrix" aria-label="Eisenhower matrix">
    <span class="axis axis-x axis-urgent">Urgent</span>
    <span class="axis axis-x axis-not-urgent">Not urgent</span>
    <span class="axis axis-y axis-important">Important</span>
    <span class="axis axis-y axis-not-important">Not important</span>
    ${QUADRANTS.map(
      (q) => `
      <section class="quadrant quadrant-${q.id}" data-quadrant="${q.id}">
        <header class="quadrant-head">
          <h2>${q.title}</h2>
          <span class="quadrant-hint">${q.hint}</span>
          <span class="count" data-count></span>
        </header>
        <ul class="tasks" data-tasks></ul>
        <form class="add-form" data-add>
          <input type="text" name="text" placeholder="Add a task…" autocomplete="off" maxlength="500" aria-label="Add task to ${q.title}" />
          <button type="submit" aria-label="Add">+</button>
        </form>
      </section>`,
    ).join('')}
  </main>
`

initTheme(document.querySelector<HTMLButtonElement>('#theme-toggle')!)

const clearDoneBtn = document.querySelector<HTMLButtonElement>('#clear-done')!
clearDoneBtn.addEventListener('click', () => store.clearCompleted())

// --- rendering -------------------------------------------------------------

function renderTask(task: Task): HTMLLIElement {
  const li = document.createElement('li')
  li.className = 'task' + (task.done ? ' done' : '')
  li.draggable = true
  li.dataset.id = task.id

  const checkbox = document.createElement('input')
  checkbox.type = 'checkbox'
  checkbox.checked = task.done
  checkbox.ariaLabel = task.done ? 'Mark as not done' : 'Mark as done'
  checkbox.addEventListener('change', () => store.toggle(task.id))

  const text = document.createElement('span')
  text.className = 'task-text'
  text.textContent = task.text

  const moveBtn = document.createElement('button')
  moveBtn.className = 'task-btn move-btn'
  moveBtn.type = 'button'
  moveBtn.textContent = '⇄'
  moveBtn.ariaLabel = 'Move to another quadrant'
  moveBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    openMoveMenu(task, moveBtn)
  })

  const deleteBtn = document.createElement('button')
  deleteBtn.className = 'task-btn delete-btn'
  deleteBtn.type = 'button'
  deleteBtn.textContent = '✕'
  deleteBtn.ariaLabel = 'Delete task'
  deleteBtn.addEventListener('click', () => store.remove(task.id))

  li.append(checkbox, text, moveBtn, deleteBtn)

  li.addEventListener('dragstart', (e) => {
    e.dataTransfer?.setData('text/plain', task.id)
    e.dataTransfer!.effectAllowed = 'move'
    li.classList.add('dragging')
  })
  li.addEventListener('dragend', () => li.classList.remove('dragging'))

  return li
}

function render(): void {
  for (const section of app.querySelectorAll<HTMLElement>('.quadrant')) {
    const quadrant = section.dataset.quadrant as QuadrantId
    const tasks = store.getByQuadrant(quadrant)
    const list = section.querySelector<HTMLUListElement>('[data-tasks]')!
    list.replaceChildren(...tasks.map(renderTask))
    const open = tasks.filter((t) => !t.done).length
    section.querySelector<HTMLElement>('[data-count]')!.textContent = open ? String(open) : ''
  }
  clearDoneBtn.hidden = store.completedCount === 0
}

store.subscribe(render)

// --- adding ----------------------------------------------------------------

for (const form of app.querySelectorAll<HTMLFormElement>('[data-add]')) {
  form.addEventListener('submit', (e) => {
    e.preventDefault()
    const input = form.elements.namedItem('text') as HTMLInputElement
    const quadrant = form.closest<HTMLElement>('.quadrant')!.dataset.quadrant as QuadrantId
    store.add(input.value, quadrant)
    input.value = ''
    input.focus()
  })
}

// --- drag & drop between quadrants -----------------------------------------

for (const section of app.querySelectorAll<HTMLElement>('.quadrant')) {
  section.addEventListener('dragover', (e) => {
    e.preventDefault()
    e.dataTransfer!.dropEffect = 'move'
    section.classList.add('drop-target')
  })
  section.addEventListener('dragleave', (e) => {
    if (!section.contains(e.relatedTarget as Node)) section.classList.remove('drop-target')
  })
  section.addEventListener('drop', (e) => {
    e.preventDefault()
    section.classList.remove('drop-target')
    const id = e.dataTransfer?.getData('text/plain')
    if (id) store.move(id, section.dataset.quadrant as QuadrantId)
  })
}

// --- move menu (touch-friendly alternative to drag & drop) ------------------

function openMoveMenu(task: Task, anchor: HTMLElement): void {
  closeMoveMenu()
  const menu = document.createElement('div')
  menu.className = 'move-menu'
  menu.role = 'menu'
  for (const q of QUADRANTS) {
    if (q.id === task.quadrant) continue
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.role = 'menuitem'
    btn.innerHTML = `<span class="dot dot-${q.id}"></span>${q.title}`
    btn.addEventListener('click', () => {
      store.move(task.id, q.id)
      closeMoveMenu()
    })
    menu.append(btn)
  }
  document.body.append(menu)
  const rect = anchor.getBoundingClientRect()
  const menuWidth = menu.offsetWidth
  menu.style.top = `${rect.bottom + window.scrollY + 4}px`
  menu.style.left = `${Math.min(rect.left + window.scrollX, window.scrollX + document.documentElement.clientWidth - menuWidth - 8)}px`
  setTimeout(() => document.addEventListener('pointerdown', onOutsidePointer), 0)
}

function closeMoveMenu(): void {
  document.querySelector('.move-menu')?.remove()
  document.removeEventListener('pointerdown', onOutsidePointer)
}

function onOutsidePointer(e: PointerEvent): void {
  if (!(e.target as Element).closest('.move-menu')) closeMoveMenu()
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeMoveMenu()
})
