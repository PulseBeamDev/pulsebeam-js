"use client"
import { useState, useEffect } from "react"
import type React from "react"

import { usePeerStore, setPeerStoreLogger } from "@/lib/peer-store"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import BattleshipGameBoard from "@/components/battleship-game-board"
import { AlertCircle, Loader2 } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Logger } from "@/lib/logger"

interface GameRoomProps {
  groupId: string
  logger?: any
}

export default function GameRoom({ groupId, logger = Logger }: GameRoomProps) {
  const peer = usePeerStore()
  const [otherPeerId, setOtherPeerId] = useState("")
  const [gameCreated, setGameCreated] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [waitingForConnection, setWaitingForConnection] = useState(false)

  // Set up logger if provided
  useEffect(() => {
    if (logger) {
      setPeerStoreLogger(logger)
      logger.log("GameRoom: Logger set for peer store")
    }
  }, [logger])

  // Log component mount
  useEffect(() => {
    if (logger) {
      logger.log("GameRoom: Component mounted", { groupId })
    }

    return () => {
      if (logger) {
        logger.log("GameRoom: Component unmounted")
      }
    }
  }, [groupId, logger])

  // Check if peer is still valid
  useEffect(() => {
    if (!peer.ref) {
      if (logger) {
        logger.error("GameRoom: Peer reference lost, reloading page")
      }
      // If peer reference is lost, reload the page
      window.location.reload()
    }
  }, [peer.ref, logger])

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!otherPeerId) {
      if (logger) {
        logger.error("GameRoom: Cannot connect - no peer ID provided")
      }
      return
    }

    if (logger) {
      logger.log(`GameRoom: Connecting to peer ${otherPeerId} in group ${groupId}`)
    }

    setConnecting(true)
    setConnectionError(null)

    try {
      // Pass the group ID to the connect function
      await peer.connect(otherPeerId, groupId)
      if (logger) {
        logger.log(`GameRoom: Successfully connected to peer ${otherPeerId}`)
      }

      // Set a waiting period to ensure the connection is fully established
      setWaitingForConnection(true)
      setTimeout(() => {
        setWaitingForConnection(false)
      }, 3000) // Wait 3 seconds for the connection to stabilize
    } catch (error) {
      if (logger) {
        logger.error("GameRoom: Connection error", error)
      }
      setConnectionError(error instanceof Error ? error.message : "Failed to connect to peer")
    } finally {
      setConnecting(false)
    }
  }

  const handleCreateGame = () => {
    const sessionId = Object.keys(peer.sessions)[0]
    if (!sessionId) {
      if (logger) {
        logger.error("GameRoom: Cannot create game - no active session")
      }
      return
    }

    if (logger) {
      logger.log("GameRoom: Creating new game")
    }

    // Check if the session is ready for sending data
    const session = peer.sessions[sessionId]
    if (session.loading || session.sess.connectionState !== "connected") {
      if (logger) {
        logger.error("GameRoom: Cannot create game - connection not ready", {
          loading: session.loading,
          connectionState: session.sess.connectionState,
        })
      }
      setConnectionError("Connection not fully established. Please wait a moment and try again.")
      return
    }

    // Check if the data channel is available and open
    if (!session.dataChannel || session.dataChannel.readyState !== "open") {
      if (logger) {
        logger.error("GameRoom: Cannot create game - data channel not ready", {
          hasDataChannel: !!session.dataChannel,
          dataChannelState: session.dataChannel ? session.dataChannel.readyState : "none",
        })
      }
      setConnectionError("WebRTC data channel not ready. Please wait a moment and try again.")
      return
    }

    try {
      const gameState = peer.createGame()
      peer.sendGameState(gameState, sessionId)
      setGameCreated(true)

      if (logger) {
        logger.log(`GameRoom: Game created with ID ${gameState.gameId}`)
      }
    } catch (error) {
      if (logger) {
        logger.error("GameRoom: Error creating game", error)
      }
      setConnectionError(error instanceof Error ? error.message : "Failed to create game. Please try again.")
    }
  }

  const handleEndSession = () => {
    if (logger) {
      logger.log("GameRoom: Ending session")
    }

    // Properly close all connections
    peer.stop()

    // Clear any local storage that might be persisting state
    try {
      // Clear any session-related data from localStorage
      const keysToRemove = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && (key.includes("peer") || key.includes("session") || key.includes("webrtc"))) {
          keysToRemove.push(key)
        }
      }

      keysToRemove.forEach((key) => localStorage.removeItem(key))

      if (logger) {
        logger.log(`GameRoom: Cleared ${keysToRemove.length} localStorage items`)
      }
    } catch (error) {
      if (logger) {
        logger.error("GameRoom: Error clearing localStorage", error)
      }
    }

    // Redirect to home instead of reloading to ensure a fresh start
    window.location.href = window.location.pathname
  }

  const sessions = Object.entries(peer.sessions)
  const hasActiveSession = sessions.length > 0
  const sessionId = hasActiveSession ? sessions[0][0] : null
  const gameState = sessionId ? peer.sessions[sessionId].gameState : null
  const sessionInfo = sessionId ? peer.sessions[sessionId] : null

  // Log state changes
  useEffect(() => {
    if (logger) {
      logger.log("GameRoom: State updated", {
        hasActiveSession,
        sessionId,
        hasGameState: !!gameState,
        peerDebugInfo: peer.debugInfo(),
      })
    }
  }, [hasActiveSession, sessionId, gameState, peer, logger])

  // Check if the data channel is ready
  const isDataChannelReady = sessionInfo && sessionInfo.dataChannel && sessionInfo.dataChannel.readyState === "open"

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Battleship Game</h2>

        <Button onClick={handleEndSession} variant="destructive">
          End Session
        </Button>
      </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Your Peer ID</AlertTitle>
        <AlertDescription className="font-mono">
          {peer.peerId}
          <p className="text-xs font-sans mt-1 text-muted-foreground">
            Share this ID with others so they can connect to you
          </p>
        </AlertDescription>
      </Alert>

      {/* Connection status */}
      <Card>
        <CardContent className="pt-6">
          {hasActiveSession ? (
            <div className="space-y-4">
              <div className="text-green-500 font-medium">
                Connected to: {sessions[0][1].sess.other.peerId}
                {sessionInfo && (
                  <div className="text-xs text-gray-500">
                    Connection state: {sessionInfo.sess.connectionState}
                    {sessionInfo.loading && " (still establishing...)"}
                    {sessionInfo.dataChannel && <div>Data channel state: {sessionInfo.dataChannel.readyState}</div>}
                  </div>
                )}
              </div>

              {!gameState && (
                <div>
                  <Button onClick={handleCreateGame} disabled={waitingForConnection || !isDataChannelReady}>
                    {waitingForConnection ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Establishing connection...
                      </>
                    ) : !isDataChannelReady ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Waiting for data channel...
                      </>
                    ) : (
                      "Create New Game"
                    )}
                  </Button>
                  {(waitingForConnection || !isDataChannelReady) && (
                    <p className="text-xs text-gray-500 mt-2">
                      Please wait while the WebRTC connection is being established...
                    </p>
                  )}
                </div>
              )}

              {connectionError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{connectionError}</AlertDescription>
                </Alert>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-yellow-500 font-medium">Not connected to anyone yet</div>

              {connectionError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Connection Error</AlertTitle>
                  <AlertDescription>{connectionError}</AlertDescription>
                </Alert>
              )}

              <form onSubmit={handleConnect} className="flex gap-2">
                <Input
                  type="text"
                  placeholder="Enter peer ID to connect"
                  value={otherPeerId}
                  onChange={(e) => setOtherPeerId(e.target.value)}
                  className="flex-1"
                  disabled={connecting || peer.loading}
                />

                <Button type="submit" disabled={connecting || peer.loading || !otherPeerId}>
                  {connecting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    "Connect"
                  )}
                </Button>
              </form>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Game board */}
      {gameState && sessionId && (
        <BattleshipGameBoard
          gameState={gameState}
          sessionId={sessionId}
          isMyTurn={gameState.currentTurn === peer.peerId}
          myPeerId={peer.peerId}
          logger={logger}
        />
      )}
    </div>
  )
}

