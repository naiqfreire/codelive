import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { VersionHistory, versionKeys } from '../../features/versions'
import OwnerRoomPage from '../pages/OwnerRoomPage'
import { useDevRoomConnection } from './devConnection'
import { createDevVersionsApi, resetDevVersions } from './devVersions'
import type { DevVersionsState } from './devVersions'
import { findSampleRoom } from './sampleRooms'

const STATES: Array<{ value: DevVersionsState; label: string }> = [
  { value: 'list', label: 'Lista' },
  { value: 'empty', label: 'Vazio' },
  { value: 'loading', label: 'Carregando' },
  { value: 'error', label: 'Erro' },
]

/**
 * Development-only entry point that resolves the room from the fixture.
 *
 * The history panel is wired to an in-memory API plus a state switcher, so
 * empty/loading/error and the restore flow can be reviewed without a session.
 */
export default function DevOwnerRoomPage() {
  const { roomId } = useParams()
  const room = findSampleRoom(roomId)
  const connection = useDevRoomConnection(room, 'owner')
  const queryClient = useQueryClient()
  const [state, setState] = useState<DevVersionsState>('list')
  const api = useMemo(() => createDevVersionsApi(state), [state])

  function changeState(next: DevVersionsState) {
    resetDevVersions()
    queryClient.removeQueries({ queryKey: versionKeys.all })
    setState(next)
  }

  return (
    <div className="space-y-6">
      <OwnerRoomPage
        room={room}
        connection={connection}
        renderVersionHistory={
          room
            ? (onRestored) => (
                <VersionHistory
                  key={state}
                  roomId={room.id}
                  roomStatus={room.status}
                  onRestored={onRestored}
                  api={api}
                />
              )
            : undefined
        }
      />

      {room ? (
        <section
          aria-labelledby="dev-versions-heading"
          className="rounded-xl border border-dashed border-border p-4"
        >
          <h2 id="dev-versions-heading" className="text-sm font-medium text-foreground">
            DEV · estados do histórico
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {STATES.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={state === option.value}
                onClick={() => changeState(option.value)}
                className={[
                  'inline-flex min-h-11 cursor-pointer items-center rounded-lg border px-4 text-sm transition',
                  'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none',
                  state === option.value
                    ? 'border-accent bg-accent text-accent-foreground'
                    : 'border-border bg-surface text-foreground hover:bg-secondary',
                ].join(' ')}
              >
                {option.label}
              </button>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
