/**
 * Connected history panel: owns the API calls, maps errors and hands the
 * restored content back to the page that owns the editor.
 */
import { versionsApi } from './api'
import type { VersionsApi } from './api'
import { VersionHistoryPanel } from './components/VersionHistoryPanel'
import { VERSION_LOAD_ERROR_FALLBACK, versionsErrorMessage } from './messages'
import { useRestoreVersion, useRoomVersions } from './queries'
import type { CodeVersion } from './types'
import type { RoomStatus } from '../rooms'

type VersionHistoryProps = {
  roomId: string
  roomStatus: RoomStatus
  /** Applies the restored content to the editor owned by the page. */
  onRestored: (content: string) => void
  api?: VersionsApi
}

export function VersionHistory({
  roomId,
  roomStatus,
  onRestored,
  api = versionsApi,
}: VersionHistoryProps) {
  const versionsQuery = useRoomVersions(roomId, api)
  const restore = useRestoreVersion(roomId, api)

  const errorMessage = versionsQuery.error
    ? versionsErrorMessage(versionsQuery.error, VERSION_LOAD_ERROR_FALLBACK)
    : null

  async function handleRestore(version: CodeVersion) {
    const restored = await restore.mutateAsync(version.id)
    onRestored(restored.content)
  }

  return (
    <VersionHistoryPanel
      versions={versionsQuery.data ?? []}
      isLoading={versionsQuery.isLoading}
      errorMessage={errorMessage}
      canRestore={roomStatus === 'active'}
      onRetry={() => {
        void versionsQuery.refetch()
      }}
      onRestore={handleRestore}
    />
  )
}
