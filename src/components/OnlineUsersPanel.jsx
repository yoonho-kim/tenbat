import useStore from '../store/useStore'
import { RACERS_CONFIG } from '../constants'

export default function OnlineUsersPanel() {
  const onlineUsers = useStore((s) => s.onlineUsers)
  const nickname = useStore((s) => s.nickname)
  const isAdmin = useStore((s) => s.isAdmin)
  const selectedRacerId = useStore((s) => s.selectedRacerId)
  const betAmount = useStore((s) => s.betAmount)

  const users = Object.entries(onlineUsers)
  const totalCount = users.length + 1

  return (
    <div className="rpg-window p-2 pointer-events-auto max-w-[210px] w-full text-amber-100 text-xs">
      <div className="flex items-center justify-between border-b border-[#5c3a20] pb-1 mb-1.5">
        <span className="text-[11px] font-bold text-amber-300 flex items-center gap-1">
          <span className="w-1.5 h-1.5 bg-emerald-400 inline-block animate-pulse"></span>
          동시 관람객
        </span>
        <span className="text-amber-400 font-bold text-[10px]">{totalCount}명</span>
      </div>
      
      <div className="rpg-panel-inset p-1 space-y-1 max-h-24 overflow-y-auto no-scrollbar text-[11px]">
        {/* 나 자신 */}
        <div className="flex items-center justify-between text-amber-200 bg-[#3a2416]/80 px-1 py-0.5 border border-[#8c5830]">
          <span className="truncate max-w-[90px] font-bold">
            {isAdmin && <span className="text-amber-400 mr-0.5">👑</span>}
            {nickname}*
          </span>
          <span className="text-amber-300 text-[10px] shrink-0 font-mono-num font-bold">
            {RACERS_CONFIG[selectedRacerId]?.emoji} {betAmount}🐚
          </span>
        </div>

        {/* 타 접속자들 */}
        {users.map(([uid, data]) => (
          <div key={uid} className="flex items-center justify-between text-amber-200/80 px-1 py-0.5">
            <span className="truncate max-w-[90px]">
              {data.isAdmin && <span className="text-amber-400 mr-0.5">👑</span>}
              {data.nickname || '나그네'}
            </span>
            <span className="text-amber-300/80 text-[10px] shrink-0 font-mono-num">
              {data.betRacerId !== null && data.betRacerId !== undefined
                ? `${RACERS_CONFIG[data.betRacerId]?.emoji || ''} ${data.betAmount || 0}🐚`
                : '-'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
