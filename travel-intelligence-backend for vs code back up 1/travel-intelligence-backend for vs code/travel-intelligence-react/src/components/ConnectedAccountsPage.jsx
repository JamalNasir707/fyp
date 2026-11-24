import { useState } from 'react'
import PremiumModal from './PremiumModal'
import { premiumCarouselSlides, premiumPlan } from '../lib/premiumFeatures'

export default function ConnectedAccountsPage() {
  const [modalOpen, setModalOpen] = useState(false)

  return (
    <>
      <div className="TripHubConnectedAccounts">
        <div className="TripHubConnectedAccounts__copy">
          <h2>Automatically import your travel reservations</h2>
          <p>
            Connect your Gmail account so TripNest can securely detect travel confirmation emails and automatically
            create or update your trips.
          </p>
          <p className="TripHubConnectedAccounts__note">
            TripNest only scans travel-related reservation emails such as flights, hotels, trains, buses, and car
            rentals. No unrelated personal emails are stored.
          </p>
        </div>

        <div className="TripHubConnectedAccounts__actionRow">
          <button
            type="button"
            className="TripHubConnectedAccounts__button"
            onClick={() => setModalOpen(true)}
          >
            <span aria-hidden="true">📧</span>
            <span>Connect Gmail Account</span>
          </button>
          <span className="TripHubConnectedAccounts__badge">PRO</span>
        </div>

        <p className="TripHubConnectedAccounts__disclaimer">
          By connecting your Gmail account, you allow TripNest to securely identify travel confirmation emails and
          automatically organize your itinerary. TripNest never stores unrelated personal emails.
        </p>
      </div>

      <PremiumModal open={modalOpen} slides={premiumCarouselSlides} plan={premiumPlan} onClose={() => setModalOpen(false)} />
    </>
  )
}
