export const PET_KEY = 'foco-pet'
export const FISH_PRICE = 5
export const MAX_INTIMACY = 100
export const XP_PER_LEVEL = 100

export type PetState = {
  xp: number
  minutes: number
  longest: number
  intimacy: number
  fish: number
  fed: number
  pats: number
  hugs: number
  kisses: number
}

export const emptyPet: PetState = {
  xp: 0, minutes: 0, longest: 0, intimacy: 0, fish: 0, fed: 0, pats: 0, hugs: 0, kisses: 0,
}

export function loadPet(): PetState {
  try {
    const saved = JSON.parse(localStorage.getItem(PET_KEY) || 'null')
    return saved ? { ...emptyPet, ...saved } : { ...emptyPet }
  } catch {
    return { ...emptyPet }
  }
}

export function savePet(pet: PetState) {
  try {
    localStorage.setItem(PET_KEY, JSON.stringify(pet))
  } catch {
    /* ignore storage errors */
  }
}

export const petLevel = (xp: number) => Math.floor(xp / XP_PER_LEVEL) + 1
export const petLevelProgress = (xp: number) => Math.round(((xp % XP_PER_LEVEL) / XP_PER_LEVEL) * 100)

export const FRIENDSHIP = [
  { id: 'pat', label: 'Pat', need: 30, copy: 'A gentle scratch behind the ears.' },
  { id: 'hug', label: 'Hug', need: 60, copy: 'Hold the little warm weight in your arms.' },
  { id: 'kiss', label: 'Kiss', need: 90, copy: 'A nose to nose moment.' },
] as const

export type AchievementContext = {
  sessions: number
  focusMinutes: number
  returns: number
  pet: PetState
}

export type Achievement = {
  id: string
  title: string
  copy: string
  symbol: string
  target: number
  secret?: boolean
  count: (context: AchievementContext) => number
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first-page', title: 'First Page', copy: 'Finish your first focus session', symbol: '01', target: 1, count: (c) => c.sessions },
  { id: 'quiet-hour', title: 'Quiet Hour', copy: 'Focus for sixty minutes in total', symbol: '60', target: 60, count: (c) => c.pet.minutes },
  { id: 'finding-flow', title: 'Finding Flow', copy: 'Finish five focus sessions', symbol: '05', target: 5, count: (c) => c.sessions },
  { id: 'forest-keeper', title: 'Forest Keeper', copy: 'Finish twenty focus sessions', symbol: '20', target: 20, count: (c) => c.sessions },
  { id: 'deep-blue', title: 'Deep Blue', copy: 'Stay focused for fifty minutes in one go', symbol: '50', target: 50, count: (c) => c.pet.longest },
  { id: 'gentle-return', title: 'Gentle Return', copy: 'Choose to come back to reading after drifting away', symbol: '↗', target: 1, count: (c) => c.returns },
  { id: 'first-fish', title: 'Fish in Hand', copy: 'Feed Foco for the first time', symbol: '🐟', target: 1, count: (c) => c.pet.fed },
  { id: 'fish-bowl', title: 'Fish Bowl', copy: 'Feed ten dried fish', symbol: '10', target: 10, count: (c) => c.pet.fed },
  { id: 'purr', title: 'Purr Purr', copy: 'Bond 30 — patting unlocked', symbol: '♡', target: 30, count: (c) => c.pet.intimacy },
  { id: 'warm-hug', title: 'Warm Hug', copy: 'Bond 60 — hugging unlocked', symbol: '❤', target: 60, count: (c) => c.pet.intimacy },
  { id: 'nose-kiss', title: 'A Tiny Secret', copy: 'Something is waiting at bond 90', symbol: '✦', target: 90, secret: true, count: (c) => c.pet.intimacy },
]
