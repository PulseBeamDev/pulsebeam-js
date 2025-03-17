// Polyfill for URL.canParse which is only available in Node.js v20.6.0+
if (typeof URL !== "undefined" && !("canParse" in URL)) {
  // @ts-ignore - Add the canParse method to the URL constructor
  URL.canParse = (url: string): boolean => {
    try {
      new URL(url)
      return true
    } catch (error) {
      return false
    }
  }

  console.log("URL.canParse polyfill applied")
}

