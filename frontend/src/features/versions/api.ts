/**
 * HTTP client for the versions slice.
 *
 * Both routes are owner-only on the server (`GET /versions` and
 * `POST /versions/{id}/restore`); the client never decides authorization.
 */
import { apiRequest } from '../../shared/http'
import type { RoomLanguage } from '../rooms'
import type { CodeVersion, RestoredVersion } from './types'

type VersionResponse = {
  id: string
  created_at: string
  content_hash: string
  language: RoomLanguage
  author_id: string | null
}

type RestoreResponse = {
  content: string
  content_hash: string
  id: string
  created_at: string
}

export type VersionsApi = {
  list(roomId: string): Promise<CodeVersion[]>
  restore(roomId: string, versionId: string): Promise<RestoredVersion>
}

/** Mirrors the backend `VersionOut` payload in camelCase. */
export function toCodeVersion(version: VersionResponse): CodeVersion {
  return {
    id: version.id,
    createdAt: version.created_at,
    contentHash: version.content_hash,
    language: version.language,
    authorId: version.author_id,
  }
}

/** Mirrors the backend `RestoreResponse` payload in camelCase. */
export function toRestoredVersion(response: RestoreResponse): RestoredVersion {
  return {
    content: response.content,
    contentHash: response.content_hash,
    id: response.id,
    createdAt: response.created_at,
  }
}

export const versionsApi: VersionsApi = {
  async list(roomId) {
    const versions = await apiRequest<VersionResponse[]>(
      `/api/rooms/${encodeURIComponent(roomId)}/versions`,
    )
    return versions.map(toCodeVersion)
  },

  async restore(roomId, versionId) {
    const response = await apiRequest<RestoreResponse>(
      `/api/rooms/${encodeURIComponent(roomId)}/versions/${encodeURIComponent(versionId)}/restore`,
      { method: 'POST' },
    )
    return toRestoredVersion(response)
  },
}
