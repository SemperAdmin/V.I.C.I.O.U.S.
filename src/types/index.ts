export interface User {
  user_id: string
  edipi: string
  mos: string
  first_name?: string
  middle_initial?: string
  last_name?: string
  branch?: string
  rank?: string
  org_role: 'Unit_Admin' | 'Section_Manager' | 'Member' | 'App_Admin'
  is_unit_admin?: boolean
  is_app_admin?: boolean
  section_role?: 'Section_Reviewer' | 'Member'
  unit_id: string
  company_id?: string
  platoon_id?: string
  hashed_password: string
  created_at_timestamp: string
  updated_at_timestamp: string
}

export interface Repository {
  owner: string
  name: string
  full_name: string
  private: boolean
  updated_at: string
  default_branch?: string
}

export interface FileItem {
  path: string
  name: string
  type: 'file' | 'dir'
  size?: number
  sha: string
  content?: string
  encoding?: string
}

export interface Commit {
  sha: string
  message: string
  author: {
    name: string
    email: string
    date: string
  }
  html_url: string
}

export interface FileMetadata {
  path: string
  repository: string
  sha: string
  last_modified: string
  content_size: number
  lock_status: 'unlocked' | 'locked'
  lock_holder?: string
  lock_expires?: string | null
}
