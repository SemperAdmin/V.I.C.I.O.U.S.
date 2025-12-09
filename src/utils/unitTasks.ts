import type { UnitSubTask as SUnitSubTask } from '@/services/supabaseUnitConfigService'
import { listSubTasks as sbListSubTasks, createSubTask as sbCreateSubTask, deleteSubTask as sbDeleteSubTask, updateSubTask as sbUpdateSubTask } from '@/services/supabaseUnitConfigService'

export type UnitSubTask = SUnitSubTask

export const listSubTasks = async (unit_id: string): Promise<UnitSubTask[]> => {
  return sbListSubTasks(unit_id)
}

export const createSubTask = async (payload: Omit<UnitSubTask, 'id'>): Promise<void> => {
  await sbCreateSubTask(payload)
}

export const deleteSubTask = async (id: number): Promise<void> => {
  await sbDeleteSubTask(id)
}

export const updateSubTask = async (id: number, patch: Partial<UnitSubTask>): Promise<void> => {
  await sbUpdateSubTask(id, patch)
}
