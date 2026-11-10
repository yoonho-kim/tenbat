import { useEffect, useRef } from 'react'
import useStore from '../store/useStore'
import { RACERS_CONFIG } from '../constants'

export default function Arena2D({ realtimeChannel }) {
  const canvasRef = useRef(null)

  const nickname = useStore((s) => s.nickname)
  const isAdmin = useStore((s) => s.isAdmin)
  const phase = useStore((s) => s.phase)
  const selectedRacerId = useStore((s) => s.selectedRacerId)
  const onlineUsers = useStore((s) => s.onlineUsers)
  const setPhase = useStore((s) => s.setPhase)
  const setRaceElapsed = useStore((s) => s.setRaceElapsed)
  const setFinishOrder = useStore((s) => s.setFinishOrder)
  const setBroadcastText = useStore((s) => s.setBroadcastText)
  const setBettingModalOpen = useStore((s) => s.setBettingModalOpen)

  // 최신 상태 ref
  const phaseRef = useRef(phase)
  const selectedRef = useRef(selectedRacerId)
  const onlineUsersRef = useRef(onlineUsers)

  useEffect(() => { phaseRef.current = phase }, [phase])
  useEffect(() => { selectedRef.current = selectedRacerId }, [selectedRacerId])
  useEffect(() => { onlineUsersRef.current = onlineUsers }, [onlineUsers])

  // 아바타 위치 및 상태 (관람석 영역: X: 40~760, Y: 250~450)
  const myAvatarRef = useRef({
    x: 400,
    y: 350,
    facing: 'down',
    step: 0,
    speechBubble: null,
    speechTimer: 0,
  })

  // 클릭/터치 이동 목표점
  const targetPosRef = useRef(null)
  const clickPingRef = useRef(null)

  // 키 입력 상태
  const keysRef = useRef({
    KeyW: false, KeyA: false, KeyS: false, KeyD: false,
    ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false,
  })

  // 2D 캔버스 엔진 마운트
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.imageSmoothingEnabled = false

    // 레이서 초기화
    const TRACK_START_X = 60
    const TRACK_FINISH_X = 720
    const TRACK_LEN = TRACK_FINISH_X - TRACK_START_X

    const racers = RACERS_CONFIG.map((cfg, idx) => ({
      ...cfg,
      x: TRACK_START_X,
      y: 40 + idx * 45, // 4개 레인
      speed: 0,
      baseSpeed: cfg.baseSpeed * 0.9,
      boostTimer: 0,
      playerBoostTimer: 0,
      finished: false,
      finishTime: 0,
      rank: cfg.lane,
    }))

    // 물결 파티클
    const waterParticles = []
    function addWaterSplash(x, y, color = '#38bdf8') {
      for (let i = 0; i < 4; i++) {
        waterParticles.push({
          x,
          y: y + (Math.random() - 0.5) * 8,
          vx: -(Math.random() * 3 + 1),
          vy: (Math.random() - 0.5) * 2,
          life: 18,
          maxLife: 18,
          color,
        })
      }
    }

    // 배팅 도우미 NPC 고정 위치 (관람석 중앙 상단 안내 데스크)
    const BETTING_NPC = {
      x: 400,
      y: 255,
      name: '배팅 도우미',
    }

    // 원격 유저 말풍선 저장소
    const remoteBubbles = {}

    // 응원 이벤트 수신 시 말풍선
    const onRemoteCheer = (e) => {
      const { userId, emoji } = e.detail
      if (userId === realtimeChannel?.myId) {
        myAvatarRef.current.speechBubble = emoji
        myAvatarRef.current.speechTimer = 160
      } else {
        remoteBubbles[userId] = { message: emoji, timer: 160 }
      }
    }
    window.addEventListener('remote-cheer', onRemoteCheer)

    // 실시간 채팅 수신 시 말풍선
    const onRemoteChat = (e) => {
      const { userId, message } = e.detail
      if (userId === realtimeChannel?.myId) {
        myAvatarRef.current.speechBubble = message
        myAvatarRef.current.speechTimer = 220
      } else {
        remoteBubbles[userId] = { message, timer: 220 }
      }
    }
    window.addEventListener('remote-chat', onRemoteChat)

    // 부스트 발사 핸들러
    window.__spawnBoostRing = (racerIdx) => {
      const r = racers[racerIdx]
      if (r && !r.finished) {
        r.playerBoostTimer = 1.2
        addWaterSplash(r.x, r.y + 12, '#38bdf8')
      }
    }

    // 레이스 시작 핸들러
    window.__startRaceInScene = () => {
      racers.forEach((r) => {
        r.x = TRACK_START_X
        r.speed = 0
        r.boostTimer = 0
        r.playerBoostTimer = 0
        r.finished = false
        r.finishTime = 0
        r.rank = r.lane
      })
    }

    // 다음 라운드 리셋 핸들러
    window.__resetRacers = () => {
      racers.forEach((r) => {
        r.x = TRACK_START_X
        r.finished = false
        r.rank = r.lane
      })
    }

    window.__getRacerPositions = () => racers.map((r) => ({
      id: r.id, x: r.x - 400, rank: r.rank, emoji: r.emoji,
    }))

    // 키보드 리스너 (채팅 입력 중일 때는 이동 차단)
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      if (keysRef.current.hasOwnProperty(e.code)) {
        keysRef.current[e.code] = true
        targetPosRef.current = null // 키보드 누르면 마우스 목표 취소
      }
    }
    const handleKeyUp = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      if (keysRef.current.hasOwnProperty(e.code)) {
        keysRef.current[e.code] = false
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    // 마우스 / 모바일 터치 클릭 이동 핸들러
    const handleCanvasPointerDown = (e) => {
      if (e.target.tagName === 'INPUT') return
      const rect = canvas.getBoundingClientRect()
      const scaleX = 800 / rect.width
      const scaleY = 480 / rect.height
      const clickX = (e.clientX - rect.left) * scaleX
      const clickY = (e.clientY - rect.top) * scaleY

      // 배팅 도우미 NPC를 직접 클릭했는지 확인 (반경 35px)
      const distToNpc = Math.hypot(clickX - BETTING_NPC.x, clickY - BETTING_NPC.y)
      if (distToNpc < 35) {
        // 도우미 바로 앞으로 이동 설정 후 모달 열기
        targetPosRef.current = { x: BETTING_NPC.x, y: BETTING_NPC.y + 25 }
        clickPingRef.current = { x: BETTING_NPC.x, y: BETTING_NPC.y, life: 25, isNpc: true }
        setBettingModalOpen(true)
        return
      }

      // 관람석 데크 영역 클릭 시 이동
      if (clickY >= 230 && clickY <= 460) {
        const clampedX = Math.max(50, Math.min(750, clickX))
        const clampedY = Math.max(250, Math.min(450, clickY))
        targetPosRef.current = { x: clampedX, y: clampedY }
        clickPingRef.current = { x: clampedX, y: clampedY, life: 20, isNpc: false }
      }
    }
    canvas.addEventListener('pointerdown', handleCanvasPointerDown)

    let animationFrameId
    let tick = 0
    let lastBroadcastTime = 0
    let modalDistanceTriggered = false

    // ========================================================
    // 메인 게임 루프
    // ========================================================
    function loop() {
      animationFrameId = requestAnimationFrame(loop)
      tick++

      // 1. 아바타 이동 로직 (키보드 또는 클릭/터치 이동)
      const my = myAvatarRef.current
      const k = keysRef.current
      let dx = 0
      let dy = 0

      const isKeyMoving = k.KeyW || k.ArrowUp || k.KeyS || k.ArrowDown || k.KeyA || k.ArrowLeft || k.KeyD || k.ArrowRight

      if (isKeyMoving) {
        // 키보드 우선 이동
        targetPosRef.current = null
        if (k.KeyW || k.ArrowUp) { dy -= 1; my.facing = 'up' }
        if (k.KeyS || k.ArrowDown) { dy += 1; my.facing = 'down' }
        if (k.KeyA || k.ArrowLeft) { dx -= 1; my.facing = 'left' }
        if (k.KeyD || k.ArrowRight) { dx += 1; my.facing = 'right' }

        if (dx !== 0 && dy !== 0) {
          dx *= 0.7071
          dy *= 0.7071
        }
        my.x = Math.max(50, Math.min(750, my.x + dx * 2.8))
        my.y = Math.max(250, Math.min(450, my.y + dy * 2.8))
        my.step = (my.step + 0.2) % 4
      } else if (targetPosRef.current) {
        // 모바일/마우스 클릭 목표점으로 자동 보행
        const tx = targetPosRef.current.x
        const ty = targetPosRef.current.y
        const dist = Math.hypot(tx - my.x, ty - my.y)

        if (dist > 3) {
          const angle = Math.atan2(ty - my.y, tx - my.x)
          const moveDist = Math.min(dist, 2.8)
          my.x += Math.cos(angle) * moveDist
          my.y += Math.sin(angle) * moveDist
          my.step = (my.step + 0.2) % 4

          // 방향 결정
          if (Math.abs(tx - my.x) > Math.abs(ty - my.y)) {
            my.facing = tx > my.x ? 'right' : 'left'
          } else {
            my.facing = ty > my.y ? 'down' : 'up'
          }
        } else {
          // 목표 지점 도착
          my.step = 0
          targetPosRef.current = null
        }
      } else {
        my.step = 0
      }

      // NPC 배팅 도우미와의 거리 체크 -> 근접 시 배팅 모달 열기 / 멀어지면 닫기
      const distToNpc = Math.hypot(my.x - BETTING_NPC.x, my.y - BETTING_NPC.y)
      if (distToNpc < 45) {
        if (!modalDistanceTriggered) {
          modalDistanceTriggered = true
          setBettingModalOpen(true)
        }
      } else if (distToNpc > 95) {
        if (modalDistanceTriggered) {
          modalDistanceTriggered = false
          setBettingModalOpen(false)
        }
      }

      // 내 말풍선 타이머
      if (my.speechTimer > 0) {
        my.speechTimer--
        if (my.speechTimer <= 0) my.speechBubble = null
      }

      // 원격 유저 말풍선 타이머
      Object.keys(remoteBubbles).forEach((uid) => {
        if (remoteBubbles[uid]) {
          remoteBubbles[uid].timer--
          if (remoteBubbles[uid].timer <= 0) delete remoteBubbles[uid]
        }
      })

      // 위치 브로드캐스트 (100ms)
      const now = performance.now()
      if (now - lastBroadcastTime > 100 && realtimeChannel) {
        lastBroadcastTime = now
        realtimeChannel.broadcastAvatarMove(my.x, my.y, my.facing)
      }

      // 2. 레이스 시뮬레이션
      if (phaseRef.current === 'RACING') {
        const raceStartTime = useStore.getState().raceStartTime
        const elapsed = (performance.now() - raceStartTime) / 1000
        setRaceElapsed(elapsed)

        racers.forEach((r) => {
          if (r.finished) return
          let targetSpeed = r.baseSpeed

          if (r.id === 0) {
            if (r.boostTimer > 0) {
              r.boostTimer -= 0.016
              targetSpeed *= 1.85
              if (tick % 3 === 0) addWaterSplash(r.x, r.y + 12, '#fb7185')
            } else if (Math.random() < 0.02) {
              r.boostTimer = 0.8
              setBroadcastText('🦐 1번 총알 새우! 폭발적인 꼬리 스냅 가속 발동!')
            }
          } else if (r.id === 1) {
            targetSpeed *= 1.05 + Math.sin(tick * 0.1) * 0.08
          } else if (r.id === 2) {
            const progress = (r.x - TRACK_START_X) / TRACK_LEN
            targetSpeed *= progress < 0.5 ? 1.3 : 0.85
          } else {
            if (r.boostTimer > 0) {
              r.boostTimer -= 0.016
              targetSpeed *= 2.1
              if (tick % 3 === 0) addWaterSplash(r.x, r.y + 12, '#a855f7')
            } else if (Math.random() < 0.018) {
              r.boostTimer = 0.9
              setBroadcastText('🐙 4번 먹물 문어! 기습 먹물 분사로 치고 나갑니다!')
            }
          }

          if (r.playerBoostTimer > 0) {
            r.playerBoostTimer -= 0.016
            targetSpeed *= 1.45
            if (tick % 2 === 0) addWaterSplash(r.x, r.y + 12, '#38bdf8')
          }

          r.speed += (targetSpeed - r.speed) * 0.1
          r.x += r.speed * 0.28

          if (r.x >= TRACK_FINISH_X) {
            r.x = TRACK_FINISH_X
            r.finished = true
            r.finishTime = elapsed
            const currentOrder = useStore.getState().finishOrder
            const newOrder = [...currentOrder, { ...r }]
            setFinishOrder(newOrder)
            if (newOrder.length === 1) {
              setBroadcastText(`🏆 [1위 골인!] ${r.lane}레인 ${r.name}(${r.emoji}) 결승선 통과!`)
            }
          }
        })

        const sorted = [...racers].sort((a, b) => {
          if (a.finished && b.finished) return a.finishTime - b.finishTime
          if (a.finished) return -1
          if (b.finished) return 1
          return b.x - a.x
        })
        sorted.forEach((r, idx) => { r.rank = idx + 1 })

        if (useStore.getState().finishOrder.length === racers.length) {
          setPhase('RESULT')
        }
      }

      // 파티클 업데이트
      for (let i = waterParticles.length - 1; i >= 0; i--) {
        const p = waterParticles[i]
        p.x += p.vx
        p.y += p.vy
        p.life--
        if (p.life <= 0) waterParticles.splice(i, 1)
      }

      // ========================================================
      // 3. 2D 캔버스 렌더링
      // ========================================================
      ctx.clearRect(0, 0, 800, 480)

      // (A) 상단 수로 배경 (물 타일)
      ctx.fillStyle = '#0f2b48'
      ctx.fillRect(0, 0, 800, 220)

      // 물결 패턴
      ctx.fillStyle = '#173d66'
      for (let y = 0; y < 220; y += 16) {
        for (let x = 0; x < 800; x += 32) {
          if (((x + y + Math.floor(tick * 0.5)) % 64) === 0) {
            ctx.fillRect(x, y + 2, 8, 2)
          }
        }
      }

      // 4개 레인 부표 구분선
      for (let i = 0; i <= 4; i++) {
        const ly = 20 + i * 45
        ctx.strokeStyle = '#285888'
        ctx.lineWidth = 2
        ctx.setLineDash([8, 8])
        ctx.beginPath()
        ctx.moveTo(30, ly)
        ctx.lineTo(760, ly)
        ctx.stroke()
        ctx.setLineDash([])

        if (i < 4) {
          ctx.fillStyle = '#1e3852'
          ctx.fillRect(15, ly + 12, 32, 18)
          ctx.strokeStyle = '#487aa8'
          ctx.strokeRect(15, ly + 12, 32, 18)
          ctx.fillStyle = '#e2f1ff'
          ctx.font = '10px NeoDunggeunmo'
          ctx.fillText(`L${i + 1}`, 22, ly + 25)
        }
      }

      // 출발선 & 결승선
      ctx.strokeStyle = '#38bdf8'
      ctx.lineWidth = 4
      ctx.beginPath()
      ctx.moveTo(TRACK_START_X, 20)
      ctx.lineTo(TRACK_START_X, 200)
      ctx.stroke()
      ctx.fillStyle = '#38bdf8'
      ctx.font = '11px NeoDunggeunmo'
      ctx.fillText('출발선', TRACK_START_X - 16, 16)

      ctx.strokeStyle = '#f43f5e'
      ctx.lineWidth = 4
      ctx.beginPath()
      ctx.moveTo(TRACK_FINISH_X, 20)
      ctx.lineTo(TRACK_FINISH_X, 200)
      ctx.stroke()
      for (let y = 20; y < 200; y += 12) {
        ctx.fillStyle = ((y / 12) % 2 === 0) ? '#fff' : '#000'
        ctx.fillRect(TRACK_FINISH_X - 4, y, 8, 6)
      }
      ctx.fillStyle = '#f43f5e'
      ctx.font = '11px NeoDunggeunmo'
      ctx.fillText('결승선 🏁', TRACK_FINISH_X - 22, 16)

      // 물보라 파티클
      waterParticles.forEach((p) => {
        ctx.fillStyle = p.color
        const size = Math.max(1, (p.life / p.maxLife) * 4)
        ctx.fillRect(p.x, p.y, size, size)
      })

      // 4마리 해양생물 레이서 렌더링
      racers.forEach((r) => {
        const bob = Math.sin(tick * 0.2 + r.id) * 3
        const rx = r.x
        const ry = r.y + bob

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.ellipse(rx + 8, ry + 16, 14, 5, 0, 0, Math.PI * 2)
        ctx.stroke()

        ctx.font = '24px sans-serif'
        ctx.fillText(r.emoji, rx - 4, ry + 18)

        const isMyPick = r.id === selectedRef.current
        ctx.fillStyle = isMyPick ? '#f59e0b' : '#0f172a'
        ctx.fillRect(rx - 16, ry - 8, 48, 14)
        ctx.strokeStyle = isMyPick ? '#fde047' : '#475569'
        ctx.lineWidth = 1
        ctx.strokeRect(rx - 16, ry - 8, 48, 14)

        ctx.fillStyle = isMyPick ? '#000' : '#fff'
        ctx.font = '9px NeoDunggeunmo'
        const rankText = phaseRef.current === 'RACING' ? `${r.rank}위 ` : ''
        ctx.fillText(`${rankText}${r.name.slice(0, 3)}`, rx - 12, ry + 2)
      })

      // (B) 관람석 광장 데크 (목재 타일맵)
      ctx.fillStyle = '#3a2416'
      ctx.fillRect(0, 220, 800, 260)

      ctx.strokeStyle = '#28170c'
      ctx.lineWidth = 2
      for (let y = 220; y < 480; y += 24) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(800, y)
        ctx.stroke()
      }
      for (let x = 0; x < 800; x += 48) {
        for (let y = 220; y < 480; y += 24) {
          ctx.beginPath()
          const offset = ((y / 24) % 2) * 24
          ctx.moveTo(x + offset, y)
          ctx.lineTo(x + offset, y + 24)
          ctx.stroke()
        }
      }

      // 상단 경계 난간
      ctx.fillStyle = '#5c381e'
      ctx.fillRect(0, 218, 800, 10)
      ctx.fillStyle = '#7a4e2d'
      ctx.fillRect(0, 216, 800, 4)
      for (let x = 16; x < 800; x += 32) {
        ctx.fillStyle = '#8f5c35'
        ctx.fillRect(x, 214, 6, 16)
        ctx.fillStyle = '#3d2516'
        ctx.fillRect(x + 6, 214, 2, 16)
      }

      // (C) 배팅 도우미 NPC 렌더링 (중앙 상단)
      // NPC 발밑 안내 매트 (카펫)
      ctx.fillStyle = '#6b1d1d'
      ctx.fillRect(BETTING_NPC.x - 24, BETTING_NPC.y - 12, 48, 30)
      ctx.strokeStyle = '#f5c542'
      ctx.lineWidth = 1
      ctx.strokeRect(BETTING_NPC.x - 24, BETTING_NPC.y - 12, 48, 30)

      // NPC 스프라이트 (고전 상인 의상)
      drawRpgCharacter(ctx, BETTING_NPC.x, BETTING_NPC.y, '#eab308', 'down', (tick * 0.05) % 4)
      drawCharacterNameplate(ctx, BETTING_NPC.x, BETTING_NPC.y, '📜 [NPC] 배팅 도우미', '#fde047', true)

      // NPC 머리 위 "배팅하기" 알림 말풍선 (주기적 깜빡임)
      if ((tick % 120) < 90) {
        drawSpeechBubble(ctx, BETTING_NPC.x, BETTING_NPC.y - 32, '💡 클릭시 배팅창 오픈!')
      }

      // (D) 마우스/터치 클릭 핑 이펙트
      if (clickPingRef.current && clickPingRef.current.life > 0) {
        const cp = clickPingRef.current
        cp.life--
        const radius = (25 - cp.life) * 1.2
        ctx.strokeStyle = cp.isNpc ? '#fde047' : '#22c55e'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(cp.x, cp.y, radius, 0, Math.PI * 2)
        ctx.stroke()
      }

      // (E) 타 접속자(원격 유저) 렌더링 (실제 접속자만)
      const users = onlineUsersRef.current
      Object.entries(users).forEach(([uid, data]) => {
        if (!data.nickname || uid === realtimeChannel?.myId) return
        const rx = data.avatarX || 400
        const ry = data.avatarZ || 350
        const rFacing = data.avatarRotY || 'down'
        const isRemoteAdmin = data.isAdmin

        drawRpgCharacter(ctx, rx, ry, isRemoteAdmin ? '#f59e0b' : '#38bdf8', rFacing, (tick * 0.1) % 4)

        const betText = data.betAmount > 0 && data.betRacerId !== undefined && data.betRacerId !== null
          ? `[${RACERS_CONFIG[data.betRacerId]?.emoji} ${data.betAmount}🐚]`
          : ''
        drawCharacterNameplate(ctx, rx, ry, `${isRemoteAdmin ? '👑 ' : ''}${data.nickname} ${betText}`, isRemoteAdmin ? '#fbbf24' : '#fff', isRemoteAdmin)

        const rBubble = remoteBubbles[uid]
        if (rBubble && rBubble.timer > 0) {
          drawSpeechBubble(ctx, rx, ry - 32, rBubble.message)
        }
      })

      // (F) 내 아바타 렌더링
      const myBetText = useStore.getState().betAmount > 0
        ? `[${RACERS_CONFIG[selectedRef.current]?.emoji} ${useStore.getState().betAmount}🐚]`
        : ''

      drawRpgCharacter(ctx, my.x, my.y, isAdmin ? '#f59e0b' : '#00f0ff', my.facing, my.step)
      drawCharacterNameplate(ctx, my.x, my.y, `${isAdmin ? '👑 ' : ''}${nickname} (나) ${myBetText}`, '#fde047', isAdmin)

      if (my.speechBubble) {
        drawSpeechBubble(ctx, my.x, my.y - 32, my.speechBubble)
      }
    }

    loop()

    return () => {
      cancelAnimationFrame(animationFrameId)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('remote-cheer', onRemoteCheer)
      window.removeEventListener('remote-chat', onRemoteChat)
      canvas.removeEventListener('pointerdown', handleCanvasPointerDown)
      delete window.__spawnBoostRing
      delete window.__startRaceInScene
      delete window.__resetRacers
      delete window.__getRacerPositions
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-slate-950 overflow-hidden">
      {/* 2D Retro Canvas (800x480 Virtual Resolution) - Full View Fit */}
      <canvas
        ref={canvasRef}
        width={800}
        height={480}
        className="w-full h-full object-contain cursor-pointer shadow-2xl select-none"
        style={{ imageRendering: 'pixelated', touchAction: 'none' }}
      />
    </div>
  )
}

