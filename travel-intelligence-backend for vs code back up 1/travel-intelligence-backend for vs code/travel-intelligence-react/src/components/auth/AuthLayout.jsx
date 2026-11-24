import AuthHeader from './AuthHeader'
import AuthIllustration from './AuthIllustration'

export default function AuthLayout({
  mode,
  banner,
  actions,
  children,
  footer,
}) {
  return (
    <div className="AuthExperience">
      <AuthIllustration />

      <section className="AuthPanel" aria-label={mode === 'login' ? 'Sign in' : 'Create account'}>
        <div className="AuthPanel__card">
          <AuthHeader mode={mode} />
          {banner}
          {actions}
          {children}
          {footer}
        </div>
      </section>
    </div>
  )
}
