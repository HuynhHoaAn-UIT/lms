import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { createRemoteJWKSet, jwtVerify, errors } from 'jose'
import mysql from 'mysql2/promise'
import serveStatic from 'serve-static'
import { fileURLToPath } from 'node:url'

function required(name) {
  const value = process.env[name]
  if (!value || value === 'xxx') throw new Error('Thiếu cấu hình ' + name)
  return value
}

const tenant = required('ENTRA_TENANT_ID')
const audience = required('ENTRA_API_CLIENT_ID')
const client = required('ENTRA_SPA_CLIENT_ID')
const origin = new URL(required('FRONTEND_ORIGIN')).origin
const authority = 'https://login.microsoftonline.com/' + tenant
const keys = createRemoteJWKSet(new URL(authority + '/discovery/v2.0/keys'))
const db = mysql.createPool({
  host: required('DB_HOST'), port: Number(process.env.DB_PORT || 3306),
  database: required('DB_NAME'), user: required('DB_USER'), password: required('DB_PASSWORD'),
  ssl: process.env.DB_SSL_CA ? { ca: readFileSync(process.env.DB_SSL_CA) } : undefined,
  connectionLimit: 5,
})

const serveFrontend = serveStatic(fileURLToPath(new URL('./public/', import.meta.url)), {
  index: 'index.html', redirect: false,
})

createServer(async (req, res) => {
  function finish(code) { res.writeHead(code); res.end() }
  if (req.method === 'GET' && req.url === '/api/config') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
    return res.end(JSON.stringify({ clientId: client, tenantId: tenant, apiId: audience }))
  }
  if (req.url !== '/api/login-history') {
    return serveFrontend(req, res, (err) => finish(err?.statusCode || 404))
  }
  res.setHeader('Vary', 'Origin')
  if (req.headers.origin) {
    if (req.headers.origin !== origin) return finish(403)
    res.setHeader('Access-Control-Allow-Origin', origin)
  }
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST')
    res.setHeader('Access-Control-Allow-Headers', 'Authorization')
    return finish(204)
  }
  if (req.method !== 'POST') return finish(405)
  const match = /^Bearer (\S+)$/i.exec(req.headers.authorization || '')
  if (!match) return finish(401)

  try {
    const { payload } = await jwtVerify(match[1], keys, {
      algorithms: ['RS256'], issuer: authority + '/v2.0', audience,
      requiredClaims: ['exp', 'tid', 'oid', 'uti'],
    })
    if (payload.tid !== tenant || payload.azp !== client ||
        !payload.scp?.split(' ').includes('Login.Record')) return finish(403)
    await db.execute(
      'INSERT INTO login_history (token_id, user_oid, username) VALUES (?, ?, ?)',
      [payload.uti, payload.oid, payload.preferred_username ?? null],
    )
    finish(204)
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return finish(204)
    if (error instanceof errors.JOSEError && !(error instanceof errors.JWKSTimeout)) return finish(401)
    console.error('Login history unavailable', error.code || error.name)
    finish(503)
  }
}).listen(Number(process.env.PORT || 3001))
