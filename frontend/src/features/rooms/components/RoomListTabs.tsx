/**
 * In-page filter between the rooms the user owns and the rooms the user joined
 * as a spectator (RF03/RF04). Both lists live on their own URL so the choice
 * survives a refresh and can be linked to.
 */
import { NavLink } from 'react-router-dom'

const TAB_CLASSES = [
  'inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-medium transition',
  'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none',
].join(' ')

function tabClassName({ isActive }: { isActive: boolean }) {
  return [
    TAB_CLASSES,
    isActive ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground',
  ].join(' ')
}

export function RoomListTabs() {
  return (
    <nav
      aria-label="Filtro de salas"
      className="mb-6 inline-flex flex-wrap items-center gap-1 rounded-xl border border-border bg-surface/60 p-1"
    >
      <NavLink to="/rooms" end className={tabClassName}>
        Criadas por mim
      </NavLink>
      <NavLink to="/rooms/joined" className={tabClassName}>
        Participei
      </NavLink>
    </nav>
  )
}
