# Process Point - Application Flow Analysis & Issues Report

**Date:** 2025-12-09
**Analyst:** Claude
**Status:** Critical Issues Identified

---

## Executive Summary

The application has a **critical architectural issue** causing the Task Manager dashboard to not display pending tasks. The root cause is a **three-layer data storage architecture** where different parts of the app read from and write to different storage layers without synchronization.

### Critical Issues:
1. ❌ **Task Manager Dashboard shows no pending tasks** - reads from static JSON files that never update
2. ❌ **Supabase tables defined but not consistently used** - major disconnect between schema and implementation
3. ❌ **Form submissions only go to localStorage** - never reach Task Managers
4. ❌ **Member progress updates not persisted** - static files never updated

---

## Architecture Overview

### Three Storage Layers (PROBLEM!)

```
┌─────────────────────────────────────────────────────────────┐
│                     APPLICATION                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  WRITES TO:                    READS FROM:                  │
│  ├─ Supabase (sometimes)       ├─ Local JSON (static)       │
│  ├─ LocalStorage (often)       ├─ Supabase (sometimes)      │
│  └─ Nothing (lost data!)       └─ LocalStorage (often)      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 1. **Supabase Database** (PostgreSQL)
- **Purpose:** Intended for persistent storage
- **Status:** Tables exist but MINIMALLY used
- **Controlled by:** `VITE_USE_SUPABASE` environment variable

### 2. **Local JSON Files** (Public folder)
- **Location:** `/public/data/`
- **Purpose:** Static demo data
- **Status:** READ-ONLY, never updated by the app
- **Examples:**
  - `/data/users/users_index.json`
  - `/data/members/progress_{user_id}.json`
  - `/data/units/index.json`

### 3. **LocalStorage** (Browser)
- **Purpose:** In-memory storage for forms, tasks, submissions
- **Status:** Actively used but NOT synced with other layers
- **Keys:**
  - `unit_tasks_store` - tasks created in TaskManager
  - `unit_forms_store` - form definitions
  - `my_items_store` - user's personal items
  - `my_form_submissions` - form submissions

---

## Supabase Tables Analysis

### Tables Defined in Migrations

| Table | Migration File | Actually Used? | Read From? | Written To? | Issue |
|-------|---------------|----------------|------------|-------------|-------|
| `users` | init.sql | ✅ Yes | ✅ Yes (when VITE_USE_SUPABASE=1) | ✅ Yes (registration) | Working correctly |
| `members_progress` | init.sql | ❌ No | ❌ **NEVER READ** | ✅ Yes (registration only) | **Written but never read!** |
| `unit_sections` | unit_config.sql | ✅ Yes | ✅ Yes | ✅ Yes | Working correctly |
| `unit_sub_tasks` | unit_config.sql | ❌ No | ❌ **NO** | ❌ **NO** | **App uses localStorage instead!** |
| `unit_admins` | unit_admins.sql | ⚠️ Partial | ⚠️ Minimal | ⚠️ Minimal | Underutilized |
| `unit_admin_assignments` | add_admin_ruc_assignments.sql | ❌ No | ❌ **NEVER** | ❌ **NEVER** | **Completely unused!** |

### Tables Referenced But NOT in Migrations

| Table | Used By | Storage Type | Issue |
|-------|---------|--------------|-------|
| `unit_companies` | supabaseUnitConfigService.ts | Supabase queries exist | **Migration missing!** Table doesn't exist in DB |
| `unit_forms` | formsStore.ts | LocalStorage only | Should be in Supabase |
| `my_items` | myItemsStore.ts | LocalStorage only | Should be in Supabase |
| `my_form_submissions` | myFormSubmissionsStore.ts | LocalStorage only | Should be in Supabase |

---

## Critical Issue #1: Task Manager Dashboard

### Current Behavior (BROKEN)

**File:** `src/pages/TaskManagerDashboard.tsx`

```typescript
// Line 67: Reading member progress from STATIC JSON files
const progress = await getProgressByMember(m.member_user_id)

