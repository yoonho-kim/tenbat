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
      setError('닉네임을 입력해주세요.')
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
      <div className="rpg-window max-w-xs w-full p-6 text-amber-100 shadow-2xl">
        {/* 심플한 타이틀 */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold tracking-wider text-[#f5c542] drop-shadow-[2px_2px_0_#1a0f08]">
            AQUA VERSE
          </h1>
        </div>

        {/* 닉네임 입력 및 입장 버튼 */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <div className="rpg-panel-inset p-2">
              <input
                type="text"
                value={nickname}
                onChange={handleNicknameChange}
                placeholder="닉네임 입력"
                maxLength={12}
                className="w-full px-2 py-1.5 bg-transparent text-amber-100 text-sm focus:outline-none placeholder-amber-700/80 text-center font-bold"
                autoFocus
              />
            </div>
          </div>

          {/* 관리자 암호 (닉네임이 admin일 때만 간결하게 표시) */}
          {showPasswordField && (
            <div className="rpg-panel-inset p-2">
              <input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  setError('')
                }}
                placeholder="관리자 암호 입력"
                className="w-full px-2 py-1 bg-transparent text-amber-200 text-xs focus:outline-none text-center"
              />
            </div>
          )}

          {/* 에러 메시지 */}
          {error && (
            <div className="p-1.5 bg-rose-950/80 border border-rose-600 text-rose-300 text-xs text-center">
              {error}
            </div>
          )}

          {/* 입장 버튼 */}
          <button
            type="submit"
            className="w-full py-3 rpg-btn-gold text-sm font-bold tracking-widest flex items-center justify-center cursor-pointer active:scale-95 transition-transform"
          >
            입 장
          </button>
        </form>
      </div>
    </div>
  )
}
