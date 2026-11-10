import useStore from './store/useStore'
import LobbyScreen from './components/LobbyScreen'
import Arena2D from './components/Arena2D'
import GameHUD from './components/GameHUD'
import { useRealtimeChannel } from './hooks/useRealtimeChannel'

export default function App() {
  const screen = useStore((s) => s.screen)
  const realtimeChannel = useRealtimeChannel()

  if (screen === 'lobby') {
    return <LobbyScreen />
  }

  return (
    <>
      <Arena2D realtimeChannel={realtimeChannel} />
      <GameHUD realtimeChannel={realtimeChannel} />
    </>
  )
}
