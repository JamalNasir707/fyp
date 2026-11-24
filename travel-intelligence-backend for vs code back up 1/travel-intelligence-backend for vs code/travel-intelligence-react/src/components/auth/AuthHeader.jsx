export default function AuthHeader({ mode }) {
  const isLogin = mode === 'login'

  return (
    <div className="AuthCardHeader">
      <div className="AuthCardHeader__logo">
        <span className="LandingNavbar__brandMark">TN</span>
        <div>
          <strong>TripNest</strong>
          <span>{isLogin ? 'Welcome back' : 'Create your account'}</span>
        </div>
      </div>
      <div className="AuthCardHeader__copy">
        <h1>{isLogin ? 'Welcome Back' : 'Create Your Account'}</h1>
        <p>
          {isLogin
            ? 'Sign in to continue planning smarter trips with the same secure account experience.'
            : 'Start building personalized travel plans with TripNest in a clean, premium workspace.'}
        </p>
      </div>
    </div>
  )
}
