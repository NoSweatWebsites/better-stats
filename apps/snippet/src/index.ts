const INGEST_URL = 'https://ingest.betterstats.io/e'

interface BetterStats {
  siteId: string
  track: (event: string, props?: Record<string, unknown>) => void
  page: () => void
}

function init(): BetterStats {
  const siteId = (window as any).bs?.siteId
  if (!siteId) {
    console.warn('[betterstats] no siteId configured')
  }

  const send = (event: string, props: Record<string, unknown> = {}) => {
    const payload = {
      site_id: siteId,
      event,
      props,
      url: window.location.href,
      referrer: document.referrer,
      ua: navigator.userAgent,
      ts: Date.now(),
    }
    if (navigator.sendBeacon) {
      navigator.sendBeacon(INGEST_URL, JSON.stringify(payload))
    } else {
      fetch(INGEST_URL, { method: 'POST', body: JSON.stringify(payload), keepalive: true })
    }
  }

  send('pageview')

  let lastUrl = window.location.href
  new MutationObserver(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href
      send('pageview')
    }
  }).observe(document, { subtree: true, childList: true })

  return {
    siteId,
    track: send,
    page: () => send('pageview'),
  }
}

;(window as any).bs = { ...(window as any).bs, ...init() }
