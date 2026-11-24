import { footerLinkGroups } from '../../lib/landingContent'

function isExternalLink(href) {
  return href.startsWith('http') || href.startsWith('mailto:')
}

function normalizeHref(href) {
  if (href.startsWith('#')) {
    return `/${href}`
  }
  return href
}

export default function LandingFooter() {
  return (
    <footer id="contact" className="LandingFooter">
      <div className="LandingFooter__top">
        <div className="LandingFooter__brandColumn">
          <a className="LandingNavbar__brand LandingNavbar__brand--footer" href="/#home">
            <span className="LandingNavbar__brandMark">TN</span>
            <span>TripNest</span>
          </a>
          <p>
            TripNest helps travelers plan smarter with AI-assisted itineraries, budget insights, destination ideas,
            and a premium product experience.
          </p>
        </div>

        <div className="LandingFooter__links">
          {footerLinkGroups.map((group) => (
            <div key={group.title} className="LandingFooter__group">
              <h3>{group.title}</h3>
              {group.links.map((link) => (
                <a
                  key={link.label}
                  href={normalizeHref(link.href)}
                  {...(isExternalLink(link.href) ? { target: '_blank', rel: 'noreferrer' } : {})}
                >
                  {link.label}
                </a>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="LandingFooter__bottom">
        <span>Copyright © {new Date().getFullYear()} TripNest. All rights reserved.</span>
        <span>Designed for modern travel planning.</span>
      </div>
    </footer>
  )
}
