import { useEffect, useRef, useCallback } from 'react'
import {
  ref,
  onValue,
  set,
  update,
  remove,
  onDisconnect,
} from 'firebase/database'
import { db } from '../lib/firebaseClient'
import useStore from '../store/useStore'

// 고유 접속 ID 생성
const myId = crypto.randomUUID()

export function useRealtimeChannel() {
  const nickname = useStore((s) => s.nickname)
  const isAdmin = useStore((s) => s.isAdmin)
  const selectedRacerId = useStore((s) => s.selectedRacerId)
  const betAmount = useStore((s) => s.betAmount)
  const setOnlineUsers = useStore((s) => s.setOnlineUsers)

  const userRefRef = useRef(null)
  const chatRefRef = useRef(null)
  const cheerRefRef = useRef(null)
  const controlRefRef = useRef(null)

  useEffect(() => {
    if (!db || !nickname) return

    const connectedRef = ref(db, '.info/connected')
    const userRef = ref(db, `rooms/aqua-verse/users/${myId}`)
    const usersRef = ref(db, 'rooms/aqua-verse/users')
    const chatRef = ref(db, 'rooms/aqua-verse/latestChat')
    const cheerRef = ref(db, 'rooms/aqua-verse/latestCheer')
    const controlRef = ref(db, 'rooms/aqua-verse/gameControl')

    userRefRef.current = userRef
    chatRefRef.current = chatRef
    cheerRefRef.current = cheerRef
    controlRefRef.current = controlRef

    // 1. 접속 및 Presence 감지
    const unsubConnected = onValue(connectedRef, (snap) => {
      if (snap.val() === true) {
        // 탭 종료 또는 네트워크 끊김 시 자동 삭제
        onDisconnect(userRef).remove().catch(() => {})

        // 현재 유저 등록
        set(userRef, {
          userId: myId,
          nickname,
          isAdmin: !!isAdmin,
          avatarX: 400,
          avatarZ: 350,
          avatarRotY: 'down',
          betRacerId: selectedRacerId ?? 0,
          betAmount: betAmount ?? 100,
          joinedAt: Date.now(),
        }).catch((e) => console.warn('User register error:', e))
      }
    })

    // 2. 전체 온라인 유저 목록 실시간 동기화
    const unsubUsers = onValue(usersRef, (snap) => {
      try {
        const data = snap.val() || {}
        setOnlineUsers(data)
      } catch (e) {
        console.warn('Sync users error:', e)
      }
    })

    // 3. 실시간 말풍선 채팅 수신
    let lastHandledChatId = null
    const unsubChat = onValue(chatRef, (snap) => {
      const payload = snap.val()
      if (!payload || !payload.id || payload.id === lastHandledChatId) return
      lastHandledChatId = payload.id

      if (payload.userId !== myId && Date.now() - (payload.timestamp || 0) < 6000) {
        window.dispatchEvent(
          new CustomEvent('remote-chat', { detail: payload })
        )
      }
    })

    // 4. 응원 이모지 수신
    let lastHandledCheerId = null
    const unsubCheer = onValue(cheerRef, (snap) => {
      const payload = snap.val()
      if (!payload || !payload.id || payload.id === lastHandledCheerId) return
      lastHandledCheerId = payload.id

      if (payload.userId !== myId && Date.now() - (payload.timestamp || 0) < 6000) {
        window.dispatchEvent(
          new CustomEvent('remote-cheer', { detail: payload })
        )
      }
    })

    // 5. 관리자 게임 제어 (시작, 리필, 다음라운드) 수신
    let lastHandledControlId = null
    const unsubControl = onValue(controlRef, (snap) => {
      const payload = snap.val()
      if (!payload || !payload.id || payload.id === lastHandledControlId) return
      lastHandledControlId = payload.id

      if (payload.userId !== myId && Date.now() - (payload.timestamp || 0) < 10000) {
        if (payload.event === 'race_start') {
          window.dispatchEvent(
            new CustomEvent('remote-race-start', { detail: payload })
          )
        } else if (payload.event === 'refill') {
          window.dispatchEvent(
            new CustomEvent('remote-refill', { detail: payload })
          )
        } else if (payload.event === 'next_round') {
          window.dispatchEvent(
            new CustomEvent('remote-next-round', { detail: payload })
          )
        }
      }
    })

    return () => {
      unsubConnected()
      unsubUsers()
      unsubChat()
      unsubCheer()
      unsubControl()
      if (userRef) {
        remove(userRef).catch(() => {})
      }
      userRefRef.current = null
      chatRefRef.current = null
      cheerRefRef.current = null
      controlRefRef.current = null
    }
  }, [nickname, isAdmin, setOnlineUsers])

  // Presence/데이터 업데이트
  const updatePresence = useCallback(
    (data) => {
      if (!userRefRef.current) return
      update(userRefRef.current, {
        nickname,
        isAdmin: !!isAdmin,
        ...data,
      }).catch(() => {})
    },
    [nickname, isAdmin]
  )

  // 아바타 위치 브로드캐스트
  const broadcastAvatarMove = useCallback((x, z, rotY) => {
    if (!userRefRef.current) return
    update(userRefRef.current, {
      avatarX: x,
      avatarZ: z,
      avatarRotY: rotY,
    }).catch(() => {})
  }, [])

  // 배팅 현황 브로드캐스트
  const broadcastBet = useCallback(
    (racerId, amount) => {
      if (!userRefRef.current) return
      update(userRefRef.current, {
        betRacerId: racerId,
        betAmount: amount,
        nickname,
      }).catch(() => {})
    },
    [nickname]
  )

  // 응원 이모지 브로드캐스트
  const broadcastCheer = useCallback(
    (emoji) => {
      if (!cheerRefRef.current) return
      set(cheerRefRef.current, {
        id: crypto.randomUUID(),
        userId: myId,
        emoji,
        nickname,
        timestamp: Date.now(),
      }).catch(() => {})
    },
    [nickname]
  )

  // 실시간 채팅 메시지 브로드캐스트 (머리 위 말풍선)
  const broadcastChat = useCallback(
    (message) => {
      if (!chatRefRef.current || !message) return
      set(chatRefRef.current, {
        id: crypto.randomUUID(),
        userId: myId,
        message,
        nickname,
        timestamp: Date.now(),
      }).catch(() => {})
    },
    [nickname]
  )

  // 레이스 시작 브로드캐스트 (관리자만)
  const broadcastRaceStart = useCallback(() => {
    if (!controlRefRef.current) return
    set(controlRefRef.current, {
      id: crypto.randomUUID(),
      event: 'race_start',
      userId: myId,
      nickname,
      timestamp: Date.now(),
    }).catch(() => {})
  }, [nickname])

  // 충전 브로드캐스트 (관리자만)
  const broadcastRefill = useCallback(() => {
    if (!controlRefRef.current) return
    set(controlRefRef.current, {
      id: crypto.randomUUID(),
      event: 'refill',
      userId: myId,
      nickname,
      timestamp: Date.now(),
    }).catch(() => {})
  }, [nickname])

  // 다음 라운드 브로드캐스트 (관리자만)
  const broadcastNextRound = useCallback(() => {
    if (!controlRefRef.current) return
    set(controlRefRef.current, {
      id: crypto.randomUUID(),
      event: 'next_round',
      userId: myId,
      nickname,
      timestamp: Date.now(),
    }).catch(() => {})

    if (userRefRef.current) {
      update(userRefRef.current, { betRacerId: 0, betAmount: 100 }).catch(() => {})
    }
  }, [nickname])

  return {
    myId,
    broadcastAvatarMove,
    broadcastBet,
    broadcastCheer,
    broadcastChat,
    broadcastRaceStart,
    broadcastRefill,
    broadcastNextRound,
    updatePresence,
  }
}
