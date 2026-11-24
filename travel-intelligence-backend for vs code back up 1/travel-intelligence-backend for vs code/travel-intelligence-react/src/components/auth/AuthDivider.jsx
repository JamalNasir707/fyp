export default function AuthDivider({ label = 'OR' }) {
  return (
    <div className="AuthDivider" role="separator" aria-label={label}>
      <span className="AuthDivider__line" />
      <span className="AuthDivider__label">{label}</span>
      <span className="AuthDivider__line" />
    </div>
  )
}
