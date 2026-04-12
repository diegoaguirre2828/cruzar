// Cruzar Ingest — content script on facebook.com
//
// Tracks the element the user most recently right-clicked. We can't read
// "the right-clicked element" directly from the chrome.contextMenus API, so
// we record it here and let the background worker walk up from it to the
// nearest post article (with its comments).

(function () {
  let lastTarget = null

  window.addEventListener(
    'contextmenu',
    (e) => {
      lastTarget = e.target
    },
    true, // capture phase so we see it before any page handler stops propagation
  )

  // Expose a function that the background can call via chrome.scripting.executeScript.
  // It walks up from the last right-clicked element to the nearest [role="article"]
  // and returns its innerText — which on Facebook includes the post body plus all
  // visible comments (you still need to click "Ver más comentarios" in FB to load them).
  window.__cruzarExtractArticle = function () {
    const target = lastTarget
    if (!target) return { ok: false, reason: 'no-target', text: '' }

    // Walk up to the enclosing post container. FB wraps each feed item in an
    // element with role="article". This works on both www and m subdomains.
    const article =
      target.closest?.('[role="article"]') ||
      target.closest?.('[data-pagelet*="FeedUnit"]') ||
      target.closest?.('div[data-pagelet]')

    if (!article) return { ok: false, reason: 'no-article', text: '' }

    // innerText gives us the visually-rendered text content, which handles
    // FB's span soup + newlines between post and each comment.
    const text = (article.innerText || '').trim()
    if (!text) return { ok: false, reason: 'empty', text: '' }

    return {
      ok: true,
      reason: 'ok',
      text,
      length: text.length,
    }
  }
})()
