const login = document.querySelector('#login')
const home = document.querySelector('#home')
const form = document.querySelector('#login-form')
const submit = form.querySelector('button')
const logout = document.querySelector('#logout')
const status = document.querySelector('#status')

const tools = home.querySelectorAll('[data-panel]')
for (const button of tools) {
  button.addEventListener('click', () => {
    for (const item of tools) {
      const selected = item === button
      item.setAttribute('aria-pressed', String(selected))
      document.getElementById(item.dataset.panel).hidden = !selected
    }
  })
}

function render(account) {
  login.hidden = Boolean(account)
  home.hidden = !account
  logout.hidden = !account
  document.querySelector('#name').textContent = account?.name || account?.username || ''
  document.querySelector('#username').textContent = account?.username || ''
  document.title = account ? 'Trang chủ · Campus LMS' : 'Đăng nhập · Campus LMS'
}

async function api(path, options) {
  const response = await fetch('/api/' + path, options)
  if (response.status === 204) return
  const result = await response.json()
  if (!response.ok) throw new Error(result.error)
  return result
}

form.addEventListener('submit', async (event) => {
  event.preventDefault()
  submit.disabled = true
  status.textContent = ''
  const credentials = Object.fromEntries(new FormData(form))
  try {
    const { user } = await api('login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    })
    render(user)
  } catch (error) {
    status.textContent = error.message || 'Không thể đăng nhập.'
  } finally {
    form.elements.password.value = ''
    submit.disabled = false
  }
})

logout.addEventListener('click', async () => {
  logout.disabled = true
  status.textContent = ''
  try {
    await api('logout', { method: 'POST' })
    render(null)
  } catch {
    status.textContent = 'Không thể đăng xuất. Vui lòng thử lại.'
  } finally {
    logout.disabled = false
  }
})

api('session')
  .then(({ user }) => render(user))
  .catch(() => { status.textContent = 'Không thể kiểm tra phiên đăng nhập.' })
  .finally(() => { submit.disabled = false })
