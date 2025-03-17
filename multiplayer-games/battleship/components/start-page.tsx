"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Copy, Loader2 } from "lucide-react"
import { Logger } from "@/lib/logger"
import { TokenService, DEFAULT_GROUP } from "@/lib/token-service"
import { usePeerStore } from "@/lib/peer-store"

interface StartPageProps {
  onGameStart: () => void
  errorMessage: string | null
  setErrorMessage: (message: string | null) => void
}

export function StartPage({ onGameStart, errorMessage, setErrorMessage }: StartPageProps) {
  const [peerId, setPeerId] = useState("")
  const [startLoading, setStartLoading] = useState(false)
  const peer = usePeerStore()

  const handleStart = async () => {
    if (!peerId) {
      Logger.error("Missing peer ID")
      setErrorMessage("Please enter a peer ID")
      return
    }

    try {
      setStartLoading(true)
      setErrorMessage(null)

      Logger.log(`Starting peer connection process for peer: ${peerId}`)

      // Get token from Cloudflare Worker
      const token = await TokenService.getToken(peerId, DEFAULT_GROUP)

      // Start the peer with the generated token
      Logger.log("Starting peer with generated token")
      try {
        await peer.start(peerId, token)
        Logger.log("Peer started successfully")
      } catch (peerError) {
        Logger.error("Error starting peer", peerError)
        throw peerError
      }

      Logger.log("Peer connection process completed successfully")
      onGameStart()
    } catch (error) {
      Logger.error("Failed to start peer", error)
      setErrorMessage(error instanceof Error ? error.message : "Unknown error occurred. Check console for details.")
    } finally {
      setStartLoading(false)
    }
  }

  // Add a check before accessing navigator.clipboard
  const handleCopyPeerId = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(peerId)
      Logger.log(`Copied peer ID to clipboard: ${peerId}`)
    } else {
      Logger.log(`Cannot copy to clipboard: browser API not available`)
    }
  }

  // Generate a random peer ID
  const generateRandomPeerId = () => {
    const randomId = `player-${Math.floor(Math.random() * 10000)}`
    setPeerId(randomId)
    Logger.log(`Generated random peer ID: ${randomId}`)
  }

  return (
    <Card className="max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Start a Game</CardTitle>
        <CardDescription>Enter your peer ID to begin</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {errorMessage && (
          <Alert variant="destructive" className="mb-4">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <label htmlFor="peerId" className="text-sm font-medium">
            Peer ID (choose any unique identifier)
          </label>
          <div className="flex gap-2">
            <Input
              id="peerId"
              value={peerId}
              onChange={(e) => setPeerId(e.target.value)}
              placeholder="e.g., player123"
              disabled={startLoading}
            />
            <Button
              variant="outline"
              size="icon"
              onClick={generateRandomPeerId}
              title="Generate Random ID"
              disabled={startLoading}
            >
              🎲
            </Button>
            {peerId && (
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopyPeerId}
                title="Copy Peer ID"
                disabled={startLoading}
              >
                <Copy className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        <Button onClick={handleStart} className="w-full" disabled={!peerId || startLoading}>
          {startLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Starting...
            </>
          ) : (
            "Start Game"
          )}
        </Button>
      </CardContent>
      <CardFooter className="flex justify-center text-xs text-gray-500">
        <p>This application uses WebRTC for peer-to-peer communication. Make sure your browser supports WebRTC.</p>
      </CardFooter>
    </Card>
  )
}

