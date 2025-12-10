import http from 'http'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const root = process.cwd()
const publicDir = 'public'

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true })
}

function writeJsonFile(p, obj) {
  const absDir = path.resolve(root, path.dirname(p))
  ensureDir(absDir)
  const absFile = path.resolve(root, p)
  fs.writeFileSync(absFile, JSON.stringify(obj, null, 2))
}

function updateIndexUsers(user) {
  const idxPath = path.posix.join(publicDir, 'data', 'users', 'users_index.json')
  let idx = { users: [] }
  try { idx = JSON.parse(fs.readFileSync(idxPath, 'utf-8')) } catch {}
  const pathRel = `data/users/user_${user.user_id}.json`
  const exists = idx.users.find(u => u.user_id === user.user_id)
  if (!exists) {
    idx.users.push({ user_id: user.user_id, edipi: user.edipi, path: pathRel })
  }
  writeJsonFile(idxPath, idx)
}

function updateIndexMembers(progress) {
  const idxPath = path.posix.join(publicDir, 'data', 'members', 'index.json')
  let idx = { members: [] }
  try { idx = JSON.parse(fs.readFileSync(idxPath, 'utf-8')) } catch {}
  const exists = idx.members.find(m => m.member_user_id === progress.member_user_id)
  if (!exists) {
    idx.members.push({ member_user_id: progress.member_user_id, unit_id: progress.unit_id })
  }
  writeJsonFile(idxPath, idx)
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/dispatch') {
    let body = ''
    req.on('data', chunk => { body += chunk })
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}')
        const eventType = payload.event_type
        const client = payload.client_payload || {}
        if (eventType === 'create_user') {
          const user = client.user
          const progress = client.progress
          if (!user || !user.user_id) throw new Error('Missing user payload')
          const userPath = path.posix.join(publicDir, 'data', 'users', `user_${user.user_id}.json`)
          writeJsonFile(userPath, user)
          updateIndexUsers(user)
          if (progress && progress.member_user_id) {
            const progPath = path.posix.join(publicDir, 'data', 'members', `progress_${progress.member_user_id}.json`)
            writeJsonFile(progPath, progress)
            updateIndexMembers(progress)
          }
        } else if (eventType === 'update_progress') {
          const progress = client.progress
          if (!progress || !progress.member_user_id) throw new Error('Missing progress payload')
          const progPath = path.posix.join(publicDir, 'data', 'members', `progress_${progress.member_user_id}.json`)
          writeJsonFile(progPath, progress)
          updateIndexMembers(progress)
        } else {
          throw new Error('Unsupported event_type')
        }
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: true }))
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: false, error: String(e?.message || e) }))
      }
    })
    return
  }
  res.writeHead(404)
  res.end()
})

const PORT = 5500
server.listen(PORT, '127.0.0.1', () => {
  console.log(`Local dispatch server listening at http://127.0.0.1:${PORT}/dispatch`)
})
