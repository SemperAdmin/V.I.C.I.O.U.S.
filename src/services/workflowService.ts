import axios from 'axios'
import { LocalUserProfile, MemberProgress } from '@/services/localDataService'

const GH_API = 'https://api.github.com'

const getToken = (): string | null => {
  const envToken = import.meta.env.VITE_GH_DATA_TOKEN as string | undefined
  if (envToken && envToken !== '') return envToken
  return null
}

export const triggerCreateUserDispatch = async (
  owner: string,
  repo: string,
  payload: { user: LocalUserProfile; progress?: MemberProgress }
): Promise<void> => {
  if (import.meta.env.VITE_USE_LOCAL_DISPATCH === '1') {
    await axios.post(`http://127.0.0.1:5500/dispatch`, {
      event_type: 'create_user',
      client_payload: payload
    })
    return
  }
  const token = getToken()
  if (!token) throw new Error('Missing GitHub token. Configure VITE_GH_DATA_TOKEN in environment.')
  await axios.post(
    `${GH_API}/repos/${owner}/${repo}/dispatches`,
    {
      event_type: 'create_user',
      client_payload: payload
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    }
  )
}

export const triggerUpdateProgressDispatch = async (
  payload: { progress: MemberProgress }
): Promise<void> => {
  if (import.meta.env.VITE_USE_LOCAL_DISPATCH === '1') {
    await axios.post(`http://127.0.0.1:5500/dispatch`, {
      event_type: 'update_progress',
      client_payload: payload
    })
    return
  }
}
