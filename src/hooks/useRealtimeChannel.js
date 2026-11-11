import { useEffect, useRef, useCallback } from 'react'
import {
  ref,
  onValue,
  set,
  update,
  remove,
  onDisconnect,
} from 'firebase/database'
import { db, initError } from '../lib/firebaseClient'
import useStore from '../store/useStore'

// 고유 접속 ID 생성
const myId = crypto.randomUUID()

export function useRealtimeChannel() {
  const nickname = useStore((s) => s.nickname)
  const isAdmin = useStore((s) => s.isAdmin)
  const selectedRacerId = useStore((s) => s.selectedRacerId)
  const betAmount = useStore((s) => s.betAmount)
  const setOnlineUsers = useStore((s) => s.setOnlineUsers)
  const setConnectionStatus = useStore((s) => s.setConnectionStatus)

  const userRefRef = useRef(null)
  const chatRefRef = useRef(null)
  const cheerRefRef = useRef(null)
  const controlRefRef = useRef(null)

  useEffect(() => {
    if (!nickname) return

    if (!db) {
      setConnectionStatus(
        'error',
        initError || 'Firebase DB 초기화 실패 (환경 변수 확인 필요)'
      )
      return
    }

    setConnectionStatus('connecting', 'Firebase 서버 연결 중...')

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

    const initialUserData = {
      userId: myId,
      nickname,
      isAdmin: !!isAdmin,
      avatarX: 400,
      avatarZ: 350,
      avatarRotY: 'down',
      betRacerId: selectedRacerId ?? 0,
      betAmount: betAmount ?? 100,
      joinedAt: Date.now(),
    }

    // 0. 즉시 내 데이터 등록 시도 (권한 검증 및 초기 진입)
    set(userRef, initialUserData)
      .then(() => {
        setConnectionStatus('connected')
      })
      .catch((err) => {
        console.error('Firebase user write error:', err)
        const msg = String(err?.message || err)
        if (msg.includes('PERMISSION_DENIED') || err?.code === 'PERMISSION_DENIED') {
          setConnectionStatus(
            'permission_denied',
            'Firebase 규칙(Rules) 오류: Realtime Database의 규칙에서 .read와 .write를 true로 설정해야 합니다.'
          )
        } else {
          setConnectionStatus('error', msg)
        }
      })

    // 1. 접속 및 Presence 감지
    const unsubConnected = onValue(
      connectedRef,
      (snap) => {
        if (snap.val() === true) {
          // 탭 종료 또는 네트워크 단절 시 자동 정리
          onDisconnect(userRef).remove().catch(() => {})

          // 재접속 시 데이터 갱신
          set(userRef, initialUserData)
            .then(() => setConnectionStatus('connected'))
            .catch(() => {})
        }
      },
      (err) => {
        console.warn('Connected status error:', err)
      }
    )

    // 2. 전체 온라인 유저 목록 실시간 동기화 (오류 핸들러 포함)
    const unsubUsers = onValue(
      usersRef,
      (snap) => {
        try {
          const data = snap.val() || {}
          setOnlineUsers(data)
          setConnectionStatus('connected')
        } catch (e) {
          console.warn('Sync users error:', e)
        }
      },
      (err) => {
        console.error('Firebase users sync error:', err)
        const msg = String(err?.message || err)
        if (msg.includes('PERMISSION_DENIED') || err?.code === 'PERMISSION_DENIED') {
          setConnectionStatus(
            'permission_denied',
            'Firebase 보안 규칙(Rules)에 의해 읽기가 거부되었습니다. (.read: true 설정 필요)'
          )
        } else {
          setConnectionStatus('error', msg)
        }
      }
    )

    // 3. 실시간 말풍선 채팅 수신
    let lastHandledChatId = null
    const unsubChat = onValue(
      chatRef,
      (snap) => {
        const payload = snap.val()
        if (!payload || !payload.id || payload.id === lastHandledChatId) return
        lastHandledChatId = payload.id

        if (payload.userId !== myId && Date.now() - (payload.timestamp || 0) < 6000) {
          window.dispatchEvent(
            new CustomEvent('remote-chat', { detail: payload })
          )
        }
      },
      (err) => console.warn('Chat listen error:', err)
    )

    // 4. 응원 이모지 수신
    let lastHandledCheerId = null
    const unsubCheer = onValue(
      cheerRef,
      (snap) => {
        const payload = snap.val()
        if (!payload || !payload.id || payload.id === lastHandledCheerId) return
        lastHandledCheerId = payload.id

        if (payload.userId !== myId && Date.now() - (payload.timestamp || 0) < 6000) {
          window.dispatchEvent(
            new CustomEvent('remote-cheer', { detail: payload })
          )
        }
      },
      (err) => console.warn('Cheer listen error:', err)
    )

    // 5. 관리자 게임 제어 수신
    let lastHandledControlId = null
    const unsubControl = onValue(
      controlRef,
      (snap) => {
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
      },
      (err) => console.warn('Control listen error:', err)
    )

    // 창 닫을 때 즉각 퇴장
    const handleBeforeUnload = () => {
      if (userRefRef.current) {
        remove(userRefRef.current).catch(() => {})
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
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
  }, [nickname, isAdmin, setOnlineUsers, setConnectionStatus])

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
