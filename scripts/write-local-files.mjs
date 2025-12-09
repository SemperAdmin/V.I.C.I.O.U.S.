import fs from 'fs'
import path from 'path'

const root = process.cwd()
function ensureDir(p) { fs.mkdirSync(p, { recursive: true }) }
function writeJson(p, obj) { ensureDir(path.dirname(p)); fs.writeFileSync(p, JSON.stringify(obj, null, 2)) }

const now = new Date().toISOString()
const userId = String(Date.now())
const user = {
  user_id: userId,
  edipi: '7777777777',
  mos: '0150',
  first_name: 'Local',
  middle_initial: 'T',
  last_name: 'Write',
  org_role: 'Member',
  unit_id: '015',
  hashed_password: '$2a$12$testplaceholderhash',
  created_at_timestamp: now,
  updated_at_timestamp: now
}
const progress = {
  member_user_id: userId,
  unit_id: user.unit_id,
  official_checkin_timestamp: now,
  current_file_sha: '',
  progress_tasks: []
}

const usersDir = path.join(root, 'public', 'data', 'users')
const membersDir = path.join(root, 'public', 'data', 'members')
writeJson(path.join(usersDir, `user_${user.user_id}.json`), user)
const usersIndexPath = path.join(usersDir, 'users_index.json')
let idx = { users: [] }
try { idx = JSON.parse(fs.readFileSync(usersIndexPath, 'utf-8')) } catch {}
idx.users.push({ user_id: user.user_id, edipi: user.edipi, path: `data/users/user_${user.user_id}.json` })
writeJson(usersIndexPath, idx)

writeJson(path.join(membersDir, `progress_${progress.member_user_id}.json`), progress)
const membersIndexPath = path.join(membersDir, 'index.json')
let midx = { members: [] }
try { midx = JSON.parse(fs.readFileSync(membersIndexPath, 'utf-8')) } catch {}
midx.members.push({ member_user_id: progress.member_user_id, unit_id: progress.unit_id })
writeJson(membersIndexPath, midx)

console.log('Wrote local test files for user', userId)

