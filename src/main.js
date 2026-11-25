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

form.addEventListener('submit', async (event) => {
  event.preventDefault()
  submit.disabled = true
  status.textContent = ''
  const password = form.elements.password
  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: form.elements.username.value, password: password.value }),
    })
    if (response.status === 401 || response.status === 400) {
      status.textContent = 'Tài khoản hoặc mật khẩu không hợp lệ.'
      return
    }
    if (!response.ok) throw new Error()
    render((await response.json()).account)
  } catch {
    status.textContent = 'LMS chưa thể hoàn tất đăng nhập. Vui lòng thử lại.'
  } finally {
    password.value = ''
    submit.disabled = false
  }
})

logout.addEventListener('click', async () => {
  logout.disabled = true
  try {
    const response = await fetch('/api/logout', { method: 'POST' })
    if (!response.ok) throw new Error()
    render(null)
    status.textContent = ''
  } catch {
    status.textContent = 'Chưa thể đăng xuất. Vui lòng thử lại.'
  } finally {
    logout.disabled = false
  }
})

fetch('/api/session')
  .then(response => response.json())
  .then(({ account }) => render(account))
  .catch(() => {})
  .finally(() => { submit.disabled = false })