// ========================================================
// 2D 도트 캐릭터 렌더러
// ========================================================
function drawRpgCharacter(ctx, x, y, clothesColor, facing, step) {
  const bob = Math.sin(step * Math.PI) * 2

  // 그림자
  ctx.fillStyle = 'rgba(0, 0, 0, 0.4)'
  ctx.beginPath()
  ctx.ellipse(x, y + 10, 10, 4, 0, 0, Math.PI * 2)
  ctx.fill()

  // 몸통
  ctx.fillStyle = clothesColor
  ctx.fillRect(x - 7, y - 6 + bob, 14, 12)
  ctx.strokeStyle = '#180f08'
  ctx.lineWidth = 1
  ctx.strokeRect(x - 7, y - 6 + bob, 14, 12)

  // 다리 / 신발
  ctx.fillStyle = '#2d1c10'
  const legOffset = Math.sin(step * Math.PI) * 3
  ctx.fillRect(x - 5, y + 6 + bob + legOffset, 4, 4)
  ctx.fillRect(x + 1, y + 6 + bob - legOffset, 4, 4)

  // 머리
  ctx.fillStyle = '#ffdfba'
  ctx.fillRect(x - 6, y - 16 + bob, 12, 10)
  ctx.strokeStyle = '#180f08'
  ctx.strokeRect(x - 6, y - 16 + bob, 12, 10)

  // 상투 헤어
  ctx.fillStyle = '#1e1b18'
  ctx.fillRect(x - 7, y - 19 + bob, 14, 5)
  ctx.fillRect(x - 2, y - 22 + bob, 4, 3)

  // 눈
  ctx.fillStyle = '#0f172a'
  if (facing === 'down') {
    ctx.fillRect(x - 3, y - 12 + bob, 2, 2)
    ctx.fillRect(x + 2, y - 12 + bob, 2, 2)
  } else if (facing === 'left') {
    ctx.fillRect(x - 5, y - 12 + bob, 2, 2)
  } else if (facing === 'right') {
    ctx.fillRect(x + 3, y - 12 + bob, 2, 2)
  }
}

