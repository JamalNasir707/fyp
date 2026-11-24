// TripNest Travel Branding Assets Architecture
// Bundled local offline assets matching the reference brand design
let logo = null
let logoMark = null
let mountainFooter = null
let loginHero = null

try {
  logo = require('./tripnest-logo.png')
  logoMark = require('./tripnest-mark.png')
  mountainFooter = require('./mountain-footer.png')
  loginHero = require('./login-hero.png')
} catch {}

export const BRANDING_ASSETS = {
  logo,
  logoMark,
  mountainFooter,
  loginHero,
}
