import { Logger } from "./logger"

// Default group for the battleship game
export const DEFAULT_GROUP = "battleship"

// Cloudflare Worker URL for token generation
const TOKEN_API_URL = "https://delicate-sea-8cc7.xiajohn98.workers.dev"

export class TokenService {
  /**
   * Get a token from the Cloudflare Worker
   */
  static async getToken(peerId: string, groupId: string = DEFAULT_GROUP): Promise<string> {
    Logger.log("Getting token from Cloudflare Worker")

    try {
      // Build URL with query parameters
      const url = new URL(TOKEN_API_URL)
      url.searchParams.append("peerId", peerId)
      url.searchParams.append("groupId", groupId)

      Logger.log(`Requesting token from: ${url.toString()}`)

      const response = await fetch(url.toString(), {
        method: "GET",
        mode: "cors",
      })

      Logger.log(`Worker response status: ${response.status}`)

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Could not read error response")
        throw new Error(`Worker returned status ${response.status}: ${errorText}`)
      }

      const token = await response.text()
      Logger.log("Successfully retrieved token", { tokenLength: token.length })
      return token
    } catch (error) {
      Logger.error("Failed to get token", error)
      throw error
    }
  }

  /**
   * Test the Cloudflare Worker connection
   */
  static async testWorker(): Promise<{ success: boolean; message: string }> {
    Logger.log("Testing Worker connection")
    try {
      const testUrl = `${TOKEN_API_URL}/?peerId=test-player&groupId=${DEFAULT_GROUP}`
      Logger.log(`Sending test request to: ${testUrl}`)

      const response = await fetch(testUrl, {
        method: "GET",
        mode: "cors",
      })

      Logger.log(`Test response status: ${response.status}`)

      if (!response.ok) {
        const errorText = await response.text()
        Logger.error(`Test failed: ${errorText}`)
        return {
          success: false,
          message: `Worker test failed: ${response.status} ${response.statusText}. ${errorText}`,
        }
      } else {
        const text = await response.text()
        Logger.log(`Test successful! Response length: ${text.length}`)
        return {
          success: true,
          message: `Worker test successful! Token received (${text.length} characters)`,
        }
      }
    } catch (error) {
      Logger.error("Worker test failed with exception", error)
      return {
        success: false,
        message: `Worker test exception: ${error instanceof Error ? error.message : String(error)}`,
      }
    }
  }
}

