import { Link } from 'react-router-dom'
import { landingNavLinks } from '../../lib/landingContent'

export default function LandingNavbar() {
  return (
    <header className="LandingNavbar">
      <div className="LandingNavbar__inner">
        <a className="LandingNavbar__brand" href="#home" aria-label="TripNest home">
          <span className="LandingNavbar__brandMark">TN</span>
          <span>TripNest</span>
        </a>

        <nav className="LandingNavbar__nav" aria-label="Primary">
          {landingNavLinks.map((link) => (
            <a key={link.href} href={link.href}>
              {link.label}
            </a>
          ))}
        </nav>

        <div className="LandingNavbar__actions">
          <Link className="LandingButton LandingButton--ghost" to="/login">
            Login
          </Link>
          <Link className="LandingButton LandingButton--primary" to="/signup">
            Sign Up
          </Link>
        </div>
      </div>
    </header>
  )
}
