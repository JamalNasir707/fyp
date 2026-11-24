import { useState } from 'react'
import { Link } from 'react-router-dom'
import GoogleButton from './GoogleButton'
import {
  faqs,
  featureCards,
  howItWorksSteps,
  popularDestinations,
  showcaseCards,
  testimonials,
  trustStats,
  whyChooseReasons,
} from '../../lib/landingContent'

function IconSymbol({ name }) {
  const icons = {
    sparkles: (
      <path d="M12 3l1.75 4.25L18 9l-4.25 1.75L12 15l-1.75-4.25L6 9l4.25-1.75L12 3Zm6.5 10 1 2.5L22 16l-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1 1-2.5ZM6 14l1.25 3.25L10.5 18l-3.25 1.25L6 22l-1.25-2.75L1.5 18l3.25-.75L6 14Z" />
    ),
    heart: (
      <path d="M12 20.25 4.875 13.5A4.875 4.875 0 1 1 11.76 6.6L12 6.84l.24-.24A4.875 4.875 0 1 1 19.125 13.5L12 20.25Z" />
    ),
    globe: (
      <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm6.92 9h-3.1a15.91 15.91 0 0 0-1.34-5A8.03 8.03 0 0 1 18.92 11ZM12 4.08c1.02 1.2 1.88 3.2 2.22 5.92H9.78C10.12 7.28 10.98 5.28 12 4.08ZM9.52 6A15.91 15.91 0 0 0 8.18 11h-3.1A8.03 8.03 0 0 1 9.52 6ZM5.08 13h3.1a15.9 15.9 0 0 0 1.34 5 8.03 8.03 0 0 1-4.44-5Zm6.92 6.92c-1.02-1.2-1.88-3.2-2.22-5.92h4.44c-.34 2.72-1.2 4.72-2.22 5.92ZM14.48 18c.62-1.34 1.08-3.08 1.34-5h3.1a8.03 8.03 0 0 1-4.44 5Z" />
    ),
    shield: (
      <path d="M12 2 4.5 5v5.25c0 4.67 3.19 8.99 7.5 10.03 4.31-1.04 7.5-5.36 7.5-10.03V5L12 2Zm-1 13-3-3 1.41-1.41L11 12.17l3.59-3.58L16 10l-5 5Z" />
    ),
    wallet: (
      <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H18a2 2 0 0 1 2 2v1h-8a3 3 0 0 0 0 6h8v1a2 2 0 0 1-2 2H6.5A2.5 2.5 0 0 1 4 13.5v-7Zm8 2.5h8v4h-8a2 2 0 1 1 0-4Zm2 2a1 1 0 1 0 .001 2.001A1 1 0 0 0 14 11Z" />
    ),
    compass: (
      <path d="M12 2a10 10 0 1 0 10 10A10.01 10.01 0 0 0 12 2Zm3.96 6.04-2.24 6.72-6.68 2.2 2.24-6.68 6.68-2.24ZM12 13a1 1 0 1 0-1-1 1 1 0 0 0 1 1Z" />
    ),
    map: (
      <path d="M15 4.5 9 2 3 4.5v15L9 17l6 2.5 6-2.5v-15L15 4.5ZM10 4.23l4 1.67v13.87l-4-1.67V4.23Zm-5 1.6 3-1.25v13.87L5 19.7V5.83Zm14 10.87-3 1.25V4.08l3-1.25V16.7Z" />
    ),
    cloud: (
      <path d="M8 19a4 4 0 0 1-.78-7.92A5.5 5.5 0 0 1 17.8 9.5 3.5 3.5 0 1 1 18 19H8Z" />
    ),
    share: (
      <path d="M16 5a3 3 0 1 1 2.83 4H18.8l-7.02 3.5a3 3 0 0 1 0 1L18.8 17H19a3 3 0 1 1-.17 1H18.8l-7.02-3.5a3 3 0 1 1 0-5L18.8 6H19A3 3 0 0 1 16 5Z" />
    ),
    history: (
      <path d="M12 5a7 7 0 1 1-6.32 4H3l3.5-3.5L10 9H7.73A5 5 0 1 0 12 7v5l4 2-.9 1.8L10 13V5h2Z" />
    ),
    lock: (
      <path d="M7 10V8a5 5 0 1 1 10 0v2h1a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h1Zm2 0h6V8a3 3 0 1 0-6 0v2Zm3 4a2 2 0 0 1 1 3.73V19h-2v-1.27A2 2 0 0 1 12 14Z" />
    ),
    pin: (
      <path d="M12 21s6-5.33 6-11a6 6 0 1 0-12 0c0 5.67 6 11 6 11Zm0-8a3 3 0 1 1 0-6 3 3 0 0 1 0 6Z" />
    ),
    calendar: (
      <path d="M7 2h2v2h6V2h2v2h2a2 2 0 0 1 2 2v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6a2 2 0 0 1 2-2h2V2Zm12 8H5v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8Z" />
    ),
    route: (
      <path d="M7 4a3 3 0 1 1 0 6A3 3 0 0 1 7 4Zm10 10a3 3 0 1 1 0 6 3 3 0 0 1 0-6ZM7 12h2.5a3.5 3.5 0 0 1 3.5 3.5v.5H11v-2.5A1.5 1.5 0 0 0 9.5 12H7Zm6 0h4v-2h-4V8l-3 3 3 3v-2Z" />
    ),
    plane: (
      <path d="m2 13 20-5-5 7-4-1-3 4-2-1 1-4-7 0Z" />
    ),
    grid: (
      <path d="M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm9 0h7v7h-7v-7Z" />
    ),
    timeline: (
      <path d="M7 5a2 2 0 1 1 0 4 2 2 0 0 1 0-4Zm10 10a2 2 0 1 1 0 4 2 2 0 0 1 0-4ZM8.5 8h7a3.5 3.5 0 0 1 0 7h-7v-2h7a1.5 1.5 0 0 0 0-3h-7V8Z" />
    ),
    clock: (
      <path d="M12 2a10 10 0 1 0 10 10A10.01 10.01 0 0 0 12 2Zm1 5v5.59l3.7 3.7-1.4 1.41L11 13V7h2Z" />
    ),
    user: (
      <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-4.42 0-8 2.01-8 4.5V21h16v-2.5c0-2.49-3.58-4.5-8-4.5Z" />
    ),
    pulse: (
      <path d="M3 13h4l2-4 3 8 2-4h7" />
    ),
    quote: (
      <path d="M7 18H3V11.5A5.5 5.5 0 0 1 8.5 6H9v3H8.5A2.5 2.5 0 0 0 6 11.5V12h1a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2Zm10 0h-4V11.5A5.5 5.5 0 0 1 18.5 6H19v3h-.5A2.5 2.5 0 0 0 16 11.5V12h1a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2Z" />
    ),
    check: (
      <path d="m9.55 16.6-4.1-4.1 1.4-1.4 2.7 2.7 7-7 1.4 1.4-8.4 8.4Z" />
    ),
  }

  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      {icons[name] || icons.sparkles}
    </svg>
  )
}

