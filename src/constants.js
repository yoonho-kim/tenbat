export const ADMIN_PASSWORD = 'aquaverse2024!'

export const TRACK_START_X = -52
export const TRACK_FINISH_X = 52
export const TRACK_LENGTH = TRACK_FINISH_X - TRACK_START_X

export const RACERS_CONFIG = [
  {
    id: 0,
    lane: 1,
    name: '총알 새우',
    emoji: '🦐',
    odds: 2.5,
    winProb: 38,
    colorHex: 0xff6b81,
    accentHex: 0xffa8b8,
    cssColor: '#fb7185',
    traitTitle: '폭발적 제트 부스트',
    baseSpeed: 11.4,
    laneZ: -9,
  },
  {
    id: 1,
    lane: 2,
    name: '옆걸음 꽃게',
    emoji: '🦀',
    odds: 1.8,
    winProb: 52,
    colorHex: 0xff6348,
    accentHex: 0xff9f43,
    cssColor: '#fb923c',
    traitTitle: '무기복 정속 주행',
    baseSpeed: 13.1,
    laneZ: -3,
  },
  {
    id: 2,
    lane: 3,
    name: '집게 랍스터',
    emoji: '🦞',
    odds: 2.2,
    winProb: 44,
    colorHex: 0xeb2f06,
    accentHex: 0xff5252,
    cssColor: '#ef4444',
    traitTitle: '초반 괴력 스퍼트',
    baseSpeed: 12.7,
    laneZ: 3,
  },
  {
    id: 3,
    lane: 4,
    name: '먹물 문어',
    emoji: '🐙',
    odds: 3.5,
    winProb: 28,
    colorHex: 0xa855f7,
    accentHex: 0xd8b4fe,
    cssColor: '#c084fc',
    traitTitle: '먹물 급가속 다크호스',
    baseSpeed: 10.9,
    laneZ: 9,
  },
]
