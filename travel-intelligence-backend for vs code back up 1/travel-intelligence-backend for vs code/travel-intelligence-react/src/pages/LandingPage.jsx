import LandingFooter from '../components/landing/LandingFooter'
import LandingNavbar from '../components/landing/LandingNavbar'
import {
  CtaSection,
  DestinationsSection,
  FaqSection,
  FeaturesSection,
  HeroSection,
  HowItWorksSection,
  ShowcaseSection,
  StatsSection,
  TestimonialsSection,
  WhyChooseSection,
} from '../components/landing/LandingSections'
import '../styles/landing.css'

export default function LandingPage() {
  return (
    <div className="LandingPageShell">
      <LandingNavbar />
      <main className="LandingPage">
        <HeroSection />
        <StatsSection />
        <FeaturesSection />
        <HowItWorksSection />
        <ShowcaseSection />
        <DestinationsSection />
        <WhyChooseSection />
        <TestimonialsSection />
        <FaqSection />
        <CtaSection />
      </main>
      <LandingFooter />
    </div>
  )
}
