import type { SaveData, Squad } from '../data/types'

export const MAX_SQUADS = 8

export function makeSquad(name: string, members: string[] = []): Squad {
  return {
    id: `squad-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`,
    name: name.trim().slice(0, 6) || '队伍',
    members: members.slice(0, 6),
  }
}

export function migrateSquads(save: SaveData, raw?: Partial<SaveData>): SaveData {
  if (raw && !raw.squads?.length) {
    const first = makeSquad('队伍1', raw.party ?? save.party ?? [])
    first.id = 'squad-1'
    return { ...save, squads: [first], activeSquadId: first.id, party: first.members }
  }
  if (save.squads?.length) {
    const active = save.squads.some((s) => s.id === save.activeSquadId)
      ? save.activeSquadId
      : save.squads[0].id
    const members = save.squads.find((s) => s.id === active)?.members ?? []
    return { ...save, activeSquadId: active, party: members }
  }
  const first = makeSquad('队伍1', save.party ?? [])
  first.id = 'squad-1'
  return { ...save, squads: [first], activeSquadId: first.id, party: first.members }
}

export function activeSquad(save: SaveData) {
  return save.squads.find((s) => s.id === save.activeSquadId) ?? save.squads[0]
}

export function withActiveMembers(save: SaveData, members: string[]): SaveData {
  const id = save.activeSquadId
  const squads = save.squads.map((s) => (s.id === id ? { ...s, members } : s))
  return { ...save, squads, party: members }
}
