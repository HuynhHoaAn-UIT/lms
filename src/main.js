import { PublicClientApplication } from '@azure/msal-browser'

const login = document.querySelector('#login')
const home = document.querySelector('#home')
const sso = document.querySelector('#sso')
const logout = document.querySelector('#logout')
const status = document.querySelector('#status')

function render(account) {
  login.hidden = Boolean(account)
  home.hidden = !account
  logout.hidden = !account
  document.querySelector('#name').textContent = account?.name || account?.username || ''
  document.querySelector('#username').textContent = account?.username || ''
  document.title = account ? 'Trang chủ · Campus LMS' : 'Đăng nhập · Campus LMS'
}

async function start() {
  const clientId = import.meta.env.VITE_ENTRA_CLIENT_ID?.trim()
  const tenantId = import.meta.env.VITE_ENTRA_TENANT_ID?.trim()
  const guid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i
  const apiClientId = import.meta.env.VITE_ENTRA_API_CLIENT_ID?.trim()
  if (![clientId, tenantId, apiClientId].every(id => guid.test(id))) {
    status.textContent = 'Thiếu cấu hình Microsoft Entra ID.'
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
  render(null)
  sso.disabled = false

  sso.addEventListener('click', async () => {
    sso.disabled = true
    status.textContent = 'Tiếp tục đăng nhập trong cửa sổ Microsoft.'
    try {
      const scope = 'api://' + apiClientId + '/LoginHistory.Write'
      const result = await msal.loginPopup({ scopes: [scope] })
      const response = await fetch('/api/login-history', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + result.accessToken },
        signal: AbortSignal.timeout(15000),
      })
      if (!response.ok) {
        throw new Error('Không thể xác nhận và ghi nhận lần đăng nhập.')
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