function SectionHeading({ eyebrow, title, description, align = 'center' }) {
  return (
    <div className={`LandingSectionHeading LandingSectionHeading--${align}`}>
      <span className="LandingEyebrow">{eyebrow}</span>
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  )
}

function MockupWidget() {
  return (
    <div className="HeroMockup">
      <div className="HeroMockup__window">
        <div className="HeroMockup__topbar">
          <div className="HeroMockup__dots">
            <span />
            <span />
            <span />
          </div>
          <div className="HeroMockup__search">TripNest AI Planner</div>
        </div>
        <div className="HeroMockup__body">
          <div className="HeroMockup__sidebar">
            <div className="HeroMockup__sidebarCard is-active">
              <span className="HeroMockup__sidebarIcon" />
              <div>
                <strong>AI Planner</strong>
                <small>Smart itinerary</small>
              </div>
            </div>
            <div className="HeroMockup__sidebarCard">
              <span className="HeroMockup__sidebarIcon" />
              <div>
                <strong>Budget</strong>
                <small>Forecast costs</small>
              </div>
            </div>
            <div className="HeroMockup__sidebarCard">
              <span className="HeroMockup__sidebarIcon" />
              <div>
                <strong>Timeline</strong>
                <small>Daily schedule</small>
              </div>
            </div>
          </div>
          <div className="HeroMockup__panel">
            <div className="HeroMockup__heroCard">
              <span className="LandingChip">7-day escape</span>
              <h3>Hunza Valley Adventure</h3>
              <p>Personalized plan with scenic stops, local stays, budget range, and AI suggestions.</p>
            </div>
            <div className="HeroMockup__grid">
              <div className="HeroMockup__metric">
                <span>Estimated Budget</span>
                <strong>$1,240</strong>
              </div>
              <div className="HeroMockup__metric">
                <span>Best Season</span>
                <strong>May - Sep</strong>
              </div>
              <div className="HeroMockup__timeline">
                <div>
                  <span>Day 1</span>
                  <strong>Islamabad to Hunza</strong>
                </div>
                <div>
                  <span>Day 2</span>
                  <strong>Attabad Lake + Café stops</strong>
                </div>
                <div>
                  <span>Day 3</span>
                  <strong>Passu + viewpoint trail</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="HeroMockup__floatingCard HeroMockup__floatingCard--budget">
        <span>Budget Planner</span>
        <strong>Stay on track</strong>
        <small>Hotels, food, commute, and activities forecasted.</small>
      </div>
      <div className="HeroMockup__floatingCard HeroMockup__floatingCard--weather">
        <span>Weather Insight</span>
        <strong>19°C Clear</strong>
        <small>Ideal for sightseeing and outdoor stops.</small>
      </div>
    </div>
  )
}

