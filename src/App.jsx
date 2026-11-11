import useStore from './store/useStore'
import LobbyScreen from './components/LobbyScreen'
import Arena2D from './components/Arena2D'
import GameHUD from './components/GameHUD'
import { useRealtimeChannel } from './hooks/useRealtimeChannel'

export default function App() {
  const screen = useStore((s) => s.screen)
  const isMobileRotate = useStore((s) => s.isMobileRotate)
  const realtimeChannel = useRealtimeChannel()

  if (screen === 'lobby') {
    return <LobbyScreen />
  }

  return (
    <div
      className={
        isMobileRotate
          ? 'fixed inset-0 w-[100vh] h-[100vw] origin-top-left overflow-hidden bg-slate-950 select-none'
          : 'fixed inset-0 overflow-hidden bg-slate-950 select-none'
      }
      style={
        isMobileRotate
          ? {
              transform: 'translate(100vw, 0) rotate(90deg)',
              transformOrigin: 'top left',
            }
          : undefined
      }
    >
      <Arena2D realtimeChannel={realtimeChannel} />
      <GameHUD realtimeChannel={realtimeChannel} />
    </div>
  )
}
