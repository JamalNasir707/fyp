import TripHubHeader from '../components/TripHubHeader'

export default function AboutPage() {
  return (
    <div className="TripHubPage">
      <TripHubHeader activePage="about" />
      <main className="TripHubMain">
        <section className="TripHubAbout">
          <div className="TripHubAbout__content">
            <div className="TripHubAbout__header">
              <div className="TripHubAbout__icon" aria-hidden="true">TN</div>
              <div>
                <p className="TripHubAbout__eyebrow">About Us</p>
                <h2>TripNest is a smart travel planning application that helps users plan trips faster, smarter, and with more confidence.</h2>
              </div>
            </div>
            <p className="TripHubAbout__text">
              Designed for practical and personalized travel planning, the platform brings destination discovery,
              route optimization, itinerary generation, and saved trip management into one connected workspace.
              It supports better travel decisions with personalized suggestions, efficient trip organization, and a
              user-friendly experience from planning to revisiting past journeys.
            </p>
            <div className="TripHubAbout__meta">
              <span>React.js Frontend</span>
              <span>FastAPI Backend</span>
              <span>Recommendation Engine</span>
              <span>User-Centric Planning</span>
            </div>
          </div>
          <div className="TripHubAbout__highlights">
            <article className="TripHubAboutCard">
              <h3>Destination Recommendation</h3>
              <p>Suggests relevant places using user preferences, travel constraints, and hybrid recommendation logic.</p>
            </article>
            <article className="TripHubAboutCard">
              <h3>Route Optimization</h3>
              <p>Helps reduce unnecessary travel time by arranging locations into more efficient travel routes.</p>
            </article>
            <article className="TripHubAboutCard">
              <h3>Itinerary Generation</h3>
              <p>Supports structured day-wise planning so users can build and manage a clearer trip schedule.</p>
            </article>
            <article className="TripHubAboutCard">
              <h3>Travel History</h3>
              <p>Keeps saved trips available for users so previous planning data can be revisited and reused.</p>
            </article>
            <article className="TripHubAboutCard">
              <h3>User-Friendly Planning</h3>
              <p>Combines trip creation, notes, preferences, and saved plans in one simple and accessible interface.</p>
            </article>
            <article className="TripHubAboutCard">
              <h3>Hybrid Recommendation Model</h3>
              <p>Combines recommendation logic and travel context to produce more relevant and personalized trip suggestions.</p>
            </article>
            <article className="TripHubAboutCard">
              <h3>How It Helps Users</h3>
              <p>Saves time, improves route quality, provides personalized suggestions, and preserves trip progress.</p>
            </article>
          </div>
        </section>
      </main>
    </div>
  )
}
