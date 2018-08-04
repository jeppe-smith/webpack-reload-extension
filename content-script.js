// Sometimes content scripts are run more than once and when we try adding
// listeners at the top of the script that is run at document_start the function
// might not be available yet.
if (typeof chrome.runtime.onMessage.addListener === 'function') {
  // Listen on messages from the background-script.
  chrome.runtime.onMessage.addListener(action => {
    const { type } = action
  
    // Reload the page when told so.
    if (type === 'RELOAD') {
      window.location.reload()
    }
  })
}