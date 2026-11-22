import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, ChevronsUpDown, Plus, Building2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth.store'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export function WorkspaceSwitcher() {
  const { workspaces, currentWorkspace, setCurrentWorkspace } = useAuthStore()
  const navigate = useNavigate()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="w-full justify-between text-sidebar-foreground hover:bg-sidebar-accent px-2 h-9"
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-5 w-5 rounded bg-blue-500/20 flex items-center justify-center shrink-0">
              <Building2 className="h-3 w-3 text-blue-400" />
            </div>
            <span className="text-sm truncate">
              {currentWorkspace?.name || 'Select Workspace'}
            </span>
          </div>
          <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="start">
        <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {workspaces.map((workspace) => (
          <DropdownMenuItem
            key={workspace.id}
            onClick={() => setCurrentWorkspace(workspace)}
            className="cursor-pointer"
          >
            <Building2 className="mr-2 h-4 w-4" />
            <span className="flex-1 truncate">{workspace.name}</span>
            {currentWorkspace?.id === workspace.id && (
              <Check className="h-4 w-4 text-primary" />
            )}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate('/workspace/setup')} className="cursor-pointer">
          <Plus className="mr-2 h-4 w-4" />
          Create Workspace
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
