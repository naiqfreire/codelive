import type { RoomLanguage } from '../rooms'

/**
 * One immutable code snapshot, mirrored from the backend `VersionOut`.
 *
 * The listing is hash-only (backend D-07): `content` is never part of this
 * contract, so the panel cannot preview the code of a past version.
 */
export type CodeVersion = {
  id: string
  createdAt: string
  contentHash: string
  language: RoomLanguage
  /** `null` for a snapshot written by the job; set when the owner restored. */
  authorId: string | null
}

/**
 * Result of restoring a version (`RestoreResponse`): the restored content plus
 * the identity of the NEW version created by the restore.
 */
export type RestoredVersion = {
  content: string
  contentHash: string
  id: string
  createdAt: string
}
