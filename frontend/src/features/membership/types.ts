export type JoinChoice = {
  nickname: string
  anonymous: boolean
}

/** Who is in the room, as shown in the participants panel. */
export type ParticipantRole = 'owner' | 'viewer'

export type Participant = {
  nickname: string
  role: ParticipantRole
}
