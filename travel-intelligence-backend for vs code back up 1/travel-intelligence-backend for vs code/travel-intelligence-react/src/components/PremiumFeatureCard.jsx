function renderIcon(kind) {
  switch (kind) {
    case 'offline':
      return <path d="M6.75 7.5a5.25 5.25 0 0 1 10.5 0v3.5h.75A2.75 2.75 0 0 1 20.75 13.75v4.5A2.75 2.75 0 0 1 18 21H6a2.75 2.75 0 0 1-2.75-2.75v-4.5A2.75 2.75 0 0 1 6 11h.75V7.5Zm2 0V11h6.5V7.5a3.25 3.25 0 0 0-6.5 0Z" />
    case 'attachments':
      return <path d="M8.5 6.25a4.25 4.25 0 0 1 8.5 0v8a5.75 5.75 0 1 1-11.5 0v-7a1 1 0 1 1 2 0v7a3.75 3.75 0 1 0 7.5 0v-8a2.25 2.25 0 0 0-4.5 0v8.25a.75.75 0 0 0 1.5 0V8.5a1 1 0 1 1 2 0v6a2.75 2.75 0 0 1-5.5 0V6.25Z" />
    case 'assistant':
      return <path d="M12 2.75a6.25 6.25 0 0 0-6.25 6.25v2.04l-1.3 2.35a1.25 1.25 0 0 0 1.09 1.86h1.2V17a3.25 3.25 0 0 0 3.25 3.25h4A3.25 3.25 0 0 0 17.25 17v-1.75h1.2a1.25 1.25 0 0 0 1.09-1.86l-1.29-2.35V9A6.25 6.25 0 0 0 12 2.75Zm-1.75 6.5a1 1 0 1 1 0-2h3.5a1 1 0 1 1 0 2h-3.5Zm0 4a1 1 0 1 1 0-2h3.5a1 1 0 1 1 0 2h-3.5Z" />
    case 'optimize':
      return <path d="M5.5 5.5a2 2 0 1 1 0 4 2 2 0 0 1 0-4Zm13 0a2 2 0 1 1 0 4 2 2 0 0 1 0-4Zm-13 9a2 2 0 1 1 0 4 2 2 0 0 1 0-4Zm13 0a2 2 0 1 1 0 4 2 2 0 0 1 0-4ZM7.9 7.2l7.2 0m-7.2 9.6 7.2 0m-8.86-1.72 9.72-6.16" />
    case 'maps':
      return <path d="M5.75 4.1a1 1 0 0 1 .87-.13l4.38 1.59 5.02-1.62a1 1 0 0 1 .73.04l2.5 1.25a1 1 0 0 1 .55.9v12.12a1 1 0 0 1-.55.89 1 1 0 0 1-.87.06l-4.38-1.75-5 1.62a1 1 0 0 1-.72-.04l-2.5-1.25a1 1 0 0 1-.56-.9V5a1 1 0 0 1 .53-.9ZM9.75 7.2 7.25 6.3v10.07l2.5.96V7.2Zm2 0v10.1l3-1V6.18l-3 1.02Z" />
    case 'scan':
      return <path d="M6.75 3.75A3.75 3.75 0 0 0 3 7.5v9A3.75 3.75 0 0 0 6.75 20.25h10.5A3.75 3.75 0 0 0 21 16.5v-9a3.75 3.75 0 0 0-3.75-3.75H6.75Zm1.5 4.5h7.5a1 1 0 1 1 0 2h-7.5a1 1 0 0 1 0-2Zm0 4h5.5a1 1 0 1 1 0 2h-5.5a1 1 0 1 1 0-2Z" />
    case 'dark':
      return <path d="M14.4 3.38a1 1 0 0 1 .38 1.2 6.25 6.25 0 0 0 6.64 8.39 1 1 0 0 1 .91 1.62A8.75 8.75 0 1 1 13.4 2.97a1 1 0 0 1 1 .41Z" />
    case 'places':
      return <path d="M12 2.75a5.75 5.75 0 0 0-5.75 5.75c0 4.46 4.43 8.98 5.17 9.7a.83.83 0 0 0 1.16 0c.74-.72 5.17-5.24 5.17-9.7A5.75 5.75 0 0 0 12 2.75Zm0 8a2.25 2.25 0 1 1 0-4.5 2.25 2.25 0 0 1 0 4.5Zm7 7.25a1 1 0 0 1 0 2H5a1 1 0 0 1 0-2h14Z" />
    case 'priority':
      return <path d="m12 2.75 2.38 4.83 5.33.77-3.86 3.76.91 5.3L12 14.92l-4.76 2.49.91-5.3-3.86-3.76 5.33-.77L12 2.75Z" />
    case 'speed':
      return <path d="M12 4.25a8.75 8.75 0 1 0 8.75 8.75A8.76 8.76 0 0 0 12 4.25Zm0 2a6.75 6.75 0 0 1 5.84 10.14l-1.36-1.35A4.75 4.75 0 0 0 12 8.25a1 1 0 1 1 0-2Zm-.94 3.78a1 1 0 0 1 1.83.8l-1.2 2.74h2.56a1 1 0 0 1 .73 1.69l-1.95 2.05a1 1 0 1 1-1.45-1.38l.39-.41H9.78a1 1 0 0 1-.92-1.39l2.2-4.88Z" />
    default:
      return <path d="M12 3.5 4.5 7.25V12c0 4.4 2.99 8.5 7.5 9.75 4.51-1.25 7.5-5.35 7.5-9.75V7.25L12 3.5Z" />
  }
}

export default function PremiumFeatureCard({ title, icon, variant = 'grid', description }) {
  return (
    <article className={`TripHubPremiumFeatureCard TripHubPremiumFeatureCard--${variant}`}>
      <div className="TripHubPremiumFeatureCard__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24">{renderIcon(icon)}</svg>
      </div>
      <div className="TripHubPremiumFeatureCard__body">
        <h3>{title}</h3>
        {description ? <p>{description}</p> : null}
      </div>
    </article>
  )
}
