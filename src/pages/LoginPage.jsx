import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { signIn, authError } = useAuth();
  const [pin, setPin] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!pin.trim()) return;
    setSubmitting(true);
    setLocalError(null);
    try {
      await signIn(pin);
    } catch (err) {
      setLocalError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-icon">📦</div>
        <h1 className="login-title">Stock Ledger</h1>
        <p className="login-subtitle">Enter your PIN to continue</p>
        <form id="login-form" onSubmit={handleSubmit} className="login-form">
          <input
            id="pin-input"
            type="password"
            className="input login-pin-input"
            placeholder="Enter PIN"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            autoComplete="current-password"
            autoFocus
          />
          {(localError || authError) && (
            <p className="error-text">{localError || authError}</p>
          )}
          <button
            id="login-submit-btn"
            type="submit"
            className={`btn btn-primary login-btn${submitting ? ' loading' : ''}`}
            disabled={submitting || !pin.trim()}
          >
            {submitting ? 'Signing in…' : 'Enter'}
          </button>
        </form>
      </div>
    </div>
  );
}
