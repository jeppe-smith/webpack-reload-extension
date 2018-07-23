const fs = require('fs')
const path = require('path')
const WebSocket = require('ws')
const chalk = require('chalk')
const ConcatSource = require('webpack-core/lib/ConcatSource')
const name = 'Extension Reloader'
const slug = 'extension-reloader'

class ExtensionReloader {
  constructor(options) {
    // Apply user options to defualt options.
    this._options = {
      contentScript: 'content',
      backgroundScript: 'background',
      reloadPage: true,
      ...options
    }

    // Set when we connect to an extension.
    this._extensionName = null

    // Because of the max reload limit on chrome extensions we need to 
    // keep track of the number of reloads to avoid disabling the extension.
    this._reloads = 0

    // Again because of the max reload limit we store the time of the last reload.
    this._lastReload = null

    // Set to true when we're waiting before reloading the extension so it 
    // doesn't get disabled.
    this._isWaiting = false

    // Set to true the first time we establish a connection with an extension.
    this._isConnected = false

    // Get the contents of our reload scripts.
    this._backgroundScript = fs.readFileSync( path.resolve(__dirname, 'background-script.js'), 'utf8' )
    this._contentScript = fs.readFileSync( path.resolve(__dirname, 'content-script.js'), 'utf8' )

    // The Webpack compiler.
    this._compiler = null

    // Our WebSocket server.
    this._server = null

    // Our WebSocket server connection.
    this._ws = null
  }
  
  apply(compiler) {
    // We only do our thing in development mode.
    if (compiler.options.optimization.nodeEnv === 'development') {
      this._compiler = compiler
      
      // Insert the reload scripts in the content and background scripts.
      this._insertScriptsOnOptimizeChunkAssets()      
      
      // Start up the WebSocket server.
      this._startWebSocketServer()
    }

  }

  /**
   * Starts a WebSocket server and on connection.
   */
  _startWebSocketServer() {
    if (!this._server) {
      this._server = new WebSocket.Server({ port: 1337 })

      this._server.on('connection', ws => {
        this._ws = ws
        
        // Set up handlers and watchers the first time a connection is made.
        // We only do it the one time because the WebSocket connection is updated on the instance
        // every time a new one is made and that way we don't set up new listeners each time.
        if (!this._isConnected) {
          this._handleWebSocketMessages()
          this._watchDone()
        }
      })
    }
  }

  /**
   * Attaches handlers to messages received on the WebSocket connection.
   */
  _handleWebSocketMessages() {
    this._ws.on('message', data => {
      const { type, payload } = JSON.parse(data)

      switch (type) {
        case 'RELOADED':
          if (this._isConnected) {
            this._onReloaded()
          } else {
            this._onConnected(payload)
          }
          break
      }
    })
  }

  /**
   * Updates the number of reloads and time of last reload.
   */
  _onReloaded() {
    this._lastReload = new Date().getTime()

    this._reloads = this._reloads + 1

    this._log(`${this._extensionName} was reloaded`)
  }

  /**
   * Sets the extension name.
   * 
   * @param {string} extensionName 
   */
  _onConnected(extensionName) {
    this._isConnected = true

    this._extensionName = extensionName

    this._log(`${extensionName} will reload on change`)
  }

  /**
   * Inserts the scripts needed in the content and background scripts.
   */
  _insertScriptsOnOptimizeChunkAssets() {
    this._compiler.hooks.compilation.tap(slug, compilation => {
      compilation.hooks.optimizeChunkAssets.tap(slug, chunks => {
        chunks.forEach(chunk => {
          const { name, files } = chunk

          // We only need it inserted in one file.
          const file = files[0]

          if (name === this._options.contentScript) {
            compilation.assets[file] = new ConcatSource(
              compilation.assets[file],
              '\n',
              this._contentScript
            )
          }

          if (name === this._options.backgroundScript) {
            compilation.assets[file] = new ConcatSource(
              compilation.assets[file],
              '\n',
              this._backgroundScript
            )
          }
        })
      })
    })
  }

  /**
   * Hooks in to the done hook on the compiler to trigger a reload.
   */
  _watchDone() {
    this._compiler.hooks.done.tap(slug, compiler => {
      this._reload()
    })
  }

  /**
   * Reloads the extension and the content script if reloadPage is true.
   */
  _reload() {
    // Do nothing if we're waiting as to not cause too many reloads.
    if (this._isWaiting) {
      return false
    }

    // If no WebSocket connection is established then no extension is connected.
    if (this._ws === null) {
      return this._log(`No extension connected.`, 'red')
    }

    // If the WebSocket connection readyState is not 1 then the extension was probably
    // disabled because of too many reloads,
    if (this._ws.readyState !== 1) {
      return this._log(`Connection with ${this._extensionName} was lost and it might need a reload.`, 'red')
    }

    // If the last reload was more than 10 seconds ago we don't need to be scared
    // of too many reloads so we can reset the reloads counter.
    if (new Date().getTime() - this._lastReload > 10000) {
      this._reloads = 0
    }

    // The action we want to send to the extension.
    const action = this._options.reloadPage ? 'RELOAD_ALL' : 'RELOAD_EXTENSION'

    /**
     * If we have less than five reloads it's safe to reload the extension
     * otherwise we need to wait so it doesn't get disabled because of too many reloads.
     */
    if (this._reloads < 5) {
      this._ws.send(action)
    } else {
      this._delayReload()
    }
  }

  /**
   * Puts a delay on reloading the extension. Chrome only allows a certain number (about six)
   * in a certain timeframe. This attempts to make sure the extension isn't disabled for too 
   * many reloads by waiting a number of seconds before reloading again.
   */
  _delayReload() {
    if (!this._isWaiting) {
      // The amount of seconds to wait.
      let seconds = 10
      
      this._isWaiting = true

      this._log(`${this._extensionName} will reload in ${seconds} seconds to prevent it being disabled.`, 'yellow')

      // Start the countdown and call reload when it hits zero.
      const countdown = setInterval(() => {
        if (seconds > 0) {
          seconds = seconds - 1

          this._log(`Reloading in ${seconds}`, 'yellow')
        } else {
          clearInterval(countdown)

          this._isWaiting = false
          this._reloads = 0

          this._reload()
        }
      }, 1000)
    }
  }

  /**
   * Logs stuff.
   * @param {string} string 
   * @param {string} color 
   */
  _log(string, color = 'white') {
    console.log( chalk`{green.bold ${name}} {${color} ${string}}` )
  }
}

module.exports = ExtensionReloader