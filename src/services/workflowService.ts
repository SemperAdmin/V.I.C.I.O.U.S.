import axios from 'axios'
import { LocalUserProfile, MemberProgress } from '@/services/localDataService'

const GH_API = 'https://api.github.com'

const getToken = (): string | null => {
  const envToken = import.meta.env.VITE_GH_DATA_TOKEN as string | undefined
  if (envToken && envToken !== '') return envToken
  const ls = localStorage.getItem('GH_TOKEN')
  return ls || null
}

export const triggerCreateUserDispatch = async (
  owner: string,
  repo: string,
  payload: { user: LocalUserProfile; progress?: MemberProgress }
): Promise<void> => {
  const token = getToken()
  if (!token) throw new Error('Missing GitHub token. Set VITE_GH_DATA_TOKEN or localStorage.GH_TOKEN')

  await axios.post(
    `${GH_API}/repos/${owner}/${repo}/dispatches`,
    {
      event_type: 'create_user',
      client_payload: payload
    },
    {
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github+json'
      }
    }
  )
}
