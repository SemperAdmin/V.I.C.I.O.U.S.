import { sbListSubmissions, sbCreateSubmission, sbDeleteSubmission } from '@/services/supabaseDataService'

export type MyFormSubmissionTask = {
  sub_task_id: string
  description: string
  status: 'Pending' | 'Cleared' | 'Skipped'
  // Log fields for when task is cleared
  cleared_by_user_id?: string
  cleared_by_edipi?: string
  cleared_at_timestamp?: string
  note?: string
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
    email?: string
    phone_number?: string
    current_unit_id?: string
  }
  tasks: MyFormSubmissionTask[]
  arrival_date?: string
  departure_date?: string
  task_ids?: string[]
  completed_count?: number
  total_count?: number
  status?: 'In_Progress' | 'Completed'
  // For outbound forms - the destination unit where member is going
  destination_unit_id?: string
  // Sponsor assignment fields
  assigned_sponsor_edipi?: string
  assigned_sponsor_name?: string
}
export const listSubmissions = async (user_id: string): Promise<MyFormSubmission[]> => {
  return await sbListSubmissions(user_id)
}

export const createSubmission = async (submission: Omit<MyFormSubmission, 'id' | 'created_at'>): Promise<MyFormSubmission> => {
  return await sbCreateSubmission(submission)
}

export const deleteSubmission = async (_user_id: string, id: number): Promise<void> => {
  await sbDeleteSubmission(id)
}
