const THEME_KEY = 'todo-matrix.theme'

export type Theme = 'light' | 'dark'

function preferredTheme(): Theme {
  const saved = localStorage.getItem(THEME_KEY)
  if (saved === 'light' || saved === 'dark') return saved
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function initTheme(button: HTMLButtonElement): void {
  let theme = preferredTheme()
  const apply = () => {
    document.documentElement.dataset.theme = theme
    button.textContent = theme === 'dark' ? '☀️' : '🌙'
    button.setAttribute('aria-label', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme')
  }
  apply()

  button.addEventListener('click', () => {
    theme = theme === 'dark' ? 'light' : 'dark'
    localStorage.setItem(THEME_KEY, theme)
    apply()
  })

  // Follow OS changes only while the user hasn't picked a theme explicitly.
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (localStorage.getItem(THEME_KEY)) return
    theme = e.matches ? 'dark' : 'light'
    apply()
  })
}
