import { useEffect, useState } from 'react'
import PremiumFeatureCarousel from './PremiumFeatureCarousel'
import PricingCard from './PricingCard'

export default function PremiumModal({ open, slides, plan, onClose }) {
  const [activeSlide, setActiveSlide] = useState(0)

  useEffect(() => {
    if (!open) return undefined

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    setActiveSlide(0)
  }, [open])

  if (!open) return null

  return (
    <div className="TripHubPremiumModal" aria-hidden="false">
      <div className="TripHubPremiumModal__backdrop" onClick={onClose} />
      <div className="TripHubPremiumModal__dialog" role="dialog" aria-modal="true" aria-labelledby="tripnest-premium-title">
        <button type="button" className="TripHubPremiumModal__close" aria-label="Close premium modal" onClick={onClose}>×</button>
        <h2 id="tripnest-premium-title">TripNest Premium</h2>

        <PremiumFeatureCarousel slides={slides} activeIndex={activeSlide} onChange={setActiveSlide} />

        <PricingCard plan={plan} onContinue={onClose} />
      </div>
    </div>
  )
}