// getProgressByMember() in localDataService.ts (line 92-104):
return await fetchJson<MemberProgress>(`/data/members/progress_${memberUserId}.json`)
```

### The Problem

1. **User submits a form** → Saved to `localStorage` (myFormSubmissionsStore)
2. **Task Manager checks for pending tasks** → Reads from `/data/members/progress_{user_id}.json` (static file)
3. **Static file never updates** → Task Manager sees NO pending tasks
4. **Result:** Inbound/Outbound tabs are always empty!

### Why It Fails

```
USER FLOW (BROKEN):
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│ User submits │ ──→  │ localStorage │  ✗   │ Task Manager │
│ form/task    │      │ (isolated)   │      │ (reads JSON) │
└──────────────┘      └──────────────┘      └──────────────┘
                               │                      │
                               ✗                      ↓
                         Never syncs!         Sees empty progress
```

### Expected Flow (SHOULD BE):

```
USER FLOW (CORRECT):
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│ User submits │ ──→  │   Supabase   │ ←──  │ Task Manager │
│ form/task    │      │members_progress     │ (queries DB) │
└──────────────┘      └──────────────┘      └──────────────┘
```

### Evidence in Code

**TaskManagerDashboard.tsx:66-79** - Building inbound/outbound lists:
```typescript
for (const m of members.filter(m => m.unit_id === user.unit_id)) {
  const progress = await getProgressByMember(m.member_user_id)  // ← READS STATIC FILE
  for (const t of progress.progress_tasks) {
    if (responsibleSet.has(t.sub_task_id)) {
      if (t.status === 'Pending') {
        inbound[t.sub_task_id] = [...(inbound[t.sub_task_id] || []), m.member_user_id]
      }
    }
  }
}
```

**localDataService.ts:92-104** - Always reads static files:
```typescript
export const getProgressByMember = async (memberUserId: string): Promise<MemberProgress> => {
  try {
    return await fetchJson<MemberProgress>(`/data/members/progress_${memberUserId}.json`)
  } catch {
    return { /* empty progress */ }
  }
}
```

**NO Supabase integration** for reading member progress in TaskManager!

---

## Critical Issue #2: Form Submission Flow

### Current Implementation (BROKEN)

**MyDashboard.tsx** - When user clicks "Save" on a form preview:

```typescript
// Line 320-324
onClick={() => {
  if (!submissionPreview) return
  const { id, created_at, ...rest } = submissionPreview
  const saved = createSubmission(rest)  // ← Goes to localStorage only!
  setSubmissionPreview(null)
}}
```

**myFormSubmissionsStore.ts:46-54** - Saves to localStorage:
```typescript
export const createSubmission = (submission: Omit<MyFormSubmission, 'id' | 'created_at'>): MyFormSubmission => {
  const map = load()  // ← localStorage.getItem('my_form_submissions')
  const id = Date.now()
  const full: MyFormSubmission = { ...submission, id, created_at: new Date().toISOString() }
  const list = map[submission.user_id] || []
  map[submission.user_id] = [...list, full]
  save(map)  // ← localStorage.setItem()
  return full
}
```

### The Problem

1. Form submissions **ONLY go to localStorage**
2. **NO update to member progress** in Supabase or JSON files
3. Task Managers **NEVER see these submissions**
4. Data is **lost when browser cache clears**

---

## Critical Issue #3: Task Management Confusion

### Two Different Task Systems

The app has **TWO separate implementations** of tasks:

#### System 1: Static JSON Checklist (READ-ONLY)
- **Location:** `/data/units/unit_*/checklist.json`
- **Used by:** TaskManager inbound/outbound tabs
- **Structure:**
  ```json
  {
    "sections": [{
      "section_name": "S1",
      "sub_tasks": [{
        "sub_task_id": "S1-01",
        "description": "Admin check",
        "responsible_user_id": ["1001", "2001"]
      }]
    }]
  }
  ```

#### System 2: LocalStorage Tasks (CRUD Operations)
- **Location:** `localStorage['unit_tasks_store']`
- **Used by:** TaskManager "Tasks" tab
- **Service:** `src/utils/unitTasks.ts`
- **Operations:** Create, update, delete tasks

### The Problem

- **System 1** defines which tasks exist and who's responsible
- **System 2** allows creating NEW tasks in the Tasks tab
- **NO SYNCHRONIZATION** between the two!
- Tasks created in System 2 **DON'T appear in inbound/outbound tabs**
- Inbound/outbound tabs **ONLY read from System 1** (static JSON)

### Evidence

**unitTasks.ts:38-42** - Reads/writes localStorage:
```typescript
export const listSubTasks = async (unit_id: string): Promise<UnitSubTask[]> => {
  const store = loadStore()  // ← localStorage.getItem('unit_tasks_store')
  const data = ensureUnit(store, unit_id)
  return data.tasks
}
```

**TaskManagerDashboard.tsx:43-50** - Reads static JSON:
```typescript
const checklist = await getChecklistByUnit(user.unit_id)  // ← Reads /data/units/*/checklist.json
const labels: Record<string, { section_name: string; description: string }> = {}
for (const sec of checklist.sections) {
  for (const st of sec.sub_tasks) {
    labels[st.sub_task_id] = { section_name: sec.section_name, description: st.description }
  }
}
```

---

## Data Flow Diagrams

### Current (Broken) Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER ACTIONS                            │
└─────────────────────────────────────────────────────────────────┘
                                │
                    ┌───────────┴──────────┐
                    ↓                      ↓
         ┌──────────────────┐   ┌──────────────────┐
         │ Submit Form      │   │ Create Task      │
         │ (MyDashboard)    │   │ (TaskManager)    │
         └──────────────────┘   └──────────────────┘
                    │                      │
                    ↓                      ↓
         ┌──────────────────┐   ┌──────────────────┐
         │  localStorage    │   │  localStorage    │
         │ (submissions)    │   │   (tasks)        │
         └──────────────────┘   └──────────────────┘
                    ↓                      ↓
                  LOST!                  ISOLATED!
                    │                      │
                    ✗ ←──────────────────→ ✗
                 Never reaches Task Manager

┌─────────────────────────────────────────────────────────────────┐
│                    TASK MANAGER READS                           │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ↓
                    ┌──────────────────────┐
                    │  Static JSON Files   │
                    │  (never updated)     │
                    └──────────────────────┘
                                │
                                ↓
                    ┌──────────────────────┐
                    │  Shows EMPTY tabs    │
                    └──────────────────────┘
```

