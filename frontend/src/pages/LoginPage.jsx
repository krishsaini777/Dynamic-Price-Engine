import React, { useState } from 'react';
import { useNavigate, Navigate, Link } from 'react-router-dom';
import { Zap, LogIn, UserPlus, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import ErrorAlert from '../components/common/ErrorAlert';

export default function LoginPage() {
  const { login, register, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();

  const [tab, setTab] = useState('login'); // 'login' | 'register'
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Already logged in — redirect immediately
  if (!loading && isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (tab === 'login') {
        await login(form.email, form.password);
      } else {
        if (!form.name.trim()) {
          setError('Please enter your name.');
          return;
        }
        await register(form.name, form.email, form.password);
      }
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const switchTab = (t) => {
    setTab(t);
    setError('');
    setForm({ name: '', email: '', password: '' });
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

        {/* Card */}
        <div className="card" style={{ padding: '2rem' }}>

          {/* Tabs */}
          <div
            style={{
              display: 'flex',
              gap: 0,
              borderRadius: 8,
              overflow: 'hidden',
              border: '1px solid var(--border-color)',
              marginBottom: '1.75rem',
            }}
          >
            {['login', 'register'].map((t) => (
              <button
                key={t}
                onClick={() => switchTab(t)}
                style={{
                  flex: 1,
                  padding: '0.55rem',
                  fontSize: '0.8rem',
                  fontWeight: tab === t ? 600 : 400,
                  color: tab === t ? '#fff' : 'var(--text-secondary)',
                  background: tab === t ? 'var(--accent-indigo)' : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  fontFamily: 'inherit',
                  textTransform: 'capitalize',
                }}
              >
                {t === 'login' ? 'Log In' : 'Register'}
              </button>
            ))}
          </div>

          {/* Title */}
          <h1
            style={{
              fontSize: '1.2rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
              marginBottom: '0.4rem',
            }}
          >
            {tab === 'login' ? 'Welcome back' : 'Create your account'}
          </h1>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
            {tab === 'login'
              ? 'Sign in to access your pricing dashboard'
              : 'Get started with the Dynamic Pricing Engine'}
          </p>

          {/* Error */}
          <ErrorAlert message={error} onDismiss={() => setError('')} />

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

            {/* Name — register only */}
            {tab === 'register' && (
              <div>
                <label className="label" htmlFor="name">Full Name</label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  className="input"
                  placeholder="Jane Doe"
                  value={form.name}
                  onChange={handleChange}
                  required
                  autoComplete="name"
                />
              </div>
            )}

            {/* Email */}
            <div>
              <label className="label" htmlFor="email">Email Address</label>
              <input
                id="email"
                name="email"
                type="email"
                className="input"
                placeholder="you@example.com"
                value={form.email}
                onChange={handleChange}
                required
                autoComplete="email"
              />
            </div>

            {/* Password */}
            <div>
              {/* Label row: "Password" on the left, "Forgot Password?" on the right */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                <label className="label" htmlFor="password" style={{ margin: 0 }}>Password</label>
                {tab === 'login' && (
                  <Link
                    to="/forgot-password"
                    style={{
                      fontSize: '0.72rem',
                      color: 'var(--accent-indigo)',
                      textDecoration: 'none',
                      fontWeight: 500,
                    }}
                  >
                    Forgot password?
                  </Link>
                )}
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  className="input"
                  placeholder={tab === 'register' ? 'Minimum 8 characters' : '••••••••'}
                  value={form.password}
                  onChange={handleChange}
                  required
                  minLength={8}
                  autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
                  style={{ paddingRight: '2.5rem' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  style={{
                    position: 'absolute',
                    right: '0.75rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    display: 'flex',
                    color: 'var(--text-muted)',
                  }}
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
              style={{ marginTop: '0.5rem', padding: '0.65rem 1rem', fontSize: '0.9rem' }}
            >
              {submitting ? (
                <>
                  <svg
                    width={16}
                    height={16}
                    viewBox="0 0 24 24"
                    fill="none"
                    style={{ animation: 'spin 0.8s linear infinite' }}
                  >
                    <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="3" />
                    <path d="M12 2 A10 10 0 0 1 22 12" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                  {tab === 'login' ? 'Signing in...' : 'Creating account...'}
                </>
              ) : (
                <>
                  {tab === 'login' ? <LogIn size={16} /> : <UserPlus size={16} />}
                  {tab === 'login' ? 'Sign In' : 'Create Account'}
                </>
              )}
            </button>
          </form>

          {/* Switch tab link */}
          <p
            style={{
              textAlign: 'center',
              fontSize: '0.78rem',
              color: 'var(--text-muted)',
              marginTop: '1.25rem',
            }}
          >
            {tab === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <button
              onClick={() => switchTab(tab === 'login' ? 'register' : 'login')}
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
              {tab === 'login' ? 'Register' : 'Sign in'}
            </button>
          </p>
        </div>

        <p
          style={{
            textAlign: 'center',
            fontSize: '0.7rem',
            color: 'var(--text-muted)',
            marginTop: '1.25rem',
          }}
        >
          v1.0 · PriceEngine · Dynamic Pricing
        </p>
      </div>
    </div>
  );
}
