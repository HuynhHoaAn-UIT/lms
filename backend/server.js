import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import express from 'express'
import { createRemoteJWKSet, jwtVerify } from 'jose'
import mysql from 'mysql2/promise'

function required(name) {
  const value = process.env[name]
  if (!value) throw new Error('Thiếu biến môi trường ' + name)
  return value
}

const guid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i
const tenant = required('ENTRA_TENANT_ID').toLowerCase()
const audience = required('ENTRA_API_CLIENT_ID').toLowerCase()
const spa = required('ENTRA_SPA_CLIENT_ID').toLowerCase()
if (![tenant, audience, spa].every(value => guid.test(value))) {
  throw new Error('Các ID Microsoft Entra phải có định dạng GUID')
}

const authority = 'https://login.microsoftonline.com/' + tenant
const jwks = createRemoteJWKSet(new URL(authority + '/discovery/v2.0/keys'))
const pool = mysql.createPool({
  host: required('DB_HOST'),
  port: Number(process.env.DB_PORT || 3306),
  database: required('DB_NAME'),
  user: required('DB_USER'),
  password: required('DB_PASSWORD'),
  ssl: { ca: readFileSync(required('DB_CA_FILE')), verifyIdentity: true },
  connectionLimit: 5,
  waitForConnections: false,
  connectTimeout: 5000,
})

const app = express()
app.disable('x-powered-by')

app.post('/api/login-history', async (req, res) => {
  const token = req.get('authorization')?.match(/^Bearer (\S+)$/i)?.[1]
  if (!token) return res.status(401).end()

  let claims
  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer: authority + '/v2.0',
      audience,
      algorithms: ['RS256'],
      requiredClaims: ['exp', 'tid', 'oid', 'scp', 'azp', 'ver'],
    })
    claims = payload
  } catch {
    return res.status(401).end()
  }

  if (claims.ver !== '2.0' || claims.tid !== tenant || claims.azp !== spa ||
      typeof claims.oid !== 'string' || !guid.test(claims.oid) ||
      typeof claims.scp !== 'string' || !claims.scp.split(' ').includes('LoginHistory.Write')) {
    return res.status(403).end()
  }

  try {
    await pool.execute({
      sql: 'INSERT INTO login_history (entra_user_id, logged_in_at) VALUES (?, UTC_TIMESTAMP(6))',
      timeout: 5000,
    }, [claims.oid])
    return res.status(204).end()
  } catch (error) {
    console.error('Không ghi được lịch sử đăng nhập:', error.code || error.name)
    return res.status(503).end()
  }
})

app.use(express.static(fileURLToPath(new URL('../dist/', import.meta.url))))
app.listen(Number(process.env.PORT || 8080), () => {
  console.log('Campus LMS đang chạy.')
})