### Correct (Target) Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER ACTIONS                            │
└─────────────────────────────────────────────────────────────────┘
                                │
                    ┌───────────┴──────────┐
                    ↓                      ↓
         ┌──────────────────┐   ┌──────────────────┐
         │ Submit Form      │   │ Create Task      │
         │ (MyDashboard)    │   │ (TaskManager)    │
         └──────────────────┘   └──────────────────┘
                    │                      │
                    └──────────┬───────────┘
                               ↓
                    ┌──────────────────────┐
                    │     SUPABASE DB      │
                    │                      │
                    │ • members_progress   │
                    │ • unit_sub_tasks     │
                    │ • my_form_submissions│
                    └──────────────────────┘
                               ↑
                               │
┌─────────────────────────────────────────────────────────────────┐
│                    TASK MANAGER READS                           │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ↓
                    ┌──────────────────────┐
                    │ Shows LIVE pending   │
                    │ tasks & submissions  │
                    └──────────────────────┘
```

---

## Role-Based Access Control

### Implementation Status

| Role | Dashboard | Access Level | Status |
|------|-----------|--------------|--------|
| **Member** | MyDashboard | Own forms/tasks only | ✅ Working |
| **Section Manager** | MyDashboard | Section members + own items | ⚠️ Logic exists but data flow broken |
| **Task Manager** | TaskManagerDashboard | Assigned tasks (inbound/outbound) | ❌ **BROKEN - shows nothing** |
| **Unit Admin** | UnitAdminDashboard | Full unit management | ⚠️ Works but uses localStorage |
| **App Admin** | AdminDashboard | Cross-unit management | ⚠️ Partial implementation |

### Task Manager Logic (Correct but No Data)

**TaskManagerDashboard.tsx:57-62** - Correctly identifies which tasks the manager is responsible for:
```typescript
const responsibleSet = new Set<string>()
for (const sec of checklist.sections) {
  for (const st of sec.sub_tasks) {
    if (st.responsible_user_id.some(id => sectionIds.has(id))) {
      responsibleSet.add(st.sub_task_id)  // ← Correct logic!
    }
  }
}
```

**Problem:** The `progress.progress_tasks` array is ALWAYS EMPTY because:
1. It reads from static JSON files
2. Users submit forms to localStorage
3. The two never connect!

---

## Recommendations

### Priority 1: Fix Task Manager Dashboard (CRITICAL)

#### Option A: Quick Fix - Use Supabase for Member Progress
```typescript
// In localDataService.ts, update getProgressByMember:
export const getProgressByMember = async (memberUserId: string): Promise<MemberProgress> => {
  if (import.meta.env.VITE_USE_SUPABASE === '1') {
    // Read from Supabase members_progress table
    const { data } = await supabase
      .from('members_progress')
      .select('*')
      .eq('member_user_id', memberUserId)
      .single()
    return data || defaultProgress
  }
  // Fall back to JSON files for demo mode
  return await fetchJson<MemberProgress>(`/data/members/progress_${memberUserId}.json`)
}
```

#### Option B: Update Progress on Form Submission
```typescript
// In MyDashboard.tsx, when saving form submission:
const saved = createSubmission(rest)

