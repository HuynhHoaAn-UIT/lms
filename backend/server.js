import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import express from 'express'
import session from 'express-session'
import { rateLimit } from 'express-rate-limit'
import { Client, InvalidCredentialsError } from 'ldapts'

const { AD_URL, AD_DOMAIN, AD_CA_FILE, APP_ORIGIN, SESSION_SECRET } = process.env
if (!AD_URL || !AD_DOMAIN || !APP_ORIGIN || !SESSION_SECRET || SESSION_SECRET.length < 32) {
  throw new Error('Set AD_URL, AD_DOMAIN, APP_ORIGIN and SESSION_SECRET (at least 32 characters).')
}
const ldapUrl = new URL(AD_URL)
const origin = new URL(APP_ORIGIN)
if (ldapUrl.protocol !== 'ldaps:' || !/^[a-z0-9.-]+$/i.test(AD_DOMAIN)) {
  throw new Error('AD_URL must use LDAPS and AD_DOMAIN must be a DNS domain.')
}
const secure = origin.protocol === 'https:'
if (!secure && !(origin.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(origin.hostname))) {
  throw new Error('APP_ORIGIN must use HTTPS except for local testing.')
}
const ca = AD_CA_FILE ? readFileSync(AD_CA_FILE) : undefined

const app = express()
app.disable('x-powered-by')
if (secure) app.set('trust proxy', 'loopback')
app.use('/api', (_, res, next) => {
  res.set('Cache-Control', 'no-store')
  next()
})
app.use('/api', (req, res, next) => {
  if (req.method === 'POST' && req.get('origin') !== origin.origin) {
    return res.status(403).json({ error: 'Yêu cầu không hợp lệ.' })
  }
  next()
})
app.use(express.json({ limit: '8kb' }))
const cookieName = secure ? '__Host-campus-lms' : 'campus-lms'
const cookie = { httpOnly: true, sameSite: 'lax', secure, path: '/' }
app.use('/api', session({
  name: cookieName,
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { ...cookie, maxAge: 60 * 60 * 1000 },
}))

app.get('/api/session', (req, res) => res.json({ user: req.session.user ?? null }))

const limitLogin = rateLimit({
  windowMs: 60_000,
  limit: 10,
  message: { error: 'Quá nhiều lần thử. Vui lòng đợi một phút.' },
})

app.post('/api/login', limitLogin, async (req, res, next) => {
  const username = typeof req.body?.username === 'string' ? req.body.username.trim().toLowerCase() : ''
  const password = req.body?.password
  if (!/^sv00[1-3]$/.test(username) || typeof password !== 'string' || !password || password.length > 1024) {
    return res.status(400).json({ error: 'Nhập mã sinh viên và mật khẩu hợp lệ.' })
  }
  const client = new Client({
    url: ldapUrl.href,
    connectTimeout: 5000,
    timeout: 5000,
    tlsOptions: { ca, rejectUnauthorized: true, servername: ldapUrl.hostname },
  })
  try {
    await client.bind(`${username}@${AD_DOMAIN}`, password)
  } catch (error) {
    if (error instanceof InvalidCredentialsError) {
      return res.status(401).json({ error: 'Mã sinh viên hoặc mật khẩu không đúng.' })
    }
    return next(error)
  } finally {
    await client.unbind().catch(() => {})
  }
  req.session.regenerate(error => {
    if (error) return next(error)
    const user = { username, name: `Sinh viên ${username.slice(2)}` }
    req.session.user = user
    req.session.save(error => error ? next(error) : res.json({ user }))
  })
})

app.post('/api/logout', (req, res, next) => {
  req.session.destroy(error => {
    if (error) return next(error)
    res.clearCookie(cookieName, cookie)
    res.sendStatus(204)
  })
})

app.use('/api', (_, res) => res.status(404).json({ error: 'Không tìm thấy API.' }))
app.use(express.static(fileURLToPath(new URL('../dist/', import.meta.url))))
app.use((error, _req, res, _next) => {
  if (error.status === 400 || error.status === 413) {
    return res.status(error.status).json({ error: 'Dữ liệu gửi lên không hợp lệ.' })
  }
  console.error('LMS request failed:', error.name, error.code ?? '')
  res.status(503).json({ error: 'Dịch vụ đăng nhập đang không khả dụng.' })
})
app.listen(Number(process.env.PORT || 3000), '127.0.0.1')
