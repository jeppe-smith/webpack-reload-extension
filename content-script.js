// Listen on messages from the background-script.
chrome.runtime.onMessage.addListener(action => {
  const { type } = action

  // Reload the page when told so.
  if (type === 'RELOAD') {
    window.location.reload()
  }
})