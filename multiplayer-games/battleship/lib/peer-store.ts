"use client"
import { createPeer, type ISession, type Peer } from "@pulsebeam/peer"
import { create } from "zustand"
import { produce } from "immer"

const isBrowser = typeof window !== "undefined" && typeof navigator !== "undefined"

const DEFAULT_GROUP = "battleship" // This should match the group ID used for token generation
const DEFAULT_CONNECT_TIMEOUT_MS = 100_000
const DATA_CHANNEL_NAME = "game-data"

// Simple debug logger if not provided from outside
class SimpleLogger {
  static log(message: string, data?: any): void {
    if (data) {
      console.log(`[PeerStore] ${message}`, data)
    } else {
      console.log(`[PeerStore] ${message}`)
    }
  }

  static error(message: string, error?: any): void {
    if (error) {
      console.error(`[PeerStore] ERROR: ${message}`, error)
    } else {
      console.error(`[PeerStore] ERROR: ${message}`)
    }
  }
}

// Global logger that can be set from outside
let Logger = SimpleLogger

export function setPeerStoreLogger(logger: any) {
  Logger = logger
  Logger.log("PeerStore logger set")
}

interface SessionProps {
  key: number
  sess: ISession
  loading: boolean
  gameState: GameState | null
  dataChannel: RTCDataChannel | null
}

export interface Position {
  x: number
  y: number
}

export interface CannonShot {
  id: string
  position: Position
  timestamp: number
}

export interface GameState {
  gameId: string
  currentTurn: string
  battleshipPosition: Position
  cannonShots: CannonShot[]
  gameOver: boolean
  winner: string | null
  boardSize: number
  lastAction?: {
    type: string
    player: string
    position?: Position
  }
}

export interface PeerState {
  ref: Peer | null
  loading: boolean
  sessions: Record<string, SessionProps>
  start: (peerId: string, token: string) => Promise<void>
  stop: () => void
  connect: (otherPeerId: string, groupId: string) => Promise<void>
  peerId: string
  sendGameState: (gameState: GameState, sessionId: string) => void
  createGame: () => GameState
  moveBattleship: (gameId: string, sessionId: string, position: Position) => void
  fireCannon: (gameId: string, sessionId: string, position: Position) => void
  debugInfo: () => any
}

