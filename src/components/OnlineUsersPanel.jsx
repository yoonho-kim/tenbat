import useStore from '../store/useStore'
import { RACERS_CONFIG } from '../constants'

export default function OnlineUsersPanel({ isMobileModal = false, onClose }) {
  const onlineUsers = useStore((s) => s.onlineUsers)
  const nickname = useStore((s) => s.nickname)
  const isAdmin = useStore((s) => s.isAdmin)
  const selectedRacerId = useStore((s) => s.selectedRacerId)
  const betAmount = useStore((s) => s.betAmount)
  const connectionStatus = useStore((s) => s.connectionStatus)
  const connectionErrorMsg = useStore((s) => s.connectionErrorMsg)

  // 타 접속자 목록 (나 자신 제외)
  const otherUsers = Object.entries(onlineUsers).filter(
    ([, data]) => data?.nickname && data.nickname !== nickname
  )
  const totalCount = otherUsers.length + 1

  const content = (
    <div className={`rpg-window p-2.5 pointer-events-auto ${isMobileModal ? 'w-full max-w-xs' : 'max-w-[220px] w-full'} text-amber-100 text-xs shadow-2xl`}>
      <div className="flex items-center justify-between border-b border-[#5c3a20] pb-1.5 mb-2">
        <span className="text-[11px] font-bold text-amber-300 flex items-center gap-1.5">
          {connectionStatus === 'connected' && (
            <span className="w-2 h-2 bg-emerald-400 rounded-full inline-block animate-pulse" title="실시간 동기화 정상"></span>
          )}
          {connectionStatus === 'connecting' && (
            <span className="w-2 h-2 bg-amber-400 rounded-full inline-block animate-ping" title="서버 연결 중"></span>
          )}
          {(connectionStatus === 'error' || connectionStatus === 'permission_denied') && (
            <span className="w-2 h-2 bg-rose-500 rounded-full inline-block" title="연결 오류"></span>
          )}
          동시 관람객
        </span>
        <div className="flex items-center gap-2">
          <span className="text-amber-400 font-bold text-[11px]">
            {connectionStatus === 'connected' ? `${totalCount}명` : '점검중'}
          </span>
          {isMobileModal && (
            <button
              onClick={onClose}
              className="rpg-btn w-5 h-5 flex items-center justify-center text-xs text-rose-300 font-bold"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* 상태 경고 배너 */}
      {connectionStatus === 'permission_denied' && (
        <div className="bg-rose-950/90 border border-rose-600 p-1.5 mb-2 rounded text-[10px] text-rose-200 leading-tight">
          ⚠️ <b>Firebase 보안 규칙 오류</b>
          <p className="mt-0.5 text-[9px] text-rose-300">
            Realtime DB의 <b>규칙(Rules)</b> 탭에서 <code>.read: true, .write: true</code>로 변경해주세요.
          </p>
        </div>
      )}

      {connectionStatus === 'error' && (
        <div className="bg-amber-950/90 border border-amber-600 p-1.5 mb-2 rounded text-[10px] text-amber-200 leading-tight">
          ⚠️ <b>Firebase 연결 오류</b>
          <p className="mt-0.5 text-[9px] text-amber-300 truncate" title={connectionErrorMsg}>
            {connectionErrorMsg || '환경변수 및 URL을 확인하세요.'}
          </p>
        </div>
      )}

      <div className="rpg-panel-inset p-1.5 space-y-1 max-h-48 overflow-y-auto no-scrollbar text-[11px]">
        {/* 나 자신 */}
        <div className="flex items-center justify-between text-amber-200 bg-[#3a2416]/80 px-2 py-1 border border-[#8c5830]">
          <span className="truncate max-w-[110px] font-bold">
            {isAdmin && <span className="text-amber-400 mr-0.5">👑</span>}
            {nickname}*
          </span>
          <span className="text-amber-300 text-[10px] shrink-0 font-mono-num font-bold">
            {RACERS_CONFIG[selectedRacerId]?.emoji} {betAmount}🐚
          </span>
        </div>

        {/* 타 접속자들 */}
        {otherUsers.length === 0 ? (
          <div className="text-center py-2 text-[10px] text-amber-400/60">
            현재 다른 접속자가 없습니다.
          </div>
        ) : (
          otherUsers.map(([uid, data]) => (
            <div key={uid} className="flex items-center justify-between text-amber-200/80 px-2 py-1">
              <span className="truncate max-w-[110px]">
                {data.isAdmin && <span className="text-amber-400 mr-0.5">👑</span>}
                {data.nickname || '나그네'}
              </span>
              <span className="text-amber-300/80 text-[10px] shrink-0 font-mono-num">
                {data.betRacerId !== null && data.betRacerId !== undefined
                  ? `${RACERS_CONFIG[data.betRacerId]?.emoji || ''} ${data.betAmount || 0}🐚`
                  : '-'}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )

  if (isMobileModal) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
        {content}
      </div>
    )
  }

  return content
}
