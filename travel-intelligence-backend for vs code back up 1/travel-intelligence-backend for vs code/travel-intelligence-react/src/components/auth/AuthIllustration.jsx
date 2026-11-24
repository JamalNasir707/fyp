function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="m9.55 16.6-4.1-4.1 1.4-1.4 2.7 2.7 7-7 1.4 1.4-8.4 8.4Z"
      />
    </svg>
  )
}

const trustItems = ['AI Powered', 'Secure', 'Personalized Trips']

export default function AuthIllustration() {
  return (
    <section className="AuthVisualPanel" aria-label="TripNest overview">
      <div className="AuthVisualPanel__copy">
        <span className="LandingEyebrow">TripNest</span>
        <h2>
          Plan Smarter.
          <br />
          Travel Better.
        </h2>
        <p>
          TripNest brings AI-guided trip planning, clear travel organization, and premium product design together in
          one seamless experience.
        </p>
      </div>

      <div className="AuthVisualPanel__trust">
        {trustItems.map((item) => (
          <div key={item} className="AuthTrustItem">
            <span className="AuthTrustItem__icon">
              <CheckIcon />
            </span>
            <span>{item}</span>
          </div>
        ))}
      </div>

      <div className="AuthVisualMockup" aria-hidden="true">
        <div className="AuthVisualMockup__window">
          <div className="AuthVisualMockup__bar">
            <span />
            <span />
            <span />
          </div>
          <div className="AuthVisualMockup__grid">
            <article className="AuthVisualCard AuthVisualCard--hero">
              <small>AI itinerary</small>
              <strong>Skardu Escape</strong>
              <p>Budget-aware planning with scenic stops, weather insight, and day-by-day structure.</p>
            </article>
            <article className="AuthVisualCard">
              <small>Budget</small>
              <strong>$980</strong>
            </article>
            <article className="AuthVisualCard">
              <small>Duration</small>
              <strong>5 Days</strong>
            </article>
            <article className="AuthVisualCard AuthVisualCard--wide">
              <small>Trip timeline</small>
              <div className="AuthVisualCard__timeline">
                <span>Day 1: Arrival + city stay</span>
                <span>Day 2: Valley exploration</span>
                <span>Day 3: Lake and viewpoints</span>
              </div>
            </article>
          </div>
        </div>

        <div className="AuthVisualFloat AuthVisualFloat--top">
          <small>Cloud Sync</small>
          <strong>Ready on every session</strong>
        </div>

        <div className="AuthVisualFloat AuthVisualFloat--bottom">
          <small>Recommendation</small>
          <strong>Best season: May to September</strong>
        </div>
      </div>
    </section>
  )
}
