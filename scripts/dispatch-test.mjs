import fs from 'fs'
import axios from 'axios'

const GH_API = 'https://api.github.com'

function getTokenFromEnvFile() {
  try {
    const txt = fs.readFileSync(new URL('../.env', import.meta.url), 'utf-8')
    for (const line of txt.split(/\r?\n/)) {
      const m = line.match(/^\s*VITE_GH_DATA_TOKEN\s*=\s*(.+)\s*$/)
      if (m) return m[1].trim()
    }
  } catch {}
  return process.env.VITE_GH_DATA_TOKEN || ''
}

async function main() {
  const token = getTokenFromEnvFile()
  if (!token) {
    console.error('Missing VITE_GH_DATA_TOKEN. Set it in .env or environment.')
    process.exit(1)
  }

  const now = new Date().toISOString()
  const userId = String(Date.now())
  const user = {
    user_id: userId,
    edipi: '1234567890',
    mos: '0150',
    first_name: 'Test',
    middle_initial: 'T',
    last_name: 'User',
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

  try {
    const res = await axios.post(
      `${GH_API}/repos/SemperAdmin/Process-Point-Data/dispatches`,
      { event_type: 'create_user', client_payload: { user, progress } },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
          'X-GitHub-Api-Version': '2022-11-28'
        }
      }
    )
    console.log('Dispatch OK:', res.status)
  } catch (e) {
    const status = e?.response?.status
    const msg = e?.response?.data?.message || e?.message
    console.error('Dispatch FAILED', status || '', msg || '')
    process.exit(2)
  }
}

main()

