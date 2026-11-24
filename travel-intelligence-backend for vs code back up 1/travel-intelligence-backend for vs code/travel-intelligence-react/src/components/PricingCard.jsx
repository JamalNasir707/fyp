export default function PricingCard({ plan, onContinue }) {
  return (
    <section className="TripHubPremiumPricing">
      <p className="TripHubPremiumPricing__eyebrow">Try it free for 7 days.</p>

      <label className="TripHubPremiumPricing__option">
        <input type="radio" name="tripnest-premium-plan" checked readOnly />
        <span className="TripHubPremiumPricing__radio" aria-hidden="true" />
        <span className="TripHubPremiumPricing__copy">
          <strong>{plan.name}</strong>
          <span>{plan.trial}</span>
          <em>{plan.price}</em>
        </span>
      </label>

      <button type="button" className="TripHubPremiumPricing__button" onClick={onContinue}>
        Continue
      </button>

      <p className="TripHubPremiumPricing__disclaimer">{plan.disclaimer}</p>
    </section>
  )
}
