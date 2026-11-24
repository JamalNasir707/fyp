function createFeatureIcon(kind) {
  return kind
}

export const premiumFeatures = [
  { title: 'Offline Trip Access', icon: createFeatureIcon('offline') },
  { title: 'Unlimited Attachments', icon: createFeatureIcon('attachments') },
  { title: 'AI Travel Assistant', icon: createFeatureIcon('assistant') },
  { title: 'Smart Itinerary Optimization', icon: createFeatureIcon('optimize') },
  { title: 'Export Itinerary to Google Maps', icon: createFeatureIcon('maps') },
  { title: 'Automatic Reservation & Email Scanning', icon: createFeatureIcon('scan') },
  { title: 'Dark Mode', icon: createFeatureIcon('dark') },
  { title: 'Add Places from Anywhere', icon: createFeatureIcon('places') },
  { title: 'Priority Feature Access', icon: createFeatureIcon('priority') },
  { title: 'Faster AI Itinerary Generation', icon: createFeatureIcon('speed') },
]

export const premiumCarouselSlides = [
  {
    title: 'Offline Trip Access',
    description: 'Keep your itinerary, notes, and day plans available even when your connection drops during travel.',
    icon: createFeatureIcon('offline'),
  },
  {
    title: 'Unlimited Attachments',
    description: 'Store confirmations, PDFs, and travel documents in one polished workspace without attachment limits.',
    icon: createFeatureIcon('attachments'),
  },
  {
    title: 'AI Travel Assistant',
    description: 'Unlock faster, smarter trip suggestions with an assistant tuned for premium planning workflows.',
    icon: createFeatureIcon('assistant'),
  },
  {
    title: 'Optimize Your Trip',
    description: 'Automatically refine routes, stops, and timing to build a smoother day-by-day itinerary.',
    icon: createFeatureIcon('optimize'),
  },
  {
    title: 'Export to Google Maps',
    description: 'Send your final itinerary into Google Maps-ready formats for easier navigation on the go.',
    icon: createFeatureIcon('maps'),
  },
  {
    title: 'Automatic Reservation Scanning',
    description: 'Let TripNest gather key details from confirmation emails and surface them directly in your trip plan.',
    icon: createFeatureIcon('scan'),
  },
  {
    title: 'Dark Mode',
    description: 'Switch to a low-glare travel workspace designed for late-night planning and in-transit use.',
    icon: createFeatureIcon('dark'),
  },
  {
    title: 'Priority Feature Access',
    description: 'Get early access to upcoming premium tools before they are released to the rest of the platform.',
    icon: createFeatureIcon('priority'),
  },
  {
    title: 'Add Places from Anywhere',
    description: 'Capture ideas faster by sending interesting places into TripNest from wherever you discover them.',
    icon: createFeatureIcon('places'),
  },
]

export const premiumPlan = {
  name: 'Annual Plan',
  trial: 'FREE 7-Day Trial',
  price: '$18 USD / Year',
  disclaimer: 'No payment will be processed. Premium purchases are not available in this demo version.',
}
