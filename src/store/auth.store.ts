import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Profile, Workspace, WorkspaceMember } from '@/types/database'

interface AuthState {
  user: Profile | null
  currentWorkspace: Workspace | null
  currentMember: WorkspaceMember | null
  workspaces: Workspace[]
  setUser: (user: Profile | null) => void
  setCurrentWorkspace: (workspace: Workspace | null) => void
  setCurrentMember: (member: WorkspaceMember | null) => void
  setWorkspaces: (workspaces: Workspace[]) => void
  reset: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      currentWorkspace: null,
      currentMember: null,
      workspaces: [],
      setUser: (user) => set({ user }),
      setCurrentWorkspace: (currentWorkspace) => set({ currentWorkspace }),
      setCurrentMember: (currentMember) => set({ currentMember }),
      setWorkspaces: (workspaces) => set({ workspaces }),
      reset: () =>
        set({
          user: null,
          currentWorkspace: null,
          currentMember: null,
          workspaces: [],
        }),
    }),
    {
      name: 'emmil-auth',
      partialize: (state) => ({
        currentWorkspace: state.currentWorkspace,
      }),
    }
  )
)
