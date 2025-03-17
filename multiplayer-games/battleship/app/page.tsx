"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Bug } from "lucide-react"
import { StartPage } from "@/components/start-page"
import { DebugPanel } from "@/components/debug-panel"
import GameRoom from "@/components/game-room"
import { DEFAULT_GROUP } from "@/lib/token-service"
import { Logger } from "@/lib/logger"
// Remove the direct import of usePeerStore

export default function Home() {
  const [isStarted, setIsStarted] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [showDebug, setShowDebug] = useState(false)

  // The rest of your component remains the same
  const handleGameStart = () => {
    setIsStarted(true)
  }

  const toggleDebug = () => {
    setShowDebug(!showDebug)
    Logger.log(`Debug panel ${!showDebug ? "opened" : "closed"}`)
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8 text-center relative">
          <h1 className="text-3xl font-bold text-gray-800">Battleship Game</h1>
          <p className="text-gray-600">A peer-to-peer battleship game using WebRTC</p>

          <Button variant="outline" size="sm" onClick={toggleDebug} className="absolute right-0 top-0">
            <Bug className="h-4 w-4 mr-2" />
            Debug
          </Button>
        </header>

        {showDebug && (
          <DebugPanel onClose={toggleDebug} errorMessage={errorMessage} setErrorMessage={setErrorMessage} />
        )}

        <main>
          {!isStarted ? (
            <StartPage onGameStart={handleGameStart} errorMessage={errorMessage} setErrorMessage={setErrorMessage} />
          ) : (
            <GameRoom groupId={DEFAULT_GROUP} logger={Logger} />
          )}
        </main>
      </div>
    </div>
  )
}

