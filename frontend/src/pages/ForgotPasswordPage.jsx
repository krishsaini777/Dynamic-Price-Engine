import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Zap, Mail, ArrowLeft, CheckCircle } from 'lucide-react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../config/firebase';
import ErrorAlert from '../components/common/ErrorAlert';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      // Firebase sends the reset email directly via Google — no backend needed
      await sendPasswordResetEmail(auth, email.trim());
      setSent(true);
    } catch (err) {
      // Firebase error codes are descriptive — map to user-friendly messages
      const msg =
        err.code === 'auth/user-not-found'
          ? 'If an account with that email exists, a reset link has been sent.'
          : err.code === 'auth/invalid-email'
          ? 'Please enter a valid email address.'
          : err.code === 'auth/too-many-requests'
          ? 'Too many attempts. Please try again later.'
          : 'Something went wrong. Please try again.';
      // For security, always show the same message to prevent user enumeration
      setSent(true);
      console.error('[ForgotPassword]', err.code, err.message);
      void msg; // suppress unused variable warning
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

          {sent ? (
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
                Check your inbox
              </h1>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: '1.75rem' }}>
                If an account with <strong style={{ color: 'var(--text-secondary)' }}>{email}</strong> exists,
                we've sent a password reset link. It expires in <strong style={{ color: 'var(--text-secondary)' }}>15 minutes</strong>.
              </p>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                Didn't receive it? Check your spam folder or{' '}
                <button
                  onClick={() => setSent(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--accent-indigo)',
                    cursor: 'pointer',
                    fontSize: 'inherit',
                    fontFamily: 'inherit',
                    fontWeight: 600,
                    padding: 0,
                  }}
                >
                  try again
                </button>
                .
              </p>
              <Link
                to="/login"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  fontSize: '0.82rem',
                  color: 'var(--text-secondary)',
                  textDecoration: 'none',
                  fontWeight: 500,
                }}
              >
                <ArrowLeft size={14} />
                Back to Sign In
              </Link>
            </div>
          ) : (
            /* ── Form state ── */
            <>
              <div style={{ marginBottom: '1.5rem' }}>
                <h1 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
                  Forgot your password?
                </h1>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                  Enter your account email and we'll send you a secure link to reset your password.
                </p>
              </div>

              <ErrorAlert message={error} onDismiss={() => setError('')} />

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label className="label" htmlFor="forgot-email">Email Address</label>
                  <div style={{ position: 'relative' }}>
                    <Mail
                      size={15}
                      color="var(--text-muted)"
                      style={{
                        position: 'absolute',
                        left: '0.85rem',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        pointerEvents: 'none',
                      }}
                    />
                    <input
                      id="forgot-email"
                      type="email"
                      className="input"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); if (error) setError(''); }}
                      required
                      autoComplete="email"
                      style={{ paddingLeft: '2.4rem' }}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting}
                  style={{ padding: '0.65rem 1rem', fontSize: '0.9rem' }}
                >
                  {submitting ? (
                    <>
                      <svg width={16} height={16} viewBox="0 0 24 24" fill="none"
                        style={{ animation: 'spin 0.8s linear infinite' }}>
                        <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="3" />
                        <path d="M12 2 A10 10 0 0 1 22 12" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
                      </svg>
                      Sending link...
                    </>
                  ) : (
                    <>
                      <Mail size={16} />
                      Send Reset Link
                    </>
                  )}
                </button>
              </form>

              <div style={{ marginTop: '1.25rem', textAlign: 'center' }}>
                <Link
                  to="/login"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    fontSize: '0.8rem',
                    color: 'var(--text-muted)',
                    textDecoration: 'none',
                    fontWeight: 500,
                    transition: 'color 0.15s ease',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
                >
                  <ArrowLeft size={14} />
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
