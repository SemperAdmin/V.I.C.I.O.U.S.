import axios from 'axios'

async function main() {
  const now = new Date().toISOString()
  const userId = String(Date.now())
  const user = {
    user_id: userId,
    edipi: '9999999999',
    mos: '0150',
    first_name: 'Local',
    middle_initial: 'L',
    last_name: 'Test',
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

  const res = await axios.post('http://127.0.0.1:5500/dispatch', {
    event_type: 'create_user',
    client_payload: { user, progress }
  })
  console.log('Local dispatch OK', res.status)
}

main().catch(e => { console.error(e); process.exit(1) })

