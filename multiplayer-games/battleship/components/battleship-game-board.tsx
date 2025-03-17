"use client"
import { useState, useEffect } from "react"
import { usePeerStore, type GameState, type Position } from "@/lib/peer-store"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Ship, Target, Crosshair } from "lucide-react"
import { Logger } from "@/lib/logger"

interface BattleshipGameBoardProps {
  gameState: GameState
  sessionId: string
  isMyTurn: boolean // Keep for compatibility
  myPeerId: string
  logger?: any
}

export default function BattleshipGameBoard({
  gameState,
  sessionId,
  isMyTurn,
  myPeerId,
  logger = Logger,
}: BattleshipGameBoardProps) {
  const peer = usePeerStore()
  const [hoveredCell, setHoveredCell] = useState<Position | null>(null)
  const cellSize = 40 // Size of each grid cell in pixels
  const gridSize = gameState.boardSize // Number of cells in the grid

  // Determine if I am player 1 (battleship) or player 2 (cannon)
  // The game creator is always the battleship player
  const isBattleshipPlayer = gameState.currentTurn === myPeerId
  const isCannonPlayer = !isBattleshipPlayer

  // Log component mount and props
  useEffect(() => {
    if (logger) {
      logger.log("BattleshipGameBoard: Component mounted", {
        gameId: gameState.gameId,
        sessionId,
        isMyTurn,
        myPeerId,
        role: isBattleshipPlayer ? "Battleship" : "Cannon",
      })
    }

    return () => {
      if (logger) {
        logger.log("BattleshipGameBoard: Component unmounted")
      }
    }
  }, [gameState.gameId, sessionId, isMyTurn, myPeerId, isBattleshipPlayer, logger])

  const handleCellClick = (x: number, y: number) => {
    if (gameState.gameOver) return

    const position: Position = { x, y }

    if (isBattleshipPlayer) {
      // Player 1 moves the battleship
      peer.moveBattleship(gameState.gameId, sessionId, position)
      if (logger) {
        logger.log(`Moving battleship to (${x}, ${y})`)
      }
    } else {
      // Player 2 fires the cannon
      peer.fireCannon(gameState.gameId, sessionId, position)
      if (logger) {
        logger.log(`Firing cannon at (${x}, ${y})`)
      }
    }
  }

  const getLastActionText = () => {
    if (!gameState.lastAction) return null

    const isMe = gameState.lastAction.player === myPeerId
    const playerText = isMe ? "You" : "Opponent"

    switch (gameState.lastAction.type) {
      case "move":
        return `${playerText} moved the battleship to (${gameState.lastAction.position?.x}, ${gameState.lastAction.position?.y})`
      case "fire":
        return `${playerText} fired at (${gameState.lastAction.position?.x}, ${gameState.lastAction.position?.y})`
      default:
        return null
    }
  }

  const lastActionText = getLastActionText()

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex justify-between items-center">
            <CardTitle>Battleship Game #{gameState.gameId.split("-")[1]}</CardTitle>
            <Badge variant="default">
              {gameState.gameOver
                ? gameState.winner === myPeerId
                  ? "You Won!"
                  : "You Lost!"
                : isBattleshipPlayer
                  ? "You are the Battleship"
                  : "You are the Cannon"}
            </Badge>
          </div>
          <CardDescription>You are the {isBattleshipPlayer ? "Battleship" : "Cannon"} player</CardDescription>
          {lastActionText && <div className="mt-2 text-sm font-medium">Last action: {lastActionText}</div>}
          {gameState.gameOver && (
            <div className="mt-2 text-lg font-bold text-center">
              {gameState.winner === myPeerId ? "Congratulations! You won!" : "Game over! Your opponent won."}
            </div>
          )}
        </CardHeader>
      </Card>

      {/* Game board */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Game Board</CardTitle>
          <CardDescription>
            {isBattleshipPlayer ? "Click to move your battleship" : "Click to fire your cannon"}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <div
            className="grid gap-px bg-gray-200 p-1 rounded-md"
            style={{
              gridTemplateColumns: `repeat(${gridSize}, ${cellSize}px)`,
              gridTemplateRows: `repeat(${gridSize}, ${cellSize}px)`,
            }}
          >
            {Array.from({ length: gridSize * gridSize }).map((_, index) => {
              const x = index % gridSize
              const y = Math.floor(index / gridSize)

              // Check if this cell contains the battleship
              const hasBattleship = x === gameState.battleshipPosition.x && y === gameState.battleshipPosition.y

              // Check if this cell has a cannon shot
              const cannonShot = gameState.cannonShots.find((shot) => shot.position.x === x && shot.position.y === y)

              // Determine cell styling
              const isHovered = hoveredCell?.x === x && hoveredCell?.y === y

              return (
                <div
                  key={`${x}-${y}`}
                  className={`
                    flex items-center justify-center 
                    ${!gameState.gameOver ? "cursor-pointer hover:bg-blue-100" : ""}
                    ${isHovered ? "bg-blue-100" : "bg-white"}
                    border border-gray-300
                  `}
                  style={{ width: cellSize, height: cellSize }}
                  onClick={() => !gameState.gameOver && handleCellClick(x, y)}
                  onMouseEnter={() => setHoveredCell({ x, y })}
                  onMouseLeave={() => setHoveredCell(null)}
                >
                  {hasBattleship && (isBattleshipPlayer || cannonShot) && (
                    <Ship className={`text-blue-600 ${cannonShot ? "text-red-600" : ""}`} size={cellSize * 0.8} />
                  )}
                  {cannonShot && !hasBattleship && (
                    <div
                      className="rounded-full bg-red-500 opacity-70"
                      style={{
                        width: cellSize * 0.5,
                        height: cellSize * 0.5,
                      }}
                    />
                  )}
                  {isHovered &&
                    !gameState.gameOver &&
                    !hasBattleship &&
                    !cannonShot &&
                    (isBattleshipPlayer ? (
                      <Ship className="text-blue-300 opacity-50" size={cellSize * 0.8} />
                    ) : (
                      <Crosshair className="text-red-300 opacity-50" size={cellSize * 0.5} />
                    ))}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Game instructions */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">How to Play (Real-time Mode)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {isBattleshipPlayer ? (
              <>
                <p>
                  You control the battleship <Ship className="inline text-blue-600" size={20} />.
                </p>
                <p>Click on any cell to move your battleship there.</p>
                <p>Avoid getting hit by the cannon shots!</p>
                <p className="font-medium mt-2">This is real-time mode - you can move at any time!</p>
              </>
            ) : (
              <>
                <p>
                  You control the cannon <Target className="inline text-red-600" size={20} />.
                </p>
                <p>Click on any cell to fire your cannon there.</p>
                <p>Try to hit the battleship to win!</p>
                <p className="font-medium mt-2">This is real-time mode - you can fire at any time!</p>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

