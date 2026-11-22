import { Outlet } from 'react-router-dom'

export function AuthLayout() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2">
            <div className="h-10 w-10 rounded-xl bg-blue-500 flex items-center justify-center">
              <span className="text-white font-bold text-lg">E</span>
            </div>
            <span className="text-2xl font-bold text-white">Emmil</span>
          </div>
          <p className="mt-2 text-slate-400 text-sm">Email Outreach Platform</p>
        </div>
        <Outlet />
      </div>
    </div>
  )
}
