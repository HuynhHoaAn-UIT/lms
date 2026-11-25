import { PublicClientApplication } from '@azure/msal-browser'

const login = document.querySelector('#login')
const home = document.querySelector('#home')
const sso = document.querySelector('#sso')
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

async function start() {
  let clientId = import.meta.env.VITE_ENTRA_CLIENT_ID?.trim()
  let tenantId = import.meta.env.VITE_ENTRA_TENANT_ID?.trim()
  let apiId = import.meta.env.VITE_ENTRA_API_CLIENT_ID?.trim()
  if (!clientId && !tenantId && !apiId) {
    const response = await fetch('/api/config')
    if (!response.ok) throw new Error('Thiếu cấu hình Entra cho LMS.')
    const config = await response.json()
    clientId = config.clientId
    tenantId = config.tenantId
    apiId = config.apiId
  }
  const historyUrl = import.meta.env.VITE_LOGIN_API_URL?.trim() || '/api/login-history'
  const guid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i
  if (!guid.test(clientId) || !guid.test(tenantId) || !guid.test(apiId)) {
    console.warn('Campus LMS: thiếu cấu hình Entra ID hợp lệ.')
    return
  }

  const msal = new PublicClientApplication({
    auth: {
      clientId,
      authority: 'https://login.microsoftonline.com/' + tenantId,
      redirectUri: location.origin + '/auth-callback.html',
      postLogoutRedirectUri: location.origin + '/',
    },
    cache: { cacheLocation: 'sessionStorage' },
  })
  await msal.initialize()
  render(msal.getActiveAccount())
  sso.disabled = false

  sso.addEventListener('click', async () => {
    sso.disabled = true
    status.textContent = 'Tiếp tục đăng nhập trong cửa sổ Microsoft.'
    try {
      const result = await msal.loginPopup({
        scopes: ['openid', 'profile', 'api://' + apiId + '/Login.Record'],
      })
      try {
        const response = await fetch(historyUrl, {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + result.accessToken },
          redirect: 'error',
          signal: AbortSignal.timeout(15000),
        })
        if (response.status !== 204) throw new Error('HTTP ' + response.status)
      } catch {
        status.textContent = 'Microsoft đã xác thực, nhưng LMS chưa xác nhận ghi lịch sử. Vui lòng thử lại.'
        return
      }
      msal.setActiveAccount(result.account)
      render(result.account)
      status.textContent = ''
    } catch (error) {
      status.textContent = 'Đăng nhập chưa hoàn tất. ' + (error.errorCode || error.message)
    } finally {
      sso.disabled = false
    }
  })

  logout.addEventListener('click', async () => {
    logout.disabled = true
    status.textContent = ''
    try {
      await msal.logoutPopup({ account: msal.getActiveAccount() })
    } catch (error) {
      status.textContent = 'Không thể hoàn tất đăng xuất Microsoft. ' + (error.errorCode || error.message)
    } finally {
      render(msal.getActiveAccount())
      logout.disabled = false
    }
  })
}

start().catch((error) => {
  status.textContent = 'Không thể khởi tạo đăng nhập Microsoft. ' + error.message
})
