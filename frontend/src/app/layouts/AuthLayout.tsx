import { Outlet } from 'react-router-dom'

export function AuthLayout() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto grid min-h-screen w-full max-w-6xl lg:grid-cols-2">
        <aside className="hidden flex-col justify-between border-r border-border bg-surface/60 p-10 lg:flex">
          <div>
            <p className="font-mono text-sm tracking-[0.3em] text-accent uppercase">CodeLive</p>
            <h1 className="mt-6 max-w-sm font-mono text-4xl font-semibold tracking-tight">
              Compartilhe código ao vivo, sem atrito.
            </h1>
            <p className="mt-4 max-w-sm text-muted-foreground">
              Crie uma sala, escolha a linguagem e convide a turma com um código de acesso.
            </p>
          </div>
          <p className="font-mono text-xs text-muted-foreground">
            Python · Java · C · PHP · JavaScript
          </p>
        </aside>

        <main className="flex items-center justify-center px-6 py-12">
          <div className="w-full max-w-md">
            <div className="mb-8 lg:hidden">
              <p className="font-mono text-sm tracking-[0.3em] text-accent uppercase">CodeLive</p>
            </div>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
