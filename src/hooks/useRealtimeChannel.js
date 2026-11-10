import { useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import useStore from '../store/useStore'

// 고유 접속 ID 생성
const myId = crypto.randomUUID()

export function useRealtimeChannel() {
  const channelRef = useRef(null)
  const nickname = useStore((s) => s.nickname)
  const isAdmin = useStore((s) => s.isAdmin)
  const selectedRacerId = useStore((s) => s.selectedRacerId)
  const betAmount = useStore((s) => s.betAmount)
  const setOnlineUsers = useStore((s) => s.setOnlineUsers)
  const updateOnlineUser = useStore((s) => s.updateOnlineUser)
  const removeOnlineUser = useStore((s) => s.removeOnlineUser)

  useEffect(() => {
    if (!nickname) return

    let channel = null
    try {
      channel = supabase.channel('aqua-verse-room', {
        config: {
          broadcast: { self: false },
          presence: { key: myId },
        },
      })

      // Presence: 접속/퇴장 동기화
      channel.on('presence', { event: 'sync' }, () => {
        try {
          const presenceState = channel.presenceState()
          const users = {}
          Object.entries(presenceState).forEach(([key, entries]) => {
            if (entries.length > 0) {
              users[key] = entries[0]
            }
          })
          setOnlineUsers(users)
        } catch (e) {
          console.warn('Presence sync error:', e)
        }
      })

      channel.on('presence', { event: 'leave' }, ({ key }) => {
        removeOnlineUser(key)
      })

      // Broadcast: 아바타 위치
      channel.on('broadcast', { event: 'avatar_move' }, ({ payload }) => {
        updateOnlineUser(payload.userId, {
          avatarX: payload.x,
          avatarZ: payload.z,
          avatarRotY: payload.rotY,
        })
      })

      // Broadcast: 배팅 현황
      channel.on('broadcast', { event: 'bet_placed' }, ({ payload }) => {
        updateOnlineUser(payload.userId, {
          betRacerId: payload.racerId,
          betAmount: payload.amount,
          nickname: payload.nickname,
        })
      })

      // Broadcast: 응원 이모지
      channel.on('broadcast', { event: 'cheer' }, ({ payload }) => {
        window.dispatchEvent(
          new CustomEvent('remote-cheer', { detail: payload })
        )
      })

      // Broadcast: 실시간 채팅 메시지 (머리 위 말풍선)
      channel.on('broadcast', { event: 'chat_message' }, ({ payload }) => {
        window.dispatchEvent(
          new CustomEvent('remote-chat', { detail: payload })
        )
      })

      // Broadcast: 레이스 시작 (관리자 → 전체)
      channel.on('broadcast', { event: 'race_start' }, ({ payload }) => {
        window.dispatchEvent(
          new CustomEvent('remote-race-start', { detail: payload })
        )
      })

      // Broadcast: 조개 충전 (관리자 → 전체)
      channel.on('broadcast', { event: 'refill' }, ({ payload }) => {
        window.dispatchEvent(
          new CustomEvent('remote-refill', { detail: payload })
        )
      })

      // Broadcast: 다음 라운드 (관리자 → 전체)
      channel.on('broadcast', { event: 'next_round' }, ({ payload }) => {
        window.dispatchEvent(
          new CustomEvent('remote-next-round', { detail: payload })
        )
      })

      channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          try {
            await channel.track({
              nickname,
              isAdmin,
              avatarX: 0,
              avatarZ: 18,
              avatarRotY: 0,
              betRacerId: selectedRacerId,
              betAmount: betAmount,
              joinedAt: Date.now(),
            })
          } catch (e) {
            console.warn('Channel track error:', e)
          }
        }
      })

      channelRef.current = channel
    } catch (err) {
      console.warn('Supabase Realtime Channel init error:', err)
    }

    return () => {
      if (channelRef.current) {
        channelRef.current.unsubscribe()
        channelRef.current = null
      }
    }
  }, [nickname, isAdmin])

  // Presence 업데이트
  const updatePresence = useCallback(
    (data) => {
      if (!channelRef.current) return
      try {
        channelRef.current.track({
          nickname,
          isAdmin,
          ...data,
        })
      } catch (e) {
        console.warn('Presence update error:', e)
      }
    },
    [nickname, isAdmin]
  )

  // 아바타 위치 브로드캐스트
  const broadcastAvatarMove = useCallback(
    (x, z, rotY) => {
      if (!channelRef.current) return
      try {
        channelRef.current.send({
          type: 'broadcast',
          event: 'avatar_move',
          payload: { userId: myId, x, z, rotY },
        })
      } catch (e) {}
    },
    []
  )

  // 배팅 현황 브로드캐스트 & presence 동기화
  const broadcastBet = useCallback(
    (racerId, amount) => {
      if (!channelRef.current) return
      try {
        channelRef.current.send({
          type: 'broadcast',
          event: 'bet_placed',
          payload: { userId: myId, racerId, amount, nickname },
        })
        updatePresence({ betRacerId: racerId, betAmount: amount })
      } catch (e) {}
    },
    [nickname, updatePresence]
  )

  // 응원 이모지 브로드캐스트
  const broadcastCheer = useCallback(
    (emoji) => {
      if (!channelRef.current) return
      try {
        channelRef.current.send({
          type: 'broadcast',
          event: 'cheer',
          payload: { userId: myId, emoji, nickname },
        })
      } catch (e) {}
    },
    [nickname]
  )

  // 실시간 채팅 메시지 브로드캐스트 (머리 위 말풍선)
  const broadcastChat = useCallback(
    (message) => {
      if (!channelRef.current || !message) return
      try {
        channelRef.current.send({
          type: 'broadcast',
          event: 'chat_message',
          payload: { userId: myId, message, nickname, timestamp: Date.now() },
        })
      } catch (e) {}
    },
    [nickname]
  )

  // 레이스 시작 브로드캐스트 (관리자만)
  const broadcastRaceStart = useCallback(
    () => {
      if (!channelRef.current) return
      try {
        channelRef.current.send({
          type: 'broadcast',
          event: 'race_start',
          payload: { userId: myId, nickname, timestamp: Date.now() },
        })
      } catch (e) {}
    },
    [nickname]
  )

  // 충전 브로드캐스트 (관리자만)
  const broadcastRefill = useCallback(
    () => {
      if (!channelRef.current) return
      try {
        channelRef.current.send({
          type: 'broadcast',
          event: 'refill',
          payload: { userId: myId, nickname, timestamp: Date.now() },
        })
      } catch (e) {}
    },
    [nickname]
  )

  // 다음 라운드 브로드캐스트 (관리자만)
  const broadcastNextRound = useCallback(
    () => {
      if (!channelRef.current) return
      try {
        channelRef.current.send({
          type: 'broadcast',
          event: 'next_round',
          payload: { userId: myId, nickname, timestamp: Date.now() },
        })
        updatePresence({ betRacerId: 0, betAmount: 100 })
      } catch (e) {}
    },
    [nickname, updatePresence]
  )

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