// ALSO update member progress:
if (import.meta.env.VITE_USE_SUPABASE === '1') {
  await sbUpsertProgress({
    member_user_id: user.user_id,
    unit_id: user.unit_id,
    official_checkin_timestamp: new Date().toISOString(),
    progress_tasks: submissionPreview.tasks.map(t => ({
      sub_task_id: t.sub_task_id,
      status: 'Pending'
    }))
  })
}
```

### Priority 2: Unify Task Storage

**Current:** Two separate systems (JSON + localStorage)
**Target:** Single source of truth in Supabase

1. Migrate `unitTasks.ts` to use `supabaseUnitConfigService.ts`
2. Remove localStorage for tasks
3. Use `unit_sub_tasks` table consistently

### Priority 3: Missing Supabase Tables

Add migrations for:
```sql
-- unit_companies (referenced but missing)
CREATE TABLE IF NOT EXISTS public.unit_companies (
  id bigserial primary key,
  unit_id text not null,
  company_id text not null,
  display_name text
);

-- unit_forms
CREATE TABLE IF NOT EXISTS public.unit_forms (
  id bigserial primary key,
  unit_id text not null,
  name text not null,
  kind text not null,
  task_ids jsonb not null default '[]'::jsonb,
  purpose text
);

-- my_items
CREATE TABLE IF NOT EXISTS public.my_items (
  id bigserial primary key,
  user_id text not null,
  name text not null,
  kind text not null,
  form_id bigint,
  created_at timestamptz not null default now()
);

