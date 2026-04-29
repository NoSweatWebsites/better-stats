const KNOWN_DOMAINS: Record<string, string> = {
  'g2': 'g2.com',
  'capterra': 'capterra.com',
  'gartner': 'gartner.com',
  'trustpilot': 'trustpilot.com',
  'techcrunch': 'techcrunch.com',
  'forbes': 'forbes.com',
  'pcmag': 'pcmag.com',
  'techradar': 'techradar.com',
  'getapp': 'getapp.com',
  'softwareadvice': 'softwareadvice.com',
  'producthunt': 'producthunt.com',
  'reddit': 'reddit.com',
  'trustradius': 'trustradius.com',
  'business news daily': 'businessnewsdaily.com',
  'nerdwallet': 'nerdwallet.com',
  'investopedia': 'investopedia.com',
  'entrepreneur': 'entrepreneur.com',
  'zdnet': 'zdnet.com',
  'cnet': 'cnet.com',
}

export function detectMentions(text: string, brands: { id: string; name: string }[]) {
  return brands
    .map((brand) => {
      const regex = new RegExp(brand.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
      const count = (text.match(regex) ?? []).length
      return { brandId: brand.id, count }
    })
    .filter((m) => m.count > 0)
}

export function inferCitations(text: string): string[] {
  const lower = text.toLowerCase()
  return Object.entries(KNOWN_DOMAINS)
    .filter(([keyword]) => lower.includes(keyword))
    .map(([, domain]) => domain)
}
