// Apply polyfill before importing Next.js
if (typeof URL !== "undefined" && !("canParse" in URL)) {
  URL.canParse = (url) => {
    try {
      new URL(url)
      return true
    } catch (error) {
      return false
    }
  }
  console.log("URL.canParse polyfill applied in custom server")
}

const { createServer } = require("http")
const { parse } = require("url")
const next = require("next")

const dev = process.env.NODE_ENV !== "production"
const app = next({ dev })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  createServer((req, res) => {
    const parsedUrl = parse(req.url, true)
    handle(req, res, parsedUrl)
  }).listen(3000, (err) => {
    if (err) throw err
    console.log("> Ready on http://localhost:3000")
  })
})

