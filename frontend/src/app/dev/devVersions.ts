import { ApiError } from '../../shared/http'
import type { VersionsApi } from '../../features/versions'
import type { CodeVersion, RestoredVersion } from '../../features/versions'

/**
 * Development-only versions API for the room fixture.
 *
 * The real room screens are still fixtures, so the DEV page needs an in-memory
 * API to review the panel and the restore flow without a backend session.
 */
export type DevVersionsState = 'list' | 'empty' | 'loading' | 'error'

const OWNER_ID = '6f1c2a10-0000-4000-8000-0000000000ff'

const SAMPLE_VERSIONS: CodeVersion[] = [
  {
    id: '7a1c2a10-0000-4000-8000-000000000001',
    createdAt: '2026-11-10T12:00:00Z',
    contentHash: '1f'.repeat(32),
    language: 'python',
    authorId: null,
  },
  {
    id: '7a1c2a10-0000-4000-8000-000000000002',
    createdAt: '2026-11-10T12:00:30Z',
    contentHash: '2a'.repeat(32),
    language: 'python',
    authorId: null,
  },
  {
    id: '7a1c2a10-0000-4000-8000-000000000003',
    createdAt: '2026-11-10T12:01:00Z',
    contentHash: '3b'.repeat(32),
    language: 'python',
    authorId: OWNER_ID,
  },
  {
    id: '7a1c2a10-0000-4000-8000-000000000004',
    createdAt: '2026-11-10T12:04:00Z',
    contentHash: '4c'.repeat(32),
    language: 'java',
    authorId: null,
  },
  {
    id: '7a1c2a10-0000-4000-8000-000000000005',
    createdAt: '2026-11-10T12:08:00Z',
    contentHash: '5d'.repeat(32),
    language: 'java',
    authorId: null,
  },
  {
    id: '7a1c2a10-0000-4000-8000-000000000006',
    createdAt: '2026-11-10T12:12:00Z',
    contentHash: '6e'.repeat(32),
    language: 'java',
    authorId: OWNER_ID,
  },
]

const SAMPLE_CONTENT: Record<string, string> = {
  '7a1c2a10-0000-4000-8000-000000000001': 'def soma(a, b):\n    return a + b\n',
  '7a1c2a10-0000-4000-8000-000000000002':
    'def soma(a, b):\n    return a + b\n\n\nprint(soma(2, 3))\n',
  '7a1c2a10-0000-4000-8000-000000000003':
    'def soma(a, b):\n    return a + b\n\n\nprint(soma(10, 20))\n',
  '7a1c2a10-0000-4000-8000-000000000004':
    'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Olá");\n    }\n}\n',
  '7a1c2a10-0000-4000-8000-000000000005':
    'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Olá, turma!");\n    }\n}\n',
  '7a1c2a10-0000-4000-8000-000000000006':
    'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Restaurado");\n    }\n}\n',
}

let rows: CodeVersion[] = SAMPLE_VERSIONS

function restoreDevVersion(versionId: string): RestoredVersion {
  const source = rows.find((version) => version.id === versionId)
  const content = SAMPLE_CONTENT[versionId] ?? ''
  const now = Date.now()
  const created: CodeVersion = {
    id: `dev-${now}`,
    createdAt: new Date(now).toISOString(),
    contentHash: `dev-${now}`,
    language: source?.language ?? 'python',
    authorId: OWNER_ID,
  }

  rows = [...rows, created]

  return {
    content,
    contentHash: created.contentHash,
    id: created.id,
    createdAt: created.createdAt,
  }
}

export function createDevVersionsApi(state: DevVersionsState): VersionsApi {
  return {
    async list() {
      if (state === 'loading') {
        return new Promise<CodeVersion[]>(() => {})
      }
      if (state === 'error') {
        throw new ApiError(500, 'internal_error', 'Erro simulado no histórico.', null)
      }
      if (state === 'empty') {
        return []
      }
      return [...rows]
    },
    async restore(_roomId, versionId) {
      return restoreDevVersion(versionId)
    },
  }
}

export function resetDevVersions() {
  rows = SAMPLE_VERSIONS
}
