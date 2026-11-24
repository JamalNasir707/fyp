export default function SignupForm({
  values,
  onChange,
  onSubmit,
  busy,
  onSwitchMode,
}) {
  return (
    <form className="AuthForm" onSubmit={onSubmit}>
      <div className="AuthField">
        <label htmlFor="register-username">Full Name</label>
        <input
          id="register-username"
          type="text"
          autoComplete="name"
          placeholder="Enter your full name"
          value={values.username}
          onChange={(event) => onChange((prev) => ({ ...prev, username: event.target.value }))}
        />
      </div>

      <div className="AuthField">
        <label htmlFor="register-email">Email</label>
        <input
          id="register-email"
          type="email"
          autoComplete="email"
          placeholder="Enter your email"
          value={values.email}
          onChange={(event) => onChange((prev) => ({ ...prev, email: event.target.value }))}
        />
      </div>

      <div className="AuthField AuthFieldGrid">
        <div className="AuthField">
          <label htmlFor="register-password">Password</label>
          <input
            id="register-password"
            type="password"
            autoComplete="new-password"
            placeholder="Create a password"
            value={values.password}
            onChange={(event) => onChange((prev) => ({ ...prev, password: event.target.value }))}
          />
        </div>

        <div className="AuthField">
          <label htmlFor="register-confirm">Confirm Password</label>
          <input
            id="register-confirm"
            type="password"
            autoComplete="new-password"
            placeholder="Confirm your password"
            value={values.confirm}
            onChange={(event) => onChange((prev) => ({ ...prev, confirm: event.target.value }))}
          />
        </div>
      </div>

      <button className="AuthSubmitButton" disabled={busy} type="submit">
        {busy ? 'Creating Account...' : 'Create Account'}
      </button>

      <p className="AuthSwitchText">
        Already have an account?{' '}
        <button type="button" className="AuthSwitchAction reset-btn" onClick={onSwitchMode}>
          Sign In
        </button>
      </p>
    </form>
  )
}
