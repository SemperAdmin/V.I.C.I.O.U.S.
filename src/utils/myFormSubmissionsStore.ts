export type MyFormSubmissionTask = {
  sub_task_id: string
  description: string
  status: 'Pending' | 'Cleared' | 'Skipped'
}

export type MyFormSubmission = {
  id: number
  user_id: string
  unit_id: string
  form_id: number
  form_name: string
  kind: 'Inbound' | 'Outbound'
  created_at: string
  member: {
    edipi: string
    rank?: string
    first_name?: string
    last_name?: string
    company_id?: string
    platoon_id?: string
  }
  tasks: MyFormSubmissionTask[]
}

const KEY = 'my_form_submissions'

const load = (): Record<string, MyFormSubmission[]> => {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

const save = (map: Record<string, MyFormSubmission[]>) => {
  localStorage.setItem(KEY, JSON.stringify(map))
}

export const listSubmissions = (user_id: string): MyFormSubmission[] => {
  const map = load()
  return map[user_id] || []
}

export const createSubmission = (submission: Omit<MyFormSubmission, 'id' | 'created_at'>): MyFormSubmission => {
  const map = load()
  const id = Date.now()
  const full: MyFormSubmission = { ...submission, id, created_at: new Date().toISOString() }
  const list = map[submission.user_id] || []
  map[submission.user_id] = [...list, full]
  save(map)
  return full
}
