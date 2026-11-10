import { useState, useEffect, useRef } from 'react'
import useStore from '../store/useStore'
import { RACERS_CONFIG } from '../constants'
import { sfx } from '../lib/sound'
import OnlineUsersPanel from './OnlineUsersPanel'

export default function GameHUD({ realtimeChannel }) {
  const {
    round, phase, wallet, selectedRacerId, betAmount, isBettingModalOpen,
    raceElapsed, countdownNumber, finishOrder, broadcastText, muted, isAdmin, nickname, onlineUsers,
    setPhase, setWallet, setBettingModalOpen,
    setBroadcastText, setMuted, setRaceStartTime, setFinishOrder, setCountdownNumber,
    adjustBet, setBetHalf, setBetMax, resetBet, refillClams, deductBet,
    addWinnings, prepareNextRound, selectRacer,
  } = useStore()

  const [showResult, setShowResult] = useState(false)
  const [resultData, setResultData] = useState(null)
  const [walletDelta, setWalletDelta] = useState(null)
  const [chatInput, setChatInput] = useState('')
  const chatInputRef = useRef(null)
  const betAmountAtStart = useRef(0)

  // 전역 Enter 키로 채팅창 포커스
  useEffect(() => {
    const handleGlobalEnter = (e) => {
      if (e.key === 'Enter') {
        if (document.activeElement !== chatInputRef.current) {
          chatInputRef.current?.focus()
        }
      }
    }
    window.addEventListener('keydown', handleGlobalEnter)
    return () => window.removeEventListener('keydown', handleGlobalEnter)
  }, [])

  function handleChatSubmit(e) {
    e?.preventDefault()
    const trimmed = chatInput.trim()
    if (!trimmed) return

    if (realtimeChannel) {
      realtimeChannel.broadcastChat(trimmed)
    }

    // 내 머리 위에도 즉시 말풍선 띄우기
    window.dispatchEvent(
      new CustomEvent('remote-chat', {
        detail: { userId: realtimeChannel?.myId, message: trimmed, nickname },
      })
    )

    sfx.click()
    setChatInput('')
  }

  // Listen for remote events
  useEffect(() => {
    const onRemoteCheer = (e) => {
      triggerCheerEmoji(e.detail.emoji)
    }

    const onRemoteRaceStart = () => {
      const s = useStore.getState()
      if (s.phase === 'BETTING') {
        handleStartRace(true)
      }
    }

    const onRemoteRefill = () => {
      const s = useStore.getState()
      useStore.setState({
        wallet: s.wallet + 500,
        betAmount: s.betAmount === 0 ? 100 : s.betAmount,
        broadcastText: '🐚 [관리자] 전 관람객에게 조개 500개 하사!',
      })
      showWalletDeltaFn(500)
      triggerCheerEmoji('🐚')
    }

    const onRemoteNextRound = () => {
      handleNextRound(true)
    }

    window.addEventListener('remote-cheer', onRemoteCheer)
    window.addEventListener('remote-race-start', onRemoteRaceStart)
    window.addEventListener('remote-refill', onRemoteRefill)
    window.addEventListener('remote-next-round', onRemoteNextRound)
    return () => {
      window.removeEventListener('remote-cheer', onRemoteCheer)
      window.removeEventListener('remote-race-start', onRemoteRaceStart)
      window.removeEventListener('remote-refill', onRemoteRefill)
      window.removeEventListener('remote-next-round', onRemoteNextRound)
    }
  }, [])

  // Finish detection
  useEffect(() => {
    if (phase === 'RESULT' && finishOrder.length === 4 && !showResult) {
      const winner = finishOrder[0]
      const myPick = RACERS_CONFIG[selectedRacerId]
      const isWin = winner.id === myPick.id
      const betUsed = betAmountAtStart.current
      let payout = 0
      if (isWin) {
        payout = Math.floor(betUsed * myPick.odds)
        addWinnings(payout)
        showWalletDeltaFn(payout)
        sfx.fanfare(true)
      } else {
        sfx.fanfare(false)
      }
      setTimeout(() => {
        setResultData({ winner, myPick, isWin, payout, betUsed, order: finishOrder })
        setShowResult(true)
      }, 850)
    }
  }, [phase, finishOrder])

  function showWalletDeltaFn(amount) {
    setWalletDelta(amount)
    setTimeout(() => setWalletDelta(null), 1200)
  }

  function handleToggleAudio() {
    sfx.muted = !sfx.muted
    setMuted(sfx.muted)
    if (!sfx.muted) sfx.click()
  }

  function handleSelectRacer(id) {
    if (phase !== 'BETTING') return
    sfx.click()
    selectRacer(id)
    if (realtimeChannel) {
      realtimeChannel.broadcastBet(id, useStore.getState().betAmount)
    }
  }

  function handleRefill() {
    if (!isAdmin) return
    sfx.coin()
    refillClams()
    showWalletDeltaFn(500)
    triggerCheerEmoji('🐚')
    if (realtimeChannel) {
      realtimeChannel.broadcastRefill()
    }
  }

  function handleStartRace(isRemote = false) {
    const s = useStore.getState()
    if (s.phase !== 'BETTING') return
    if (!isRemote && !s.isAdmin) return

    let currentBet = s.betAmount
    if (currentBet <= 0) currentBet = Math.min(50, s.wallet)
    if (currentBet > s.wallet) currentBet = s.wallet
    if (currentBet <= 0) currentBet = 0

    betAmountAtStart.current = currentBet
    if (currentBet > 0) {
      useStore.setState({ wallet: s.wallet - currentBet, betAmount: currentBet })
      showWalletDeltaFn(-currentBet)
    }
    sfx.coin()

    setPhase('COUNTDOWN')
    setFinishOrder([])
    setCountdownNumber(3)
    setBettingModalOpen(false) // 경기 시작 시 배팅 모달 닫기
    window.__startRaceInScene?.()

    if (!isRemote && realtimeChannel) {
      realtimeChannel.broadcastRaceStart()
    }

    setBroadcastText(`🚨 [제 ${s.round} 회전] 출발 준비!`)

    let count = 3
    sfx.countdownBeep(false)

    const timer = setInterval(() => {
      count--
      if (count > 0) {
        setCountdownNumber(count)
        sfx.countdownBeep(false)
      } else if (count === 0) {
        setCountdownNumber(0)
        sfx.countdownBeep(true)
        setPhase('RACING')
        setRaceStartTime(performance.now())
        setBroadcastText('🌊 출발! 생물들이 물살을 가르며 달립니다!')
      } else {
        clearInterval(timer)
      }
    }, 850)
  }

  function handleWaterBoost() {
    if (phase !== 'RACING') return
    const s = useStore.getState()
    if (s.wallet < 10) {
      setBroadcastText('⚠️ 조개가 부족합니다! (최소 10🐚 필요)')
      return
    }
    setWallet(s.wallet - 10)
    showWalletDeltaFn(-10)
    sfx.waterBoost()
    window.__spawnBoostRing?.(selectedRacerId)
    const racer = RACERS_CONFIG[selectedRacerId]
    setBroadcastText(`🌊 [부스트!] ${racer.name}(${racer.emoji}) 급가속 시전!`)
    triggerCheerEmoji('🌊')
  }

  function triggerCheerEmoji(emoji) {
    sfx.click()
    const layer = document.getElementById('emoji-layer')
    if (!layer) return
    for (let i = 0; i < 4; i++) {
      const el = document.createElement('div')
      el.className = 'floating-emoji'
      el.innerText = emoji
      el.style.left = `${25 + Math.random() * 50}%`
      el.style.bottom = `${25 + Math.random() * 20}%`
      layer.appendChild(el)
      setTimeout(() => el.remove(), 1600)
    }
  }

  function handleCheer(emoji) {
    triggerCheerEmoji(emoji)
    if (realtimeChannel) {
      realtimeChannel.broadcastCheer(emoji)
    }
  }

  function handleNextRound(isRemote = false) {
    sfx.click()
    setShowResult(false)
    setResultData(null)
    window.__resetRacers?.()
    prepareNextRound()

    if (!isRemote && realtimeChannel) {
      realtimeChannel.broadcastNextRound()
    }
  }

  const picked = RACERS_CONFIG[selectedRacerId]
  const expectedPayout = Math.floor(betAmount * picked.odds)

  return (
    <>
      {/* Floating Emojis */}
      <div id="emoji-layer" className="fixed inset-0 pointer-events-none z-30 overflow-hidden" />

      {/* MAIN HUD CONTAINER (전체 화면 맞춤, 오버레이) */}
      <div className="fixed inset-0 z-10 flex flex-col justify-between p-2 pointer-events-none overflow-hidden text-amber-100 font-pixel">

        {/* TOP SECTION: 컴팩트한 상단 상태바 */}
        <div className="flex flex-col gap-1 w-full max-w-4xl mx-auto pointer-events-auto">

          {/* Row 1: 바람의나라 상태창 */}
          <div className="rpg-window px-3 py-1 flex items-center justify-between gap-2 shadow-md">
            
            {/* 타이틀 및 상태 */}
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-lg shrink-0">🐚</span>
              <div className="truncate flex items-center gap-1.5 flex-wrap">
                <span className="text-sm font-bold text-[#f5c542] tracking-wider">
                  AQUA VERSE
                </span>
                <span className="px-1.5 py-0.2 text-[9px] bg-[#1a0f08] border border-[#a67440] text-amber-300 font-bold">
                  제 {round} 회전
                </span>
                {isAdmin && (
                  <span className="px-1.5 py-0.2 text-[9px] bg-[#4a1c0d] border border-amber-400 text-amber-300 font-bold">
                    👑 관리자
                  </span>
                )}
                <span className="text-[10px] text-amber-300/80 hidden sm:inline">
                  | 🤿 {nickname}
                </span>
              </div>
            </div>

            {/* 우측: 배팅 장부 버튼 & 조개 & 소리 */}
            <div className="flex items-center gap-1.5 shrink-0">
              {/* NPC 배팅 장부 열기 퀵버튼 */}
              {phase === 'BETTING' && (
                <button
                  onClick={() => setBettingModalOpen(true)}
                  className="px-2 py-0.5 rpg-btn-gold text-[10px] font-bold flex items-center gap-1 shadow"
                  title="배팅 도우미에게 가거나 이 버튼을 클릭하세요"
                >
                  <span>📜</span>
                  <span>배팅 장부</span>
                </button>
              )}

              {/* 조개 지갑 */}
              <div className="rpg-panel-inset px-2 py-0.5 flex items-center gap-1 text-xs text-amber-300 relative">
                <span>🐚</span>
                <span className="font-mono-num font-bold text-xs text-yellow-300">
                  {wallet.toLocaleString()}
                </span>
                {isAdmin && (
                  <button
                    onClick={handleRefill}
                    className="ml-1 px-1 py-0.2 rpg-btn-gold text-[9px] font-bold"
                    title="관리자 조개 충전"
                  >
                    +충전
                  </button>
                )}
                {walletDelta !== null && (
                  <div className="absolute -bottom-4 right-1 pointer-events-none">
                    <span className={`font-mono-num text-[11px] font-bold ${walletDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {walletDelta >= 0 ? '+' : ''}{walletDelta.toLocaleString()}🐚
                    </span>
                  </div>
                )}
              </div>

              <button
                onClick={handleToggleAudio}
                className="rpg-btn w-6 h-6 flex items-center justify-center text-xs"
                title="소리"
              >
                {muted ? '🔇' : '🔊'}
              </button>
            </div>
          </div>

          {/* Row 2: 시스템 중계 메시지 알림창 */}
          <div className="rpg-window px-3 py-0.5 flex items-center justify-between gap-2 text-xs shadow-md">
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <span className="text-amber-400 font-bold shrink-0 text-[11px]">[중계]</span>
              <span className="text-amber-100 truncate text-[11px]">{broadcastText}</span>
            </div>
            <span className="font-mono-num text-amber-300 text-[11px] shrink-0 px-1.5 py-0.2 rpg-panel-inset font-bold">
              {phase === 'RACING' ? `${raceElapsed.toFixed(1)}초` : '대기중'}
            </span>
          </div>
        </div>

        {/* MIDDLE SECTION: 카운트다운 & 관람객 패널 */}
        <div className="relative flex-1 flex items-center justify-center w-full max-w-4xl mx-auto my-1 pointer-events-none">
          {/* 출발 카운트다운 알림판 */}
          {phase === 'COUNTDOWN' && (
            <div className="flex flex-col items-center justify-center z-20">
              <div className="rpg-window px-8 py-3 text-center border-4">
                <div className="text-5xl sm:text-7xl font-bold text-yellow-300 drop-shadow-[2px_2px_0_#000]">
                  {countdownNumber > 0 ? countdownNumber : '출발!'}
                </div>
                <div className="text-xs text-amber-200 mt-1">
                  심해 수로 출발 게이트 개방
                </div>
              </div>
            </div>
          )}

          {/* 우측 하단: 동시 관람객 패널 */}
          <div className="absolute bottom-1 right-1 pointer-events-auto">
            <OnlineUsersPanel />
          </div>
        </div>

        {/* BOTTOM SECTION: 1줄 대화 입력바 & 레이스 조작바 */}
        <div className="w-full max-w-2xl mx-auto pointer-events-auto flex flex-col gap-1 items-center mb-1">
          
          {/* 레이스 진행 중일 때만 뜨는 스킬 조작창 (해류 부스트 / 응원) */}
          {(phase === 'RACING' || phase === 'COUNTDOWN') && (
            <div className="rpg-window px-3 py-1.5 flex items-center justify-between gap-3 shadow-xl w-full">
              <div className="flex items-center gap-2">
                <span className="text-xl p-0.5 bg-[#170e08] border border-[#a67440] shrink-0">
                  {picked.emoji}
                </span>
                <div className="text-xs">
                  <span className="text-[10px] text-amber-400 font-bold block">내 배팅</span>
                  <span className="font-bold text-yellow-300 truncate">
                    {picked.lane}번 {picked.name} ({Math.floor(betAmountAtStart.current * picked.odds)}🐚)
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleWaterBoost}
                  className="rpg-btn-blue px-3 py-1.5 text-xs font-bold flex items-center gap-1"
                >
                  <span>🌊 해류 부스트</span>
                  <span className="text-[10px] font-mono-num text-amber-300">-10🐚</span>
                </button>
                <button
                  onClick={() => handleCheer('🎉')}
                  className="rpg-btn px-2.5 py-1.5 text-xs font-bold"
                >
                  🎉 응원
                </button>
                <button
                  onClick={() => handleCheer('🔥')}
                  className="rpg-btn px-2.5 py-1.5 text-xs font-bold"
                >
                  🔥 가즈아
                </button>
              </div>
            </div>
          )}

          {/* 바람의나라 스타일 1줄 대화 입력바 (머리 위 말풍선 출력) */}
          <div className="w-full">
            <form onSubmit={handleChatSubmit} className="rpg-window px-2 py-1 flex items-center gap-1.5 shadow-xl">
              <span className="text-[11px] font-bold text-amber-300 shrink-0">
                💬 대화:
              </span>
              <input
                ref={chatInputRef}
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="메시지 입력 (Enter 누르면 머리 위에 표시됨)..."
                maxLength={30}
                className="w-full bg-[#150d09] border border-[#4a2e1b] px-2 py-0.5 text-xs text-amber-100 placeholder-amber-800 focus:outline-none focus:border-[#a67440]"
              />
              <button
                type="submit"
                className="rpg-btn px-3 py-0.5 text-xs font-bold shrink-0 text-amber-200"
              >
                전송
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* ========================================================
          NPC 배팅 도우미 대화형 모달 (NPC에게 가거나 클릭 시 오픈)
          ======================================================== */}
      {isBettingModalOpen && phase === 'BETTING' && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-3 bg-black/60 backdrop-blur-[2px] font-pixel text-amber-100">
          <div className="rpg-window max-w-lg w-full p-3.5 sm:p-4 shadow-2xl relative">
            
            {/* 모달 헤더 */}
            <div className="flex items-center justify-between border-b-2 border-[#5c3a20] pb-2 mb-2.5">
              <div className="flex items-center gap-2">
                <span className="text-xl">📜</span>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-yellow-300">
                    [NPC] 배팅 도우미의 장부
                  </h3>
                  <p className="text-[10px] text-amber-300/80">
                    이번 경주에 출전할 생물의 배당을 확인하고 조개를 배팅하십시오.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setBettingModalOpen(false)}
                className="rpg-btn w-6 h-6 flex items-center justify-center text-xs font-bold text-rose-300"
                title="장부 닫기"
              >
                ✕
              </button>
            </div>

            {/* 4마리 출전 생물 카드 그리드 */}
            <div className="grid grid-cols-2 gap-2 mb-2.5">
              {RACERS_CONFIG.map((r) => {
                const active = r.id === selectedRacerId
                const bettors = Object.values(onlineUsers).filter((u) => u.betRacerId === r.id)
                return (
                  <div
                    key={r.id}
                    onClick={() => handleSelectRacer(r.id)}
                    className={`rpg-card p-2 flex flex-col justify-between ${active ? 'active' : ''}`}
                  >
                    <div>
                      <div className="flex items-center justify-between border-b border-[#3d2516] pb-1 mb-1 text-[10px]">
                        <span className="text-amber-300 font-bold">제 {r.lane} 수로</span>
                        <span className="text-yellow-400 font-mono-num font-bold">
                          배당 x{r.odds.toFixed(1)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 my-1">
                        <span className="text-2xl shrink-0">{r.emoji}</span>
                        <div className="min-w-0">
                          <div className="font-bold text-xs text-amber-100 truncate">{r.name}</div>
                          <div className="text-[10px] text-amber-400/80 truncate">{r.traitTitle}</div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-1 pt-1 border-t border-[#3d2516]">
                      <div className="flex justify-between text-[9px] text-amber-400/70 mb-0.5">
                        <span>승률 기대치</span>
                        <span>{r.winProb}%</span>
                      </div>
                      <div className="w-full h-1 bg-[#170e08] border border-[#3d2516]">
                        <div className="h-full" style={{ width: `${r.winProb}%`, background: r.cssColor }} />
                      </div>
                      {bettors.length > 0 && (
                        <div className="mt-1 text-[9px] text-yellow-300 truncate font-bold">
                          배팅: {bettors.map((b) => b.nickname).join(', ')}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* 배팅금 조절 및 요약 */}
            <div className="flex flex-col gap-2 pt-2 border-t border-[#4a2e1b]">
              <div className="rpg-panel-inset p-2 flex items-center justify-between text-xs">
                <div>
                  <span className="text-[10px] text-amber-400/70 block">선택 생물</span>
                  <span className="font-bold text-yellow-300 truncate">
                    {picked.lane}번 {picked.name} {picked.emoji}
                  </span>
                </div>
                <div className="h-6 w-px bg-[#3d2516]" />
                <div>
                  <span className="text-[10px] text-amber-400/70 block">배팅 조개</span>
                  <span className="font-mono-num font-bold text-yellow-300">{betAmount} 🐚</span>
                </div>
                <div className="h-6 w-px bg-[#3d2516]" />
                <div>
                  <span className="text-[10px] text-amber-400/70 block">예상 당첨금</span>
                  <span className="font-mono-num font-bold text-emerald-400">{expectedPayout} 🐚</span>
                </div>
              </div>

              {/* 칩 조절 버튼들 */}
              <div className="flex items-center justify-between gap-1 text-xs">
                <div className="flex items-center gap-1">
                  {[50, 100, 500].map((v) => (
                    <button
                      key={v}
                      onClick={() => { sfx.click(); adjustBet(v) }}
                      className="rpg-btn px-2 py-1 font-mono-num text-[11px]"
                    >
                      +{v}
                    </button>
                  ))}
                  <button
                    onClick={() => { sfx.click(); setBetHalf() }}
                    className="rpg-btn px-2 py-1 text-[11px]"
                  >
                    절반
                  </button>
                  <button
                    onClick={() => { sfx.coin(); setBetMax() }}
                    className="rpg-btn-gold px-2 py-1 text-[11px]"
                  >
                    전부
                  </button>
                  <button
                    onClick={() => { sfx.click(); resetBet() }}
                    className="rpg-btn px-2 py-1 text-[11px] text-rose-300"
                  >
                    취소
                  </button>
                </div>

                <button
                  onClick={() => setBettingModalOpen(false)}
                  className="rpg-btn px-3 py-1 text-xs text-amber-300 font-bold"
                >
                  장부 닫기
                </button>
              </div>

              {/* 관리자 경기 시작 버튼 or 대기 안내 */}
              {isAdmin ? (
                <button
                  onClick={() => handleStartRace(false)}
                  disabled={betAmount <= 0 || betAmount > wallet}
                  className="w-full py-2.5 rpg-btn-gold text-xs sm:text-sm tracking-widest font-bold flex items-center justify-center gap-1.5 mt-1 shadow-md"
                >
                  <span>⚔️</span>
                  <span>경기 시작 징 울리기 (전체 시작)</span>
                </button>
              ) : (
                <div className="w-full py-2 rpg-panel-inset text-center text-xs text-amber-400/80 mt-1">
                  💡 관리자가 경기를 시작할 때까지 배팅을 완료하십시오.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          경기 결과 방 (Official Result)
          ======================================================== */}
      {showResult && resultData && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-3 bg-black/75 font-pixel text-amber-100">
          <div className="rpg-window max-w-sm w-full p-4 text-center">
            <div className="inline-block px-3 py-0.5 bg-[#170e08] border border-[#a67440] text-yellow-400 text-[10px] font-bold mb-2">
              ★ 경기 결과 방 ★
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-yellow-300 mb-1 drop-shadow-[2px_2px_0_#1a0f08]">
              🏆 {resultData.winner.lane}번 {resultData.winner.name} {resultData.winner.emoji} 우승!
            </h2>
            <p className="text-xs text-amber-200/90 mb-3">
              {resultData.isWin
                ? `축하합니다! +${resultData.payout.toLocaleString()} 🐚 획득!`
                : `아쉽습니다. ${resultData.myPick.name} 선수는 낙첨되었습니다.`}
            </p>

            {/* 정산 요약 */}
            <div className="p-2.5 rpg-panel-inset mb-3 flex items-center justify-around text-xs">
              <div>
                <span className="text-[10px] text-amber-400/70 block">내 배팅 생물</span>
                <span className="font-bold text-white">
                  {resultData.myPick.emoji} ({resultData.betUsed}🐚)
                </span>
              </div>
              <div className="h-6 w-px bg-[#3d2516]" />
              <div>
                <span className="text-[10px] text-amber-400/70 block">최종 배당금</span>
                <span className={`font-mono-num font-bold text-sm ${resultData.isWin ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {resultData.isWin ? `+${resultData.payout.toLocaleString()} 🐚` : '0 🐚'}
                </span>
              </div>
            </div>

            {/* 순위표 */}
            <div className="space-y-1 mb-3 text-xs">
              {resultData.order.map((r, i) => (
                <div
                  key={r.id}
                  className={`flex items-center justify-between px-2.5 py-1 border ${
                    i === 0
                      ? 'bg-[#4a2e1b] border-amber-400 text-yellow-300 font-bold'
                      : 'bg-[#1c130d] border-[#3d2516] text-amber-200/80'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono-num">#{i + 1}등</span>
                    <span>{r.emoji}</span>
                    <span>{r.name}</span>
                    {r.id === selectedRacerId && (
                      <span className="px-1 text-[9px] bg-[#170e08] border border-amber-400 text-yellow-300">
                        내 선택
                      </span>
                    )}
                  </div>
                  <span className="font-mono-num text-[11px]">{r.finishTime.toFixed(2)}초</span>
                </div>
              ))}
            </div>

            {/* 다음 라운드 버튼 */}
            {isAdmin ? (
              <button
                onClick={() => handleNextRound(false)}
                className="w-full py-2.5 rpg-btn-gold text-xs sm:text-sm tracking-widest font-bold"
              >
                ⚔️ 다음 회전 배팅 시작하기
              </button>
            ) : (
              <div className="w-full py-2.5 rpg-panel-inset text-xs text-amber-400/70">
                관리자가 다음 회전을 시작할 때까지 대기하십시오...
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
