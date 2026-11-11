import { create } from 'zustand'
import { RACERS_CONFIG, TRACK_START_X, ADMIN_PASSWORD } from '../constants'

const useStore = create((set, get) => ({
  // Auth / Lobby
  screen: 'lobby', // 'lobby' | 'game'
  nickname: '',
  isAdmin: false,

  setNickname: (name) => set({ nickname: name }),
  enterGame: (nickname, isAdmin) =>
    set({ screen: 'game', nickname, isAdmin }),
  returnToLobby: () =>
    set({ screen: 'lobby', nickname: '', isAdmin: false }),

  // Game state
  round: 1,
  phase: 'BETTING', // BETTING | COUNTDOWN | RACING | RESULT
  wallet: 1000,
  selectedRacerId: 0,
  betAmount: 100,
  isBettingModalOpen: false, // NPC에게 말을 걸었을 때 열림
  cameraMode: 'spectator',
  drawerCollapsed: false,
  raceStartTime: 0,
  raceElapsed: 0,
  countdownNumber: 3, // 3, 2, 1, 0(=GO!)
  finishOrder: [],
  broadcastText: '심해 아레나 오픈! NPC 배팅도우미에게 다가가 조개(🐚)를 배팅하세요.',
  muted: false,
  isMobileRotate: false, // 가로 강제 회전 모드

  toggleMobileRotate: () => set((s) => ({ isMobileRotate: !s.isMobileRotate })),

  // Online users & Firebase status
  onlineUsers: {},
  connectionStatus: 'connecting', // 'connecting' | 'connected' | 'error' | 'permission_denied' | 'offline'
  connectionErrorMsg: '',

  setConnectionStatus: (status, msg = '') => set({ connectionStatus: status, connectionErrorMsg: msg }),
  setOnlineUsers: (users) => set({ onlineUsers: users }),
  updateOnlineUser: (id, data) =>
    set((s) => ({
      onlineUsers: { ...s.onlineUsers, [id]: { ...s.onlineUsers[id], ...data } },
    })),
  removeOnlineUser: (id) =>
    set((s) => {
      const copy = { ...s.onlineUsers }
      delete copy[id]
      return { onlineUsers: copy }
    }),

  // Actions
  setPhase: (phase) => set({ phase }),
  setWallet: (wallet) => set({ wallet }),
  setCameraMode: (cameraMode) => set({ cameraMode }),
  setDrawerCollapsed: (drawerCollapsed) => set({ drawerCollapsed }),
  setSelectedRacerId: (selectedRacerId) => set({ selectedRacerId }),
  setBetAmount: (betAmount) => set({ betAmount }),
  setRaceStartTime: (t) => set({ raceStartTime: t }),
  setRaceElapsed: (t) => set({ raceElapsed: t }),
  setCountdownNumber: (n) => set({ countdownNumber: n }),
  setFinishOrder: (order) => set({ finishOrder: order }),
  setBroadcastText: (text) => set({ broadcastText: text }),
  setMuted: (muted) => set({ muted }),
  setRound: (round) => set({ round }),
  setBettingModalOpen: (open) => set({ isBettingModalOpen: open }),

  selectRacer: (id) => {
    const s = get()
    if (s.phase !== 'BETTING') return
    set({ selectedRacerId: id })
  },

  adjustBet: (delta) => {
    const s = get()
    if (s.phase !== 'BETTING') return
    set({ betAmount: Math.min(s.wallet, Math.max(0, s.betAmount + delta)) })
  },

  setBetHalf: () => {
    const s = get()
    if (s.phase !== 'BETTING') return
    set({ betAmount: Math.max(10, Math.floor(s.wallet / 2)) })
  },

  setBetMax: () => {
    const s = get()
    if (s.phase !== 'BETTING') return
    set({ betAmount: s.wallet })
  },

  resetBet: () => {
    const s = get()
    if (s.phase !== 'BETTING') return
    set({ betAmount: Math.min(50, s.wallet) })
  },

  refillClams: () => {
    const s = get()
    set({
      wallet: s.wallet + 500,
      betAmount: s.betAmount === 0 ? 100 : s.betAmount,
      broadcastText: '🐚 무료 조개 충전 완료! 지갑에 +500 조개가 지급되었습니다.',
    })
  },

  deductBet: () => {
    const s = get()
    set({ wallet: s.wallet - s.betAmount })
  },

  addWinnings: (amount) => {
    const s = get()
    set({ wallet: s.wallet + amount })
  },

  prepareNextRound: () => {
    const s = get()
    const newRound = s.round + 1
    let newWallet = s.wallet
    let text = `🌊 ROUND ${newRound} 배팅이 시작되었습니다! 우승할 해양생물을 선택하세요.`
    if (newWallet < 50) {
      newWallet += 300
      text = '🐚 파산 구조 지원금 +300 조개가 지급되었습니다! 다시 도전하세요!'
    }
    set({
      round: newRound,
      phase: 'BETTING',
      wallet: newWallet,
      betAmount: Math.min(100, newWallet),
      raceElapsed: 0,
      countdownNumber: 3,
      finishOrder: [],
      cameraMode: 'spectator',
      drawerCollapsed: false,
      broadcastText: text,
    })
  },
}))

export default useStore
