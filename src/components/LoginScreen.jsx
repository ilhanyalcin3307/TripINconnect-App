import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

export default function LoginScreen() {
  const [mode, setMode] = useState('login'); // 'login' | 'register' | 'reset'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    setLoading(false);
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setError(error.message);
    } else {
      setInfo('Konto erstellt! Du kannst dich jetzt anmelden.');
      setMode('login');
    }
    setLoading(false);
  };

  const handleReset = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) {
      setError(error.message);
    } else {
      setInfo('Passwort-Reset E-Mail wurde gesendet. Bitte überprüfe dein Postfach.');
    }
    setLoading(false);
  };

  const submit = mode === 'login' ? handleLogin : mode === 'register' ? handleRegister : handleReset;

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg, #0d0f12)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Inter', sans-serif"
    }}>
      <div style={{
        width: '100%',
        maxWidth: '400px',
        padding: '0 24px'
      }}>

        {/* Logo & Başlık */}
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <div style={{
            width: '56px', height: '56px',
            background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
            borderRadius: '16px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
            fontSize: '24px'
          }}>✈</div>
          <div style={{ fontSize: '22px', fontWeight: '800', color: 'var(--text, #f1f5f9)' }}>
            TripIn<span style={{ color: '#3b82f6' }}>Connect</span>
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text2, #64748b)', marginTop: '4px' }}>
            Reisebüro Management Portal
          </div>
        </div>

        {/* Kart */}
        <div style={{
          background: 'var(--surface, #161a21)',
          border: '1px solid var(--border, #1e2530)',
          borderRadius: '16px',
          padding: '28px'
        }}>
          {/* Tab Başlıklar */}
          <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', background: 'var(--bg, #0d0f12)', borderRadius: '10px', padding: '4px' }}>
            {[{ key: 'login', label: 'Anmelden' }, { key: 'register', label: 'Registrieren' }].map(({ key, label }) => (
              <button key={key} onClick={() => { setMode(key); setError(''); setInfo(''); }}
                style={{
                  flex: 1, padding: '7px 0', border: 'none', borderRadius: '8px', cursor: 'pointer',
                  fontWeight: '600', fontSize: '13px', transition: 'all 0.15s',
                  background: mode === key ? '#3b82f6' : 'transparent',
                  color: mode === key ? '#fff' : 'var(--text2, #64748b)'
                }}>
                {label}
              </button>
            ))}
          </div>

          {mode === 'reset' && (
            <div style={{ marginBottom: '16px', fontSize: '13px', color: 'var(--text2, #64748b)' }}>
              Gib deine E-Mail-Adresse ein. Wir senden dir einen Link zum Zurücksetzen.
            </div>
          )}

          <form onSubmit={submit}>
            {/* E-Mail */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text2, #64748b)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                E-Mail
              </label>
              <input
                type="email" required value={email} onChange={e => setEmail(e.target.value)}
                placeholder="name@reisebuero.de"
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: '8px', boxSizing: 'border-box',
                  background: 'var(--bg, #0d0f12)', border: '1px solid var(--border, #1e2530)',
                  color: 'var(--text, #f1f5f9)', fontSize: '13px', outline: 'none',
                  transition: 'border-color 0.15s'
                }}
                onFocus={e => e.target.style.borderColor = '#3b82f6'}
                onBlur={e => e.target.style.borderColor = 'var(--border, #1e2530)'}
              />
            </div>

            {/* Passwort — reset modunda gösterme */}
            {mode !== 'reset' && (
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text2, #64748b)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Passwort
                </label>
                <input
                  type="password" required value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  minLength={mode === 'register' ? 8 : undefined}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: '8px', boxSizing: 'border-box',
                    background: 'var(--bg, #0d0f12)', border: '1px solid var(--border, #1e2530)',
                    color: 'var(--text, #f1f5f9)', fontSize: '13px', outline: 'none',
                    transition: 'border-color 0.15s'
                  }}
                  onFocus={e => e.target.style.borderColor = '#3b82f6'}
                  onBlur={e => e.target.style.borderColor = 'var(--border, #1e2530)'}
                />
                {mode === 'register' && (
                  <div style={{ fontSize: '11px', color: 'var(--text2, #64748b)', marginTop: '4px' }}>Min. 8 Zeichen</div>
                )}
              </div>
            )}

            {/* Hata mesajı */}
            {error && (
              <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '10px 12px', marginBottom: '16px', fontSize: '12px', color: '#f87171' }}>
                {error}
              </div>
            )}

            {/* Bilgi mesajı */}
            {info && (
              <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '8px', padding: '10px 12px', marginBottom: '16px', fontSize: '12px', color: '#34d399' }}>
                {info}
              </div>
            )}

            {/* Submit */}
            <button type="submit" disabled={loading}
              style={{
                width: '100%', padding: '11px', borderRadius: '8px', border: 'none',
                background: loading ? '#334155' : 'linear-gradient(135deg, #3b82f6, #6366f1)',
                color: loading ? '#64748b' : '#fff',
                fontSize: '13px', fontWeight: '700', cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s'
              }}>
              {loading ? '...' : mode === 'login' ? 'Anmelden' : mode === 'register' ? 'Konto erstellen' : 'Link senden'}
            </button>
          </form>

          {/* Passwort vergessen */}
          {mode === 'login' && (
            <div style={{ textAlign: 'center', marginTop: '16px' }}>
              <button onClick={() => { setMode('reset'); setError(''); setInfo(''); }}
                style={{ background: 'none', border: 'none', color: '#3b82f6', fontSize: '12px', cursor: 'pointer', textDecoration: 'underline' }}>
                Passwort vergessen?
              </button>
            </div>
          )}

          {mode === 'reset' && (
            <div style={{ textAlign: 'center', marginTop: '16px' }}>
              <button onClick={() => { setMode('login'); setError(''); setInfo(''); }}
                style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '12px', cursor: 'pointer' }}>
                ← Zurück zur Anmeldung
              </button>
            </div>
          )}
        </div>

        <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '11px', color: '#334155' }}>
          © 2026 TripInConnect · Alle Rechte vorbehalten
        </div>
      </div>
    </div>
  );
}