-- my_form_submissions
CREATE TABLE IF NOT EXISTS public.my_form_submissions (
  id bigserial primary key,
  user_id text not null,
  unit_id text not null,
  form_id bigint not null,
  form_name text not null,
  kind text not null,
  member jsonb not null,
  tasks jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
```

### Priority 4: Update Service Layer

**Pattern to follow:**
```typescript
export const getData = async () => {
  if (import.meta.env.VITE_USE_SUPABASE === '1') {
    return await fetchFromSupabase()
  }
  return await fetchFromLocalJSON()  // Demo mode only
}

export const saveData = async (data) => {
  if (import.meta.env.VITE_USE_SUPABASE === '1') {
    return await saveToSupabase(data)
  }
  // Demo mode: save to localStorage for session only
  saveToLocalStorage(data)
}
```

### Priority 5: Enable Row Level Security

All migrations have `disable row level security`. For production:
1. Enable RLS on all tables
2. Add policies based on user roles:
   - Members: Own records only
   - Section Managers: Section scope
   - Unit Admins: Unit scope
   - App Admins: All access

---

## Testing Checklist

### To Verify Task Manager Fix:

1. ✅ Register a new user as "Member" role
2. ✅ User submits an inbound form with tasks
3. ✅ Verify submission saved to `members_progress` table in Supabase
4. ✅ Login as Task Manager for that section
5. ✅ Navigate to TaskManager → Inbound tab
6. ✅ **Verify pending tasks appear for the member**
7. ✅ Task Manager clears a task
8. ✅ Task moves to Outbound tab with timestamp

### To Verify Form Flow:

1. ✅ Create form definition as Unit Admin
2. ✅ Assign tasks to the form
3. ✅ Member selects form and submits
4. ✅ Section Manager sees submission
5. ✅ Task Manager sees pending checklist items
6. ✅ All roles see consistent data

---

## File References

### Key Files to Modify:

| File | Line(s) | Issue | Fix Required |
|------|---------|-------|--------------|
| `src/services/localDataService.ts` | 92-104 | Always reads static JSON | Add Supabase branch for getProgressByMember |
| `src/pages/MyDashboard.tsx` | 320-324 | Only saves to localStorage | Add sbUpsertProgress call |
| `src/utils/unitTasks.ts` | 38-79 | Uses localStorage for tasks | Migrate to supabaseUnitConfigService |
| `src/pages/TaskManagerDashboard.tsx` | 66-79 | Reads stale data | Will work once localDataService fixed |
| `supabase/migrations/` | N/A | Missing table migrations | Add unit_companies, unit_forms, my_items, my_form_submissions |

### Services Architecture:

```
src/services/
├── localDataService.ts      ← Main data service (needs Supabase integration)
├── supabaseClient.ts        ← Supabase connection
├── supabaseDataService.ts   ← User auth (works!)
└── supabaseUnitConfigService.ts ← Unit structure (works!)

src/utils/
├── unitTasks.ts             ← localStorage (needs migration to Supabase)
├── formsStore.ts            ← localStorage (needs migration to Supabase)
├── myItemsStore.ts          ← localStorage (needs migration to Supabase)
└── myFormSubmissionsStore.ts ← localStorage (needs migration to Supabase)
```

---

## Summary

### Root Cause
**Three disconnected storage layers** with no synchronization:
- Supabase tables exist but aren't consistently used
- Task Manager reads from static JSON files
- User actions save to localStorage
- No connection between the layers!

### Impact
1. ❌ Task Manager dashboard is non-functional (empty inbound/outbound)
2. ❌ Form submissions disappear (lost in localStorage)
3. ❌ Task creation isolated (not visible to task managers)
4. ❌ Member progress never updates

### Solution
**Unify on Supabase** with localStorage as temporary fallback:
1. Read member progress from Supabase `members_progress` table
2. Write form submissions to Supabase AND update progress
3. Migrate task storage from localStorage to `unit_sub_tasks` table
4. Add missing table migrations
5. Enable RLS for production security

### Complexity
- **Quick fix:** Priority 1 (Option A or B) - 2-4 hours
- **Full migration:** All priorities - 1-2 days
- **Testing & validation:** 4-8 hours

---

**Next Steps:** Would you like me to implement the Priority 1 fix first to get the Task Manager working?
