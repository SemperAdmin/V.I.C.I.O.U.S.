export interface User {
  user_id: string
  edipi: string
  mos: string
  first_name?: string
  middle_initial?: string
  last_name?: string
  email?: string
  phone_number?: string
  branch?: string
  rank?: string
  org_role: 'Unit_Admin' | 'Section_Manager' | 'Member' | 'App_Admin' | 'Insta_Admin'
  is_unit_admin?: boolean
  is_app_admin?: boolean
  is_insta_admin?: boolean
  section_role?: 'Section_Reviewer' | 'Member'
  unit_id: string
  company_id?: string
  platoon_id?: string
  installation_id?: string
  hashed_password: string
  created_at_timestamp: string
  updated_at_timestamp: string
}

export interface Installation {
  id: string
  name: string
  acronym?: string
  location?: string
  base_type?: string
  command?: string
  unit_ids: string[]
  sections: string[]
  section_assignments: Record<string, string[]>
  commander_user_id?: string
  insta_admin_user_ids: string[]
  created_at: string
  updated_at: string
}

export interface InstallationSection {
  id: number
  installation_id: string
  section_name: string
  display_name?: string
  physical_location?: string
  phone_number?: string
  created_at: string
}

export interface InstallationSubTask {
  id: number
  installation_id: string
  section_id: number
  sub_task_id: string
  description: string
  responsible_user_ids: string[]
  location?: string
  map_url?: string
  instructions?: string
  completion_kind?: 'Text' | 'Date' | 'Options' | 'Link'
  completion_label?: string
  completion_options?: string[]
  created_at: string
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
