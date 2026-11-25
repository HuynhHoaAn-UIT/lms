import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import { Client, InvalidCredentialsError } from 'ldapts'
import mysql from 'mysql2/promise'
import serveStatic from 'serve-static'

function required(name) {
  const value = process.env[name]
  if (!value || value === 'xxx') throw new Error('Thiếu cấu hình ' + name)
  return value
}

const origin = new URL(required('FRONTEND_ORIGIN'))
const secure = origin.protocol === 'https:'
if (!secure && !(origin.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(origin.hostname))) {
  throw new Error('FRONTEND_ORIGIN phải dùng HTTPS, trừ localhost.')
}
const ldapUrl = new URL(required('AD_URL'))
if (ldapUrl.protocol !== 'ldaps:') throw new Error('AD_URL phải dùng ldaps://')
const baseDn = required('AD_BASE_DN')
const domain = required('AD_NETBIOS_DOMAIN')
const adCa = readFileSync(required('AD_TLS_CA'))
const sessionSecret = required('SESSION_SECRET')
if (Buffer.byteLength(sessionSecret) < 32) throw new Error('SESSION_SECRET cần ít nhất 32 byte.')
const sessionAge = 3600
const cookieFlags = 'Path=/; HttpOnly; SameSite=Lax' + (secure ? '; Secure' : '')
const db = mysql.createPool({
  host: required('DB_HOST'), port: Number(process.env.DB_PORT || 3306),
  database: required('DB_NAME'), user: required('DB_USER'), password: required('DB_PASSWORD'),
  ssl: { ca: readFileSync(required('DB_SSL_CA')), verifyIdentity: true },
  connectTimeout: 5000, connectionLimit: 5,
})
const serveFrontend = serveStatic(fileURLToPath(new URL('./public/', import.meta.url)), {
  index: 'index.html', redirect: false,
})

function signature(value) {
  return createHmac('sha256', sessionSecret).update(value).digest('base64url')
}

function sessionCookie(account) {
  const value = Buffer.from(JSON.stringify({ account, exp: Date.now() + sessionAge * 1000 })).toString('base64url')
  return 'lms_session=' + value + '.' + signature(value) + '; Max-Age=' + sessionAge + '; ' + cookieFlags
}

function readSession(header = '') {
  const match = /(?:^|;\s*)lms_session=([\w-]+)\.([\w-]{43})(?:;|$)/.exec(header)
  if (!match || !timingSafeEqual(Buffer.from(match[2]), Buffer.from(signature(match[1])))) return null
  const { account, exp } = JSON.parse(Buffer.from(match[1], 'base64url'))
  return exp > Date.now() ? account : null
}

async function authenticate(username, password) {
  const ldap = new Client({
    url: ldapUrl.href, connectTimeout: 5000, timeout: 5000,
    tlsOptions: { ca: adCa, servername: ldapUrl.hostname, minVersion: 'TLSv1.2' },
  })
  try {
    await ldap.bind(domain + '\\' + username, password)
    const { searchEntries } = await ldap.search(baseDn, {
      scope: 'sub', sizeLimit: 2,
      filter: '(&(objectClass=user)(sAMAccountName=' + username + '))',
      attributes: ['objectGUID', 'displayName'],
      explicitBufferAttributes: ['objectGUID'],
    })
    const [entry] = searchEntries
    const guid = entry?.objectGUID
    if (searchEntries.length !== 1 || !Buffer.isBuffer(guid) || guid.length !== 16) {
      throw new Error('Không đọc được objectGUID của user AD')
    }
    const hex = guid.toString('hex')
    const oid = [
      guid.readUInt32LE(0).toString(16).padStart(8, '0'),
      guid.readUInt16LE(4).toString(16).padStart(4, '0'),
      guid.readUInt16LE(6).toString(16).padStart(4, '0'),
      hex.slice(16, 20), hex.slice(20),
    ].join('-')
    return { oid, username, name: typeof entry.displayName === 'string' ? entry.displayName : username }
  } finally {
    await ldap.unbind().catch(() => {})
  }
}

createServer(async (req, res) => {
  function finish(code, body) {
    res.writeHead(code, { 'Cache-Control': 'no-store', 'Content-Type': 'application/json' })
    res.end(body === undefined ? undefined : JSON.stringify(body))
  }
  if (req.method === 'GET' && req.url === '/api/config') return finish(200, { auth: 'ad' })
  if (req.method === 'GET' && req.url === '/api/session') {
    return finish(200, { account: readSession(req.headers.cookie) })
  }
  if (req.url !== '/api/login' && req.url !== '/api/logout') {
    return serveFrontend(req, res, (err) => finish(err?.statusCode || 404))
  }
  if (req.method !== 'POST') return finish(405)
  if (req.headers.origin !== origin.origin) return finish(403)
  if (req.url === '/api/logout') {
    res.setHeader('Set-Cookie', 'lms_session=; Max-Age=0; ' + cookieFlags)
    return finish(204)
  }

  let input
  try {
    let size = 0
    const chunks = []
    for await (const chunk of req.iterator({ destroyOnReturn: false })) {
      size += chunk.length
      if (size > 4096) return finish(413)
      chunks.push(chunk)
    }
    input = JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    return finish(400)
  }
  const username = typeof input?.username === 'string' ? input.username.trim().toLowerCase() : ''
  const password = input?.password
  if (!/^[a-z0-9._-]{1,64}$/.test(username) || typeof password !== 'string' ||
      !password || password.length > 1024 || password.includes('\0')) return finish(400)
  try {
    const account = await authenticate(username, password)
    await db.execute(
      'INSERT INTO login_history (token_id, user_oid, username) VALUES (?, ?, ?)',
      [randomUUID(), account.oid, account.username],
    )
    res.setHeader('Set-Cookie', sessionCookie(account))
    return finish(200, { account })
  } catch (error) {
    if (error instanceof InvalidCredentialsError) return finish(401)
    console.error('AD login unavailable', error.code || error.name)
    return finish(503)
  }
}).listen(Number(process.env.PORT || 3001))
