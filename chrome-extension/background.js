// Cruzar Ingest — background service worker
//
// Adds a right-click menu item "📥 Enviar a Cruzar" that appears when text is
// selected on facebook.com. On click, it grabs the selected text plus the
// group name (auto-detected from the FB page) and POSTs to /api/ingest/fb-post.

const DEFAULT_ENDPOINT = 'https://cruzar.app/api/ingest/fb-post'

chrome.runtime.onInstalled.addListener(() => {
  // Remove any stale items first (during dev the IDs can conflict)
  chrome.contextMenus.removeAll(() => {
    // 1. Right-click selected text → send only the selection (fastest, for one-liners)
    chrome.contextMenus.create({
      id: 'cruzar-ingest-selection',
      title: '📥 Enviar selección a Cruzar',
      contexts: ['selection'],
      documentUrlPatterns: [
        'https://*.facebook.com/*',
        'https://m.facebook.com/*',
      ],
    })
    // 2. Right-click anywhere on a post → grab the whole post + its comments
    //    via the content script. Best for Q&A threads where the reply has
    //    the wait time, not the post.
    chrome.contextMenus.create({
      id: 'cruzar-ingest-article',
      title: '📥 Enviar post + comentarios',
      contexts: ['page', 'selection', 'link'],
      documentUrlPatterns: [
        'https://*.facebook.com/*',
        'https://m.facebook.com/*',
      ],
    })
    // 3. Right-click on an image → send image (Claude vision reads the queue)
    chrome.contextMenus.create({
      id: 'cruzar-ingest-image',
      title: '📸 Enviar foto a Cruzar',
      contexts: ['image'],
      documentUrlPatterns: [
        'https://*.facebook.com/*',
        'https://m.facebook.com/*',
      ],
    })
  })
})

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id) return

  // Pull the group name out of the current page
  let groupName = 'unknown'
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const t = document.title || ''
        return t.replace(/\s*\|\s*Facebook\s*$/i, '').trim() || 'unknown'
      },
    })
    if (typeof result === 'string' && result) groupName = result
  } catch { /* groupName stays 'unknown' */ }

  const { endpoint, secret } = await chrome.storage.local.get(['endpoint', 'secret'])
  const url = endpoint || DEFAULT_ENDPOINT
  if (!secret) {
    notify('Set INGEST_SECRET in the extension popup first', 'error')
    return
  }

  if (info.menuItemId === 'cruzar-ingest-selection') {
    const selectionText = (info.selectionText || '').trim()
    if (!selectionText) { notify('No text selected', 'error'); return }
    await postToIngest(url, secret, {
      text: selectionText,
      group_name: groupName,
      posted_at: new Date().toISOString(),
    })
    return
  }

  if (info.menuItemId === 'cruzar-ingest-article') {
    // Ask the content script (already loaded on this tab) to walk up from the
    // element the user right-clicked to the enclosing post article, and return
    // its innerText — which includes post body + all visible comments.
    let articleText = ''
    try {
      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => (window.__cruzarExtractArticle ? window.__cruzarExtractArticle() : { ok: false, reason: 'content-script-missing' }),
      })
      if (result?.ok) {
        articleText = result.text || ''
      } else {
        const reason = result?.reason || 'unknown'
        notify(
          reason === 'content-script-missing'
            ? 'Content script not loaded — reload the FB tab'
            : reason === 'no-target'
              ? 'Right-click directly on the post first'
              : reason === 'no-article'
                ? 'Couldn\'t find the post container — try right-clicking on the post text'
                : 'No article text found',
          'error',
        )
        return
      }
    } catch (err) {
      notify(`Article extract failed: ${err instanceof Error ? err.message : String(err)}`, 'error')
      return
    }

    // FB articles can be huge once "See more comments" is expanded. Cap at
    // 6k chars so the LLM call stays cheap and the payload doesn't bloat.
    if (articleText.length > 6000) {
      articleText = articleText.slice(0, 6000) + '\n…'
    }

    await postToIngest(url, secret, {
      text: articleText,
      group_name: groupName,
      posted_at: new Date().toISOString(),
    })
    return
  }

  if (info.menuItemId === 'cruzar-ingest-image') {
    const imageUrl = info.srcUrl
    if (!imageUrl) { notify('No image URL', 'error'); return }

    // Also grab the selected text if any — gives the vision model context
    const selectionText = (info.selectionText || '').trim()

    try {
      const imgRes = await fetch(imageUrl, { credentials: 'include' })
      if (!imgRes.ok) { notify(`Image fetch ${imgRes.status}`, 'error'); return }
      const mediaType = imgRes.headers.get('content-type') || 'image/jpeg'
      const buf = await imgRes.arrayBuffer()
      const base64 = arrayBufferToBase64(buf)

      // ~5MB cap after base64
      if (base64.length > 5_000_000) {
        notify('Image too big', 'error')
        return
      }

      await postToIngest(url, secret, {
        text: selectionText || '(foto sin texto)',
        group_name: groupName,
        posted_at: new Date().toISOString(),
        image_base64: base64,
        image_media_type: mediaType,
      })
    } catch (err) {
      notify(`Image error: ${err instanceof Error ? err.message : String(err)}`, 'error')
    }
    return
  }
})

async function postToIngest(url, secret, payload) {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Ingest-Secret': secret },
      body: JSON.stringify(payload),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { notify(`Error ${res.status}: ${data.error || res.statusText}`, 'error'); return }
    if (data.skipped) { notify(`Saltado: ${data.skipped}`, 'info'); return }
    const n = data.inserted ?? (data.id ? 1 : 0)
    notify(`✓ ${n} reporte${n === 1 ? '' : 's'} enviado${n === 1 ? '' : 's'}`, 'success')
  } catch (err) {
    notify(`Network error: ${err instanceof Error ? err.message : String(err)}`, 'error')
  }
}

// btoa on binary string — FileReader isn't available in MV3 service workers
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}

function notify(message, type) {
  // Always log for debugging — view these in the service worker devtools
  // (chrome://extensions → Cruzar Ingest card → "service worker" link)
  console.log(`[cruzar-ingest][${type}]`, message)

  // System notification (requires "notifications" permission)
  try {
    chrome.notifications?.create?.('cruzar-ingest-' + Date.now(), {
      type: 'basic',
      iconUrl: 'icon.png',
      title: 'Cruzar Ingest',
      message: message.slice(0, 200),
    })
  } catch (e) {
    console.warn('notifications failed:', e)
  }

  // Badge fallback — always visible on the toolbar icon
  const badgeText = type === 'success' ? '✓' : type === 'error' ? '!' : '·'
  const badgeColor =
    type === 'success' ? '#10b981' :
    type === 'error'   ? '#ef4444' :
                         '#64748b'
  try {
    chrome.action.setBadgeText({ text: badgeText })
    chrome.action.setBadgeBackgroundColor({ color: badgeColor })
    // Clear the badge after 4 seconds so the toolbar stays clean
    setTimeout(() => chrome.action.setBadgeText({ text: '' }), 4000)
  } catch (e) {
    console.warn('badge failed:', e)
  }
}
