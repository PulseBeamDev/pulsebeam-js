// Logger service for the application
export class Logger {
  private static logs: string[] = []
  private static maxLogs = 100
  private static listeners: Array<() => void> = []

  static log(message: string, data?: any): void {
    const timestamp = new Date().toISOString()
    const logMessage = `[${timestamp}] ${message}`

    // Log to console
    if (data) {
      console.log(logMessage, data)
    } else {
      console.log(logMessage)
    }

    // Store log
    this.logs.unshift(data ? `${logMessage} ${JSON.stringify(data, null, 2)}` : logMessage)

    // Trim logs if they exceed max length
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(0, this.maxLogs)
    }

    // Notify listeners
    this.notifyListeners()
  }

  static error(message: string, error?: any): void {
    const timestamp = new Date().toISOString()
    const errorMessage = `[${timestamp}] ERROR: ${message}`

    // Log to console
    if (error) {
      console.error(errorMessage, error)
    } else {
      console.error(errorMessage)
    }

    // Store log
    this.logs.unshift(
      error
        ? `${errorMessage} ${error instanceof Error ? error.stack || error.message : JSON.stringify(error, null, 2)}`
        : errorMessage,
    )

    // Trim logs if they exceed max length
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(0, this.maxLogs)
    }

    // Notify listeners
    this.notifyListeners()
  }

  static getLogs(): string[] {
    return this.logs
  }

  static clear(): void {
    this.logs = []
    this.notifyListeners()
  }

  static addListener(listener: () => void): () => void {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener)
    }
  }

  private static notifyListeners(): void {
    this.listeners.forEach((listener) => listener())
  }
}

