const { name } = chrome.runtime.getManifest()

// Create the connection.
const socket = new WebSocket('ws://localhost:1337')

// Let the webpack plugin know that we're connected.
// We do this with a message instead of listening on connection
// because we only want it to know with this connection.
socket.onopen = event => {
  console.log(name + ' will auto reload')
  
  socket.send(
    JSON.stringify(
      { 
        type: 'RELOADED',
        payload: name 
      }
    )
  )
}

// When the plugin stops so does the server, but we need 
// to know when it starts back up. So we listen for a new
// connection with an interval and then reload the runtime.
socket.onclose = event => {
  const reconnecter = setInterval(() => {
    try {
      const socket = new WebSocket('ws://localhost:1337')
      
      socket.onopen = event => {
        clearInterval(reconnecter)
        reloadAll()
      }
    } catch (error) {}
  }, 2000)
}

// Listen on messages.
socket.onmessage = event => {
  const { data } = event

  switch (data) {
    case 'RELOAD_EXTENSION':
      reloadExtension()
      break
    case 'RELOAD_ALL':
      reloadAll()
      break
  }
}

/**
 * Reloads the extension.
 */
function reloadExtension() {
  chrome.runtime.reload()
}

/**
 * Reloads all tabs with the extension running.
 */
function reloadAll() {
  chrome.tabs.query({}, tabs => {
    tabs.forEach(tab => chrome.tabs.sendMessage(tab.id, { type: 'RELOAD' }))
    reloadExtension()
  })
}