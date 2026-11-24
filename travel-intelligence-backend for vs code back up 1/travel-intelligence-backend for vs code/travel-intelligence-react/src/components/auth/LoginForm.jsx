export default function LoginForm({
  values,
  onChange,
  onSubmit,
  busy,
  onSwitchMode,
}) {
  return (
    <form className="AuthForm" onSubmit={onSubmit}>
      <div className="AuthField">
        <label htmlFor="login-username">Username</label>
        <input
          id="login-username"
          type="text"
          autoComplete="username"
          placeholder="Enter your username"
          value={values.username}
          onChange={(event) => onChange((prev) => ({ ...prev, username: event.target.value }))}
        />
      </div>

      <div className="AuthField">
        <div className="AuthField__labelRow">
          <label htmlFor="login-password">Password</label>
          <button type="button" className="AuthInlineAction reset-btn" title="Forgot password is not available yet">
            Forgot Password
          </button>
        </div>
        <input
          id="login-password"
          type="password"
          autoComplete="current-password"
          placeholder="Enter your password"
          value={values.password}
          onChange={(event) => onChange((prev) => ({ ...prev, password: event.target.value }))}
        />
      </div>

      <button className="AuthSubmitButton" disabled={busy} type="submit">
        {busy ? 'Signing In...' : 'Sign In'}
      </button>

      <p className="AuthSwitchText">
        Don&apos;t have an account?{' '}
        <button type="button" className="AuthSwitchAction reset-btn" onClick={onSwitchMode}>
          Create Account
        </button>
      </p>
    </form>
  )
}
