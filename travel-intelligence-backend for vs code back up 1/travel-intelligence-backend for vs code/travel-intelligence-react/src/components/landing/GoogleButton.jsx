function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M21.6 12.227c0-.709-.064-1.391-.182-2.045H12v3.873h5.387a4.61 4.61 0 0 1-2.001 3.027v2.516h3.236c1.894-1.746 2.978-4.323 2.978-7.371Z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 4.964-.895 6.619-2.402l-3.236-2.516c-.895.6-2.036.955-3.383.955-2.607 0-4.818-1.76-5.607-4.127H3.048v2.596A9.995 9.995 0 0 0 12 22Z"
      />
      <path
        fill="#FBBC05"
        d="M6.393 13.91A5.996 5.996 0 0 1 6.08 12c0-.664.114-1.309.313-1.91V7.494H3.048A9.993 9.993 0 0 0 2 12c0 1.613.386 3.14 1.048 4.506l3.345-2.596Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.964c1.468 0 2.786.505 3.822 1.496l2.868-2.868C16.959 2.978 14.696 2 12 2a9.995 9.995 0 0 0-8.952 5.494L6.393 10.09C7.182 7.723 9.393 5.964 12 5.964Z"
      />
    </svg>
  )
}

export default function GoogleButton({
  className = '',
  label = 'Continue with Google',
  onClick,
  disabled = false,
  title = 'Continue with Google',
}) {
  return (
    <button
      type="button"
      className={`LandingGoogleButton ${className}`.trim()}
      aria-label={label}
      title={title}
      onClick={onClick}
      disabled={disabled}
    >
      <span className="LandingGoogleButton__icon">
        <GoogleIcon />
      </span>
      <span>{label}</span>
    </button>
  )
}