// 캐릭터 이름표
function drawCharacterNameplate(ctx, x, y, text, textColor = '#fff', isGold = false) {
  ctx.font = '10px NeoDunggeunmo'
  const textWidth = ctx.measureText(text).width
  const pad = 4
  const boxW = textWidth + pad * 2
  const boxH = 14
  const boxX = x - boxW / 2
  const boxY = y - 32

  ctx.fillStyle = isGold ? 'rgba(40, 25, 10, 0.85)' : 'rgba(10, 15, 25, 0.8)'
  ctx.fillRect(boxX, boxY, boxW, boxH)
  ctx.strokeStyle = isGold ? '#f5c542' : '#334155'
  ctx.lineWidth = 1
  ctx.strokeRect(boxX, boxY, boxW, boxH)

  ctx.fillStyle = textColor
  ctx.fillText(text, boxX + pad, boxY + 10)
}

// 대화 말풍선
function drawSpeechBubble(ctx, x, y, text) {
  if (!text) return
  ctx.font = '11px NeoDunggeunmo'
  const textWidth = ctx.measureText(text).width
  const padX = 8
  const padY = 4
  const boxW = Math.max(28, textWidth + padX * 2)
  const boxH = 20
  const boxX = x - boxW / 2
  const boxY = y - boxH - 2

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(boxX, boxY, boxW, boxH)
  ctx.strokeStyle = '#000000'
  ctx.lineWidth = 1.5
  ctx.strokeRect(boxX, boxY, boxW, boxH)

  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.moveTo(x - 3, boxY + boxH)
  ctx.lineTo(x + 3, boxY + boxH)
  ctx.lineTo(x, boxY + boxH + 4)
  ctx.fill()
  ctx.stroke()

  ctx.fillStyle = '#000000'
  ctx.fillText(text, boxX + padX, boxY + 14)
}
