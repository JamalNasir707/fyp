import { useRef, useState } from 'react'
import PremiumModal from './PremiumModal'
import { premiumCarouselSlides, premiumFeatures, premiumPlan } from '../lib/premiumFeatures'

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="m5.5 10.25 2.75 2.75 6.25-6.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function ProMembershipPage() {
  const [modalOpen, setModalOpen] = useState(false)
  const featuresRef = useRef(null)

  return (
    <>
      <div className="TripHubPremiumPage">
        <div className="TripHubPremiumPage__hero">
          <div className="TripHubPremiumPage__heroCopy">
            <h3 className="TripHubPremiumPage__sectionTitle">Pro Membership</h3>
            <p className="TripHubPremiumPage__eyebrow">TripNest Premium</p>
            <h2>Unlock a more powerful way to plan every journey.</h2>
            <p className="TripHubPremiumPage__description">
              Unlock the full power of TripNest with AI-powered travel planning, offline access, premium productivity tools,
              and advanced itinerary features.
            </p>

            <div className="TripHubPremiumPage__planRow">
              <span className="TripHubPremiumPage__planBadge">{premiumPlan.trial}</span>
              <span className="TripHubPremiumPage__planPrice">{premiumPlan.price}</span>
            </div>
          </div>
        </div>

        <div className="TripHubPremiumPage__featureBlock" ref={featuresRef}>
          <div className="TripHubPremiumPage__featureHeader">
            <h4>Everything in Free, plus</h4>
            <p>Premium tools designed for smoother planning before and during your trip.</p>
          </div>

          <div className="TripHubPremiumPage__features">
            {premiumFeatures.map((feature) => (
              <div key={feature.title} className="TripHubPremiumPage__featureRow">
                <span className="TripHubPremiumPage__check" aria-hidden="true"><CheckIcon /></span>
                <span>{feature.title}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="TripHubPremiumPage__actions">
          <button type="button" className="TripHubPremiumPage__primary" onClick={() => setModalOpen(true)}>Start Free Trial</button>
          <button
            type="button"
            className="TripHubPremiumPage__secondary"
            onClick={() => featuresRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          >
            Learn More
          </button>
        </div>
      </div>

      <PremiumModal open={modalOpen} slides={premiumCarouselSlides} plan={premiumPlan} onClose={() => setModalOpen(false)} />
    </>
  )
}