export function HeroSection() {
  return (
    <section id="home" className="LandingHero">
      <div className="LandingHero__content">
        <span className="LandingBadge">AI-powered travel planning for modern explorers</span>
        <h1>Plan Smarter. Travel Better.</h1>
        <p>
          TripNest uses Artificial Intelligence to generate personalized travel itineraries, estimate budgets,
          recommend destinations, and make every journey unforgettable.
        </p>
        <div className="LandingHero__actions">
          <Link className="LandingButton LandingButton--primary LandingButton--large" to="/signup">
            Start Planning Free
          </Link>
          <a className="LandingButton LandingButton--secondary LandingButton--large" href="#showcase">
            Watch Demo
          </a>
        </div>
        <GoogleButton className="LandingGoogleButton--hero" />
        <div className="LandingHero__highlights">
          <span>AI-guided plans</span>
          <span>Budget-aware decisions</span>
          <span>Beautiful trip organization</span>
        </div>
      </div>
      <div className="LandingHero__visual">
        <MockupWidget />
      </div>
    </section>
  )
}

export function StatsSection() {
  return (
    <section className="LandingSection" aria-label="Trust indicators">
      <div className="LandingStatsGrid">
        {trustStats.map((stat) => (
          <article key={stat.title} className="LandingStatCard">
            <span className="LandingIconWrap">
              <IconSymbol name={stat.icon} />
            </span>
            <strong>{stat.value}</strong>
            <h3>{stat.title}</h3>
            <p>{stat.description}</p>
          </article>
        ))}
      </div>
    </section>
  )
}

export function FeaturesSection() {
  return (
    <section id="features" className="LandingSection">
      <SectionHeading
        eyebrow="Features"
        title="Everything you need to plan like a premium travel brand"
        description="TripNest combines elegant UI with practical AI planning tools to turn ideas into structured journeys."
      />
      <div className="LandingFeatureGrid">
        {featureCards.map((feature) => (
          <article key={feature.title} className="LandingFeatureCard">
            <span className="LandingIconWrap LandingIconWrap--soft">
              <IconSymbol name={feature.icon} />
            </span>
            <h3>{feature.title}</h3>
            <p>{feature.description}</p>
          </article>
        ))}
      </div>
    </section>
  )
}

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="LandingSection">
      <SectionHeading
        eyebrow="How It Works"
        title="From idea to itinerary in four simple steps"
        description="A clear flow makes travel planning faster, cleaner, and less overwhelming."
      />
      <div className="LandingTimeline">
        {howItWorksSteps.map((step, index) => (
          <article key={step.title} className="LandingTimelineStep">
            <div className="LandingTimelineStep__icon">
              <IconSymbol name={step.icon} />
            </div>
            <h3>{step.title}</h3>
            <p>{step.description}</p>
            {index < howItWorksSteps.length - 1 ? <span className="LandingTimelineStep__arrow" aria-hidden="true">↓</span> : null}
          </article>
        ))}
      </div>
    </section>
  )
}