export const usePeerStore = create<PeerState>((set, get) => ({
  ref: null,
  sessions: {},
  loading: false,
  peerId: "",

  start: async (peerId, token) => {
    if (!isBrowser) {
      console.warn("Attempted to start peer in a non-browser environment")
      return
    }

    if (!token) {
      Logger.error("No token provided")
      throw new Error("No token provided")
    }

    if (get().ref) {
      Logger.log("Peer already started")
      return
    }

    if (get().loading) {
      Logger.log("Peer loading in progress")
      return
    }

    Logger.log(`Starting peer with ID: ${peerId}`)
    Logger.log(`Token provided (length: ${token.length})`)

    // Log token prefix for debugging (don't log the full token for security)
    if (token.length > 10) {
      Logger.log(`Token prefix: ${token.substring(0, 10)}...`)
    }

    set({ loading: true })

    try {
      Logger.log("Creating peer with token")

      // Wrap the createPeer call in a try/catch to get detailed error
      let p
      try {
        p = await createPeer({
          token,
          debug: true, // Enable debug mode for more verbose logging
        })
        Logger.log("createPeer call succeeded")
      } catch (createError) {
        Logger.error("Error in createPeer call", createError)
        throw createError
      }

      Logger.log("Peer created successfully", {
        peerState: p.state,
        hasOnsession: !!p.onsession,
        hasOnstatechange: !!p.onstatechange,
      })

      // Set up event handlers
      p.onsession = (s) => {
        Logger.log("New session established", {
          otherPeerId: s.other.peerId,
          otherConnId: s.other.connId,
          connectionState: s.connectionState,
        })

        // Log all properties and methods on the session object
        Logger.log("Session object properties:", Object.getOwnPropertyNames(s))
        Logger.log("Session object prototype properties:", Object.getOwnPropertyNames(Object.getPrototypeOf(s)))

        const id = `${s.other.peerId}:${s.other.connId}`

        // Create a data channel or prepare to receive one
        let dataChannel: RTCDataChannel | null = null

        // If we're the initiator, create the data channel
        if (s.connectionState === "new") {
          try {
            Logger.log("Creating data channel as initiator")
            dataChannel = s.createDataChannel(DATA_CHANNEL_NAME, {
              ordered: true,
            })
            setupDataChannel(dataChannel, id)
          } catch (error) {
            Logger.error("Error creating data channel", error)
          }
        }

        // Set up handler for data channel created by the other peer
        s.ondatachannel = (event) => {
          Logger.log("Received data channel from peer", {
            label: event.channel.label,
            readyState: event.channel.readyState,
          })

          dataChannel = event.channel
          setupDataChannel(dataChannel, id)

          // Update the session with the data channel
          set(
            produce((state: PeerState) => {
              if (state.sessions[id]) {
                state.sessions[id].dataChannel = dataChannel
              }
            }),
          )
        }

        // Set up connection state change handler
        s.onconnectionstatechange = () => {
          Logger.log(`Connection state changed for ${s.other.peerId}: ${s.connectionState}`)

          if (s.connectionState === "closed") {
            Logger.log(`Session closed for ${s.other.peerId}`)
            set((state) => {
              const { [id]: _, ...rest } = state.sessions
              return { sessions: rest }
            })
          } else {
            const loading = s.connectionState !== "connected"
            set(
              produce((state: PeerState) => {
                if (state.sessions[id]) {
                  state.sessions[id].loading = loading
                  state.sessions[id].key = performance.now()
                  Logger.log(`Session ${id} loading state updated: ${loading}`)
                } else {
                  Logger.error(`Session ${id} not found when updating loading state`)
                }
              }),
            )
          }
        }

        // Set up error handler for the session
        s.onerror = (error) => {
          Logger.error(`Session error for ${s.other.peerId}`, error)
        }

        // Store the session
        set(
          produce((state: PeerState) => {
            state.sessions[id] = {
              key: performance.now(),
              sess: s,
              loading: true,
              gameState: null,
              dataChannel,
            }
            Logger.log(`Session ${id} added to store`)
          }),
        )
      }

      p.onstatechange = () => {
        Logger.log(`Peer state changed: ${p.state}`)
        if (p.state === "closed") {
          Logger.log("Peer closed, stopping")
          get().stop()
        }
      }

      p.onerror = (error) => {
        Logger.error("Peer error", error)
        set({ loading: false })
      }

      // Store the peer reference
      set({ ref: p })

      // Start the peer
      Logger.log("Starting peer")
      try {
        await p.start()
        Logger.log("Peer started successfully")
      } catch (startError) {
        Logger.error("Error in peer.start()", startError)
        throw startError
      }
    } catch (error) {
      Logger.error("Error starting peer", error)
      // Reset the loading state on error
      set({ loading: false })
      // Re-throw the error to be handled by the UI
      throw error
    }

    // Update state with peer ID and reset loading
    set({ loading: false, peerId })
    Logger.log(`Peer ${peerId} started and ready`)
  },

  stop: () => {
    Logger.log("Stopping peer")
    try {
      // Close all data channels first
      Object.values(get().sessions).forEach((session) => {
        if (session.dataChannel) {
          try {
            session.dataChannel.close()
          } catch (error) {
            Logger.error("Error closing data channel", error)
          }
        }
      })

      // Then close the peer
      get().ref?.close()
      Logger.log("Peer closed successfully")
    } catch (error) {
      Logger.error("Error closing peer", error)
    }
    set({ ref: null, peerId: "", sessions: {} })
    Logger.log("Peer state reset")
  },

  connect: async (otherPeerId, groupId) => {
    Logger.log(`Connecting to peer ${otherPeerId} in group ${groupId}`)

    if (!get().ref) {
      const error = new Error("Cannot connect: Peer not initialized")
      Logger.error(error.message)
      throw error
    }

    set({ loading: true })
    const abort = new AbortController()
    if (isBrowser) {
      const timeoutId = window.setTimeout(() => {
        Logger.log("Connection timeout, aborting")
        abort.abort()
      }, DEFAULT_CONNECT_TIMEOUT_MS)

      try {
        Logger.log(`Calling connect with groupId: ${groupId}, otherPeerId: ${otherPeerId}`)

        // Validate the peer ID format if needed
        if (!otherPeerId || otherPeerId.trim() === "") {
          throw new Error("Invalid peer ID")
        }

        // This is the key change - use the same group ID that was used for token generation
        await get().ref?.connect(DEFAULT_GROUP, otherPeerId, abort.signal)
        Logger.log("Connection successful")
      } catch (error) {
        Logger.error("Connection error", error)
        throw error
      } finally {
        window.clearTimeout(timeoutId)
        set({ loading: false })
      }
    }
  },

  sendGameState: (gameState, sessionId) => {
    const session = get().sessions[sessionId]
    if (!session) {
      Logger.error(`Cannot send game state: Session ${sessionId} not found`)
      return
    }

    if (!session.dataChannel) {
      Logger.error(`Cannot send game state: No data channel available for session ${sessionId}`)
      return
    }

    try {
      const gameStateJson = JSON.stringify(gameState)

      // Check if the data channel is ready
      if (session.dataChannel.readyState === "open") {
        session.dataChannel.send(gameStateJson)
        Logger.log(`Game state sent via data channel to ${sessionId}`)

        // Update the local game state
        set(
          produce((state: PeerState) => {
            state.sessions[sessionId].gameState = gameState
          }),
        )
      } else {
        Logger.error(`Cannot send: Data channel not open (state: ${session.dataChannel.readyState})`)
        throw new Error(`Data channel not open (state: ${session.dataChannel.readyState})`)
      }
    } catch (error) {
      Logger.error("Error sending game state", error)
      throw error
    }
  },

  createGame: () => {
    Logger.log("Creating new battleship game")

    // Create initial game state
    const gameId = `game-${Date.now()}`
    const boardSize = 10 // 10x10 grid

    const gameState: GameState = {
      gameId,
      currentTurn: get().peerId,
      battleshipPosition: { x: 5, y: 5 }, // Start in the middle
      cannonShots: [],
      gameOver: false,
      winner: null,
      boardSize,
    }

    Logger.log(`Game created with ID: ${gameId}`, {
      boardSize,
      currentTurn: get().peerId,
    })

    return gameState
  },

  moveBattleship: (gameId: string, sessionId: string, position: Position) => {
    const session = get().sessions[sessionId]
    if (!session || !session.gameState || session.gameState.gameId !== gameId) {
      Logger.error("Cannot move battleship: Invalid session or game ID")
      return
    }

    Logger.log(`Moving battleship in game ${gameId} to position (${position.x}, ${position.y})`)

    const gameState = structuredClone(session.gameState)

    // Check if the game is already over
    if (gameState.gameOver) {
      Logger.error("Cannot move battleship: Game is over")
      return
    }

    // Validate position is within board boundaries
    if (position.x < 0 || position.x >= gameState.boardSize || position.y < 0 || position.y >= gameState.boardSize) {
      Logger.error("Cannot move battleship: Position out of bounds")
      return
    }

    // Update battleship position
    gameState.battleshipPosition = position

    // Add last action
    gameState.lastAction = {
      type: "move",
      player: get().peerId,
      position,
    }

    // Send updated game state
    get().sendGameState(gameState, sessionId)
  },

  fireCannon: (gameId: string, sessionId: string, position: Position) => {
    const session = get().sessions[sessionId]
    if (!session || !session.gameState || session.gameState.gameId !== gameId) {
      Logger.error("Cannot fire cannon: Invalid session or game ID")
      return
    }

    Logger.log(`Firing cannon in game ${gameId} at position (${position.x}, ${position.y})`)

    const gameState = structuredClone(session.gameState)

    // Check if the game is already over
    if (gameState.gameOver) {
      Logger.error("Cannot fire cannon: Game is over")
      return
    }

    // Create a new cannon shot
    const newShot: CannonShot = {
      id: `shot-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      position,
      timestamp: Date.now(),
    }

    // Add the shot to the game state
    gameState.cannonShots.push(newShot)

    // Check if the shot hit the battleship
    // We'll consider a hit if the distance between the shot and battleship is less than 0.5 units
    const distance = Math.sqrt(
      Math.pow(position.x - gameState.battleshipPosition.x, 2) +
        Math.pow(position.y - gameState.battleshipPosition.y, 2),
    )

    const hitThreshold = 0.5 // Half the size of the battleship
    const isHit = distance <= hitThreshold

    if (isHit) {
      gameState.gameOver = true
      gameState.winner = get().peerId
      Logger.log(`Game over! Player ${get().peerId} won by hitting the battleship!`)
    }

    // Add last action
    gameState.lastAction = {
      type: "fire",
      player: get().peerId,
      position,
    }

    // Send updated game state
    get().sendGameState(gameState, sessionId)
  },

  // Debug function to get internal state
  debugInfo: () => {
    const state = get()
    return {
      peerId: state.peerId,
      loading: state.loading,
      hasRef: !!state.ref,
      peerState: state.ref?.state,
      sessionCount: Object.keys(state.sessions).length,
      sessions: Object.entries(state.sessions).map(([id, session]) => ({
        id,
        loading: session.loading,
        hasGameState: !!session.gameState,
        otherPeerId: session.sess.other.peerId,
        connectionState: session.sess.connectionState,
        hasDataChannel: !!session.dataChannel,
        dataChannelState: session.dataChannel ? session.dataChannel.readyState : "none",
      })),
    }
  },
}))

// Helper function to set up a data channel
function setupDataChannel(channel: RTCDataChannel, sessionId: string) {
  Logger.log(`Setting up data channel for session ${sessionId}`, {
    label: channel.label,
    readyState: channel.readyState,
  })

  channel.onopen = () => {
    Logger.log(`Data channel opened for session ${sessionId}`)
  }

  channel.onclose = () => {
    Logger.log(`Data channel closed for session ${sessionId}`)
  }

  channel.onerror = (error) => {
    Logger.error(`Data channel error for session ${sessionId}`, error)
  }

  channel.onmessage = (event) => {
    try {
      Logger.log(`Received message on data channel for session ${sessionId}`, {
        dataType: typeof event.data,
        dataLength: event.data.length,
      })

      const receivedGameState = JSON.parse(event.data)

      // Update the game state in the store
      usePeerStore.setState(
        produce((state: PeerState) => {
          if (state.sessions[sessionId]) {
            state.sessions[sessionId].gameState = receivedGameState
            state.sessions[sessionId].key = performance.now()
            Logger.log("Game state updated from data channel", {
              sessionId,
              gameId: receivedGameState.gameId,
            })
          } else {
            Logger.error(`Session ${sessionId} not found when updating game state from data channel`)
          }
        }),
      )
    } catch (error) {
      Logger.error(`Error parsing game state from data channel for session ${sessionId}`, error)
    }
  }
}

