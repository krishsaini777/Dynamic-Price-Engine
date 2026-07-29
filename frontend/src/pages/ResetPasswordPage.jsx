import React, { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Zap, KeyRound, Eye, EyeOff, CheckCircle, XCircle } from 'lucide-react';
import { confirmPasswordReset } from 'firebase/auth';
import { auth } from '../config/firebase';
import ErrorAlert from '../components/common/ErrorAlert';

// ── Password strength indicator ───────────────────────────
function PasswordStrength({ password }) {
  if (!password) return null;

  const checks = [
    { label: 'At least 8 characters', pass: password.length >= 8 },
    { label: 'Contains a number', pass: /\d/.test(password) },
    { label: 'Contains a letter', pass: /[a-zA-Z]/.test(password) },
  ];

  const score = checks.filter((c) => c.pass).length;
  const barColor =
    score === 3 ? 'var(--accent-green)' :
    score === 2 ? 'var(--accent-yellow)' :
    'var(--accent-red)';

  return (
    <div style={{ marginTop: '0.5rem' }}>
      {/* Strength bar */}
      <div style={{ display: 'flex', gap: '3px', marginBottom: '0.5rem' }}>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: 3,
              borderRadius: 2,
              background: i <= score ? barColor : 'var(--border-color)',
              transition: 'background 0.2s ease',
            }}
          />
        ))}
      </div>
      {/* Checklist */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        {checks.map(({ label, pass }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            {pass
              ? <CheckCircle size={12} color="var(--accent-green)" />
              : <XCircle size={12} color="var(--text-muted)" />
            }
            <span style={{ fontSize: '0.72rem', color: pass ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  // Firebase sends ?oobCode=xxxx in the reset link URL
  const [searchParams] = useSearchParams();
  const oobCode = searchParams.get('oobCode');
  const navigate = useNavigate();

  const [form, setForm] = useState({ password: '', confirm: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (form.password.length < 8) {
      return setError('Password must be at least 8 characters.');
    }
    if (form.password !== form.confirm) {
      return setError('Passwords do not match.');
    }

    setSubmitting(true);
    try {
      if (!oobCode) {
        return setError('Invalid or expired reset link. Please request a new one.');
      }
      // Firebase verifies the oobCode and sets the new password atomically
      await confirmPasswordReset(auth, oobCode, form.password);
      setSuccess(true);
      // Redirect to login after a short delay
      setTimeout(() => {
        navigate('/login', { replace: true });
      }, 2500);
    } catch (err) {
      const msg =
        err.code === 'auth/invalid-action-code'
          ? 'This reset link has expired or already been used. Please request a new one.'
          : err.code === 'auth/weak-password'
          ? 'Password is too weak. Please use at least 8 characters.'
          : 'Something went wrong. The link may have expired.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-primary)',
        padding: '1.5rem',
      }}
    >
      <div style={{ width: '100%', maxWidth: 420 }} className="animate-fade-in">

        {/* Brand header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.65rem',
            marginBottom: '2rem',
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: 'linear-gradient(135deg, var(--accent-indigo), var(--accent-purple))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Zap size={20} color="#fff" />
          </div>
          <div>
            <p style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>
              PriceEngine
            </p>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
              Dynamic Pricing
            </p>
          </div>
        </div>

        <div className="card" style={{ padding: '2rem' }}>

          {success ? (
            /* ── Success state ── */
            <div style={{ textAlign: 'center' }} className="animate-fade-in">
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  background: 'rgba(34, 197, 94, 0.12)',
                  border: '1px solid rgba(34, 197, 94, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1.25rem',
                }}
              >
                <CheckCircle size={26} color="var(--accent-green)" />
              </div>
              <h1 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                Password updated!
              </h1>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.7 }}>
                Your password has been reset successfully. Redirecting you to the dashboard...
              </p>
              <div
                style={{
                  marginTop: '1rem',
                  width: '100%',
                  height: 3,
                  borderRadius: 2,
                  background: 'var(--border-color)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    background: 'var(--accent-green)',
                    animation: 'progress 2s linear forwards',
                    width: 0,
                  }}
                />
              </div>
              <style>{`@keyframes progress { to { width: 100%; } }`}</style>
            </div>
          ) : (
            /* ── Form state ── */
            <>
              <div style={{ marginBottom: '1.5rem' }}>
                <h1 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
                  Set a new password
                </h1>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                  Choose a strong password for your account. You'll be signed in automatically after reset.
                </p>
              </div>

              <ErrorAlert message={error} onDismiss={() => setError('')} />

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>

                {/* New password */}
                <div>
                  <label className="label" htmlFor="reset-password">New Password</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      id="reset-password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      className="input"
                      placeholder="Minimum 8 characters"
                      value={form.password}
                      onChange={handleChange}
                      required
                      minLength={8}
                      autoComplete="new-password"
                      style={{ paddingRight: '2.5rem' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      tabIndex={-1}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      style={{
                        position: 'absolute', right: '0.75rem', top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none', border: 'none', cursor: 'pointer',
                        padding: 0, display: 'flex', color: 'var(--text-muted)',
                      }}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <PasswordStrength password={form.password} />
                </div>

                {/* Confirm password */}
                <div>
                  <label className="label" htmlFor="reset-confirm">Confirm Password</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      id="reset-confirm"
                      name="confirm"
                      type={showConfirm ? 'text' : 'password'}
                      className="input"
                      placeholder="Re-enter your password"
                      value={form.confirm}
                      onChange={handleChange}
                      required
                      autoComplete="new-password"
                      style={{
                        paddingRight: '2.5rem',
                        borderColor: form.confirm && form.confirm !== form.password
                          ? 'var(--accent-red)'
                          : form.confirm && form.confirm === form.password
                          ? 'var(--accent-green)'
                          : undefined,
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm((v) => !v)}
                      tabIndex={-1}
                      aria-label={showConfirm ? 'Hide password' : 'Show password'}
                      style={{
                        position: 'absolute', right: '0.75rem', top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none', border: 'none', cursor: 'pointer',
                        padding: 0, display: 'flex', color: 'var(--text-muted)',
                      }}
                    >
                      {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {/* Inline match indicator */}
                  {form.confirm && form.confirm !== form.password && (
                    <p style={{ fontSize: '0.72rem', color: 'var(--accent-red)', marginTop: '0.3rem' }}>
                      Passwords do not match
                    </p>
                  )}
                  {form.confirm && form.confirm === form.password && (
                    <p style={{ fontSize: '0.72rem', color: 'var(--accent-green)', marginTop: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <CheckCircle size={11} /> Passwords match
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting}
                  style={{ padding: '0.65rem 1rem', fontSize: '0.9rem', marginTop: '0.25rem' }}
                >
                  {submitting ? (
                    <>
                      <svg width={16} height={16} viewBox="0 0 24 24" fill="none"
                        style={{ animation: 'spin 0.8s linear infinite' }}>
                        <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="3" />
                        <path d="M12 2 A10 10 0 0 1 22 12" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
                      </svg>
                      Resetting password...
                    </>
                  ) : (
                    <>
                      <KeyRound size={16} />
                      Reset Password
                    </>
                  )}
                </button>
              </form>

              <div style={{ marginTop: '1.25rem', textAlign: 'center' }}>
                <Link
                  to="/login"
                  style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textDecoration: 'none' }}
                >
                  Back to Sign In
                </Link>
              </div>
            </>
          )}
        </div>

        <p style={{ textAlign: 'center', fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '1.25rem' }}>
          v1.0 · PriceEngine · Dynamic Pricing
        </p>
      </div>
    </div>
  );
}