export function ShowcaseSection() {
  return (
    <section id="showcase" className="LandingSection LandingSection--showcase">
      <SectionHeading
        eyebrow="Application Showcase"
        title="A polished product experience designed for confident planning"
        description="Preview the core TripNest workspace with overlapping cards inspired by premium SaaS layouts."
        align="left"
      />
      <div className="LandingShowcase">
        <div className="LandingShowcase__primary">
          <span className="LandingChip">TripNest Workspace</span>
          <h3>Dashboard + AI planning in one connected flow</h3>
          <p>Organize destinations, trip days, recommendations, and budgets inside one clean workspace.</p>
          <div className="LandingShowcase__miniStats">
            <div>
              <span>Planning Time</span>
              <strong>-63%</strong>
            </div>
            <div>
              <span>Trip Clarity</span>
              <strong>High</strong>
            </div>
            <div>
              <span>Recommended Places</span>
              <strong>48</strong>
            </div>
          </div>
        </div>
        <div className="LandingShowcase__stack">
          {showcaseCards.map((card, index) => (
            <article
              key={card.title}
              className={`LandingShowcaseCard LandingShowcaseCard--${card.accent}`}
              style={{ '--landing-card-index': index }}
            >
              <span className="LandingShowcaseCard__label">{card.label}</span>
              <div className="LandingShowcaseCard__row">
                <span className="LandingIconWrap LandingIconWrap--small">
                  <IconSymbol name={card.icon} />
                </span>
                <div>
                  <h3>{card.title}</h3>
                  <p>{card.description}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

export function DestinationsSection() {
  return (
    <section id="destinations" className="LandingSection">
      <SectionHeading
        eyebrow="Popular Destinations"
        title="Explore inspiring destinations for every kind of traveler"
        description="From mountain escapes to iconic cities, TripNest helps shape the journey before you even pack."
      />
      <div className="LandingDestinationGrid">
        {popularDestinations.map((destination) => (
          <article key={destination.city} className="LandingDestinationCard">
            <div className="LandingDestinationCard__imageWrap">
              <img src={destination.image} alt={`${destination.city}, ${destination.country}`} loading="lazy" />
            </div>
            <div className="LandingDestinationCard__body">
              <span>{destination.country}</span>
              <h3>{destination.city}</h3>
              <p>{destination.description}</p>
              <a className="LandingInlineButton" href="#contact">
                Explore
              </a>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

export function WhyChooseSection() {
  return (
    <section id="about" className="LandingSection">
      <div className="LandingWhyChoose">
        <div className="LandingWhyChoose__visual">
          <div className="LandingPreviewPanel">
            <span className="LandingChip">Why TripNest</span>
            <h3>Built to feel intelligent, beautiful, and practical</h3>
            <div className="LandingPreviewPanel__cards">
              <div className="LandingPreviewCard">
                <strong>Smart Trip Summary</strong>
                <p>View routes, trip days, and budget forecasts at a glance.</p>
              </div>
              <div className="LandingPreviewCard">
                <strong>Recommendation Engine</strong>
                <p>See tailored place suggestions based on travel goals and style.</p>
              </div>
              <div className="LandingPreviewCard">
                <strong>Cloud-Like Continuity</strong>
                <p>Keep planning organized across sessions and future enhancements.</p>
              </div>
            </div>
          </div>
        </div>
        <div className="LandingWhyChoose__content">
          <SectionHeading
            eyebrow="Why Choose TripNest"
            title="A better way to plan unforgettable journeys"
            description="TripNest is designed to reduce planning stress while elevating the overall travel experience."
            align="left"
          />
          <div className="LandingReasonList">
            {whyChooseReasons.map((reason) => (
              <article key={reason.title} className="LandingReasonItem">
                <span className="LandingIconWrap LandingIconWrap--small">
                  <IconSymbol name={reason.icon} />
                </span>
                <div>
                  <h3>{reason.title}</h3>
                  <p>{reason.description}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

export function TestimonialsSection() {
  return (
    <section id="testimonials" className="LandingSection">
      <SectionHeading
        eyebrow="Testimonials"
        title="Loved by travelers who want speed, clarity, and a premium experience"
        description="Professional placeholder reviews that reflect the positioning and product feel of TripNest."
      />
      <div className="LandingTestimonialGrid">
        {testimonials.map((testimonial) => (
          <article key={testimonial.name} className="LandingTestimonialCard">
            <span className="LandingIconWrap LandingIconWrap--small LandingIconWrap--quote">
              <IconSymbol name="quote" />
            </span>
            <p>{testimonial.quote}</p>
            <div className="LandingTestimonialCard__author">
              <span>{testimonial.name}</span>
              <small>{testimonial.role}</small>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

function FaqItem({ item, isOpen, onToggle }) {
  return (
    <article className={`LandingFaqItem ${isOpen ? 'is-open' : ''}`}>
      <button type="button" className="LandingFaqItem__trigger" onClick={onToggle} aria-expanded={isOpen}>
        <span>{item.question}</span>
        <span className="LandingFaqItem__symbol" aria-hidden="true">
          {isOpen ? '−' : '+'}
        </span>
      </button>
      {isOpen ? <p>{item.answer}</p> : null}
    </article>
  )
}

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState(0)

  return (
    <section id="faq" className="LandingSection">
      <SectionHeading
        eyebrow="FAQ"
        title="Answers to common questions about TripNest"
        description="The landing page keeps expectations clear while preserving the current app functionality."
      />
      <div className="LandingFaqList">
        {faqs.map((item, index) => (
          <FaqItem
            key={item.question}
            item={item}
            isOpen={openIndex === index}
            onToggle={() => setOpenIndex((current) => (current === index ? -1 : index))}
          />
        ))}
      </div>
    </section>
  )
}

export function CtaSection() {
  return (
    <section className="LandingSection">
      <div className="LandingCtaBanner">
        <div>
          <span className="LandingEyebrow">Start Your Journey</span>
          <h2>Ready for your next adventure?</h2>
          <p>Create a polished AI-assisted trip plan in minutes and organize everything in one place.</p>
        </div>
        <div className="LandingCtaBanner__actions">
          <Link className="LandingButton LandingButton--primary LandingButton--large" to="/signup">
            Start Planning Free
          </Link>
          <GoogleButton />
        </div>
      </div>
    </section>
  )
}
