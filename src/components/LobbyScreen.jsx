import { useState } from 'react'
import useStore from '../store/useStore'
import { ADMIN_PASSWORD } from '../constants'

export default function LobbyScreen() {
  const [nickname, setNickname] = useState('')
  const [password, setPassword] = useState('')
  const [showPasswordField, setShowPasswordField] = useState(false)
  const [error, setError] = useState('')
  const enterGame = useStore((s) => s.enterGame)

  const isAdminNick = nickname.trim().toLowerCase() === 'admin'

  const handleNicknameChange = (e) => {
    const val = e.target.value
    setNickname(val)
    setError('')
    if (val.trim().toLowerCase() === 'admin') {
      setShowPasswordField(true)
    } else {
      setShowPasswordField(false)
      setPassword('')
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const trimmed = nickname.trim()
    if (!trimmed) {
      setError('캐릭터 닉네임을 입력하십시오.')
      return
    }
    if (trimmed.length > 12) {
      setError('닉네임은 12자 이내여야 합니다.')
      return
    }

    if (isAdminNick) {
      if (password !== ADMIN_PASSWORD) {
        setError('관리자 암호가 일치하지 않습니다.')
        return
      }
      enterGame(trimmed, true)
    } else {
      enterGame(trimmed, false)
    }
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4 bg-slate-950 z-50">
      {/* 바람의나라 / 라그나로크 감성 원목 윈도우 */}
      <div className="rpg-window max-w-sm w-full p-6 relative z-10 text-amber-100">
        
        {/* 현판 타이틀 */}
        <div className="text-center mb-5 pb-3 border-b-2 border-[#5c3a20]">
          <div className="inline-block px-3 py-0.5 bg-[#170e08] border border-[#a67440] text-amber-400 text-[11px] mb-2">
            [ 2D 온라인 심해 경주장 ]
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-widest text-[#f5c542] drop-shadow-[2px_2px_0_#1a0f08]">
            AQUA VERSE
          </h1>
          <p className="text-xs text-amber-200/80 mt-1">
            바람의나라 · 라그나로크 감성 2D 메타버스
          </p>

          {/* 4대 출전 생물 */}
          <div className="flex justify-center gap-4 mt-3 py-2 bg-[#170e08] border border-[#4a2e1b] text-xl">
            <span title="총알 새우">🦐</span>
            <span title="옆걸음 꽃게">🦀</span>
            <span title="집게 랍스터">🦞</span>
            <span title="먹물 문어">🐙</span>
          </div>
        </div>

        {/* 닉네임 입력 폼 */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-amber-300 mb-1.5 font-bold">
              ▶ 닉네임 (캐릭터 이름)
            </label>
            <div className="rpg-panel-inset p-1.5">
              <input
                type="text"
                value={nickname}
                onChange={handleNicknameChange}
                placeholder="예: 바람의검사"
                maxLength={12}
                className="w-full px-2 py-1.5 bg-transparent text-amber-100 text-sm focus:outline-none placeholder-amber-800"
                autoFocus
              />
            </div>
          </div>

          {/* 관리자 암호 입력란 */}
          {showPasswordField && (
            <div className="p-3 bg-[#1d120a] border-2 border-[#a46f17]">
              <label className="block text-xs text-amber-300 mb-1 font-bold">
                🔐 관리자 암호
              </label>
              <div className="rpg-panel-inset p-1 mb-1">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    setError('')
                  }}
                  placeholder="암호를 입력하세요"
                  className="w-full px-2 py-1 bg-transparent text-amber-200 text-sm focus:outline-none"
                />
              </div>
              <p className="text-[10px] text-amber-300/80">
                * 관리자는 경기 시작 및 전체 조개 충전 권한이 주어집니다.
              </p>
            </div>
          )}

          {/* 에러 메시지 */}
          {error && (
            <div className="p-2 bg-[#3d0f0c] border border-rose-500 text-rose-200 text-xs text-center font-bold">
              ! {error}
            </div>
          )}

          {/* 입장 버튼 */}
          <button
            type="submit"
            className="w-full py-3 rpg-btn-gold text-sm tracking-widest flex items-center justify-center gap-2 mt-2"
          >
            <span>⚔️</span>
            <span>{isAdminNick ? '관리자 신분으로 입장' : '관람석 입장하기'}</span>
          </button>
        </form>

        <div className="mt-4 pt-3 border-t border-[#4a2e1b] text-center text-[10px] text-amber-400/60">
          실시간 관람석 위치 공유 · 실시간 배팅 동기화
        </div>
      </div>
    </div>
  )
}
