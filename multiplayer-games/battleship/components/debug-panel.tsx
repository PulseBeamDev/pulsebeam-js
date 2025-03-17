"use client"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Logger } from "@/lib/logger"
import { TokenService } from "@/lib/token-service"
import { usePeerStore } from "@/lib/peer-store"

interface DebugPanelProps {
  onClose: () => void
  errorMessage: string | null
  setErrorMessage: (message: string | null) => void
}

export function DebugPanel({ onClose, errorMessage, setErrorMessage }: DebugPanelProps) {
  const [logs, setLogs] = useState<string[]>([])
  const peer = usePeerStore()

  // Update logs periodically
  useEffect(() => {
    const updateLogs = () => {
      setLogs([...Logger.getLogs()])
    }

    // Initial update
    updateLogs()

    // Set up listener for log changes
    const removeListener = Logger.addListener(updateLogs)

    // Set up interval for periodic updates (as a backup)
    const interval = setInterval(updateLogs, 1000)

    return () => {
      clearInterval(interval)
      removeListener()
    }
  }, [])

  const clearLogs = () => {
    Logger.clear()
  }

  const testCloudflareWorker = async () => {
    const result = await TokenService.testWorker()
    setErrorMessage(result.message)
  }

  // Add a check before accessing navigator
  const getEnvironmentInfo = () => {
    if (typeof window === "undefined" || typeof navigator === "undefined") {
      return {
        userAgent: "SSR",
        language: "SSR",
        platform: "SSR",
        webRTC: {
          RTCPeerConnection: false,
          RTCSessionDescription: false,
          RTCIceCandidate: false,
        },
        url: "SSR",
        protocol: "SSR",
        host: "SSR",
      }
    }

    return {
      userAgent: navigator.userAgent,
      language: navigator.language,
      platform: navigator.platform,
      webRTC: {
        RTCPeerConnection: typeof RTCPeerConnection !== "undefined",
        RTCSessionDescription: typeof RTCSessionDescription !== "undefined",
        RTCIceCandidate: typeof RTCIceCandidate !== "undefined",
      },
      url: window.location.href,
      protocol: window.location.protocol,
      host: window.location.host,
    }
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Debug Information</CardTitle>
          <div className="space-x-2">
            <Button variant="outline" size="sm" onClick={clearLogs}>
              Clear Logs
            </Button>
            <Button variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-medium mb-2">Application Logs ({logs.length})</h3>
            <div className="bg-black text-green-400 p-4 rounded-md font-mono text-xs h-64 overflow-y-auto">
              {logs.map((log, index) => (
                <div key={index} className="mb-1 whitespace-pre-wrap">
                  {log}
                </div>
              ))}
              {logs.length === 0 && <div>No logs yet</div>}
            </div>
          </div>

          <div>
            <h3 className="text-lg font-medium mb-2">Application State</h3>
            <div className="bg-black text-green-400 p-4 rounded-md font-mono text-xs overflow-x-auto">
              <pre>
                {JSON.stringify(
                  {
                    errorMessage,
                    peerState: {
                      loading: peer.loading,
                      peerId: peer.peerId,
                      hasRef: !!peer.ref,
                      sessionCount: Object.keys(peer.sessions).length,
                    },
                  },
                  null,
                  2,
                )}
              </pre>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-medium mb-2">Environment Information</h3>
            <div className="bg-black text-green-400 p-4 rounded-md font-mono text-xs overflow-x-auto">
              <pre>{JSON.stringify(getEnvironmentInfo(), null, 2)}</pre>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-medium mb-2">Worker Test</h3>
            <Button onClick={testCloudflareWorker} variant="outline">
              Test Cloudflare Worker
            </Button>
            <p className="text-xs mt-2 text-gray-500">
              This will send a test request to your Cloudflare Worker to check if it's working properly.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

