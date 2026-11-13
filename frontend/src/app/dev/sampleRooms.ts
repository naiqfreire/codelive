import type { RoomDetail } from '../../features/rooms'

/**
 * Fixture used only when `import.meta.env.DEV` is true, so the layout can be
 * reviewed before the API integration exists. Never bundled in production.
 */
export const SAMPLE_ROOMS: RoomDetail[] = [
  {
    id: '6f1c2a10-0000-4000-8000-000000000001',
    accessCode: 'K7M2QX',
    language: 'python',
    status: 'active',
    createdAt: '2026-11-09T17:30:00Z',
    code: "def soma(a, b):\n    return a + b\n\n\nprint(soma(2, 3))\n",
  },
  {
    id: '6f1c2a10-0000-4000-8000-000000000002',
    accessCode: 'B4T9RS',
    language: 'java',
    status: 'active',
    createdAt: '2026-11-08T13:10:00Z',
    code: 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Olá, turma!");\n    }\n}\n',
  },
  {
    id: '6f1c2a10-0000-4000-8000-000000000003',
    accessCode: 'Z2Y8NM',
    language: 'javascript',
    status: 'active',
    createdAt: '2026-11-06T19:45:00Z',
    code: "const numeros = [1, 2, 3, 4]\nconst dobrados = numeros.map((n) => n * 2)\nconsole.log(dobrados)\n",
  },
  {
    id: '6f1c2a10-0000-4000-8000-000000000004',
    accessCode: 'H5P1VC',
    language: 'c',
    status: 'closed',
    createdAt: '2026-10-30T11:00:00Z',
    code: '#include <stdio.h>\n\nint main(void) {\n    printf("Hello, world!\\n");\n    return 0;\n}\n',
  },
  {
    id: '6f1c2a10-0000-4000-8000-000000000005',
    accessCode: 'R3D6WF',
    language: 'php',
    status: 'closed',
    createdAt: '2026-10-24T08:20:00Z',
    code: '<?php\n$turma = ["Ana", "Bruno", "Carla"];\n\nforeach ($turma as $aluno) {\n    echo $aluno . "\\n";\n}\n',
  },
  {
    id: '6f1c2a10-0000-4000-8000-000000000006',
    accessCode: 'N8J4KL',
    language: 'python',
    status: 'closed',
    createdAt: '2026-10-18T21:05:00Z',
    code: 'from datetime import date\n\nprint(date.today())\n',
  },
]

export function findSampleRoom(id: string | undefined): RoomDetail | undefined {
  return SAMPLE_ROOMS.find((room) => room.id === id)
}
