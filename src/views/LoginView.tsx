'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { Wordmark } from '../components/Wordmark';
import { useT } from '../i18n/SettingsProvider';
import type { MessageKey } from '../i18n/messages';
import { getSupabase, supabaseReady } from '../lib/supabase/client';

type Step = 'start' | 'code';

const ERROR_KEYS: Record<string, MessageKey> = {
  'other-browser': 'login.errorOtherBrowser',
  expired: 'login.errorExpired',
  provider: 'login.errorProvider',
  missing: 'login.errorExpired',
};

// Pantalla de inicio de sesión: Google o email (enlace o código de un solo uso)
export function LoginView({ next, error }: { next: string; error?: string }) {
  const t = useT();
  const router = useRouter();
  const [step, setStep] = useState<Step>('start');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<MessageKey | null>(error ? (ERROR_KEYS[error] ?? 'login.errorExpired') : null);

  const callbackUrl = () => `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
  const done = () => {
    router.replace(next);
    router.refresh();
  };

  // Si se inicia sesión en otra pestaña (por ejemplo, pulsando el enlace del email), se continúa aquí
  useEffect(() => {
    if (!supabaseReady()) return;
    const { data } = getSupabase().auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') done();
    });
    return () => data.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const google = async () => {
    setBusy(true);
    setMessage(null);
    const { error: err } = await getSupabase().auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: callbackUrl() },
    });
    if (err) {
      setBusy(false);
      setMessage('login.errorProvider');
    }
  };

  const sendEmail = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const { error: err } = await getSupabase().auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: callbackUrl(), shouldCreateUser: true },
    });
    setBusy(false);
    if (err) {
      setMessage(/rate|seconds|too many/i.test(err.message) ? 'login.errorRate' : 'login.errorSend');
      return;
    }
    setStep('code');
  };

  const verify = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const { error: err } = await getSupabase().auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
    setBusy(false);
    if (err) setMessage('login.errorCode');
    else done();
  };

  return (
    <div className="login">
      <div className="login-card card">
        <div className="login-brand">
          <Wordmark large />
        </div>
        <h1 className="login-title">{t('login.title')}</h1>
        <p className="card-text">{t('login.subtitle')}</p>

        {!supabaseReady() ? <p className="small text-error">{t('login.notConfigured')}</p> : null}

        {step === 'start' ? (
          <>
            <button type="button" className="button button--google" onClick={google} disabled={busy}>
              <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
                <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.6 15.1 18.9 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
                <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
                <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
              </svg>
              {t('login.google')}
            </button>

            <div className="login-divider">
              <span>{t('login.or')}</span>
            </div>

            <form onSubmit={sendEmail} className="login-form">
              <label className="field-label" htmlFor="login-email">
                {t('login.email')}
              </label>
              <input
                id="login-email"
                className="input"
                type="email"
                autoComplete="email"
                inputMode="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('login.emailPlaceholder')}
              />
              <button type="submit" className="button button--block" disabled={busy || !email}>
                {t('login.sendEmail')}
              </button>
            </form>
          </>
        ) : (
          <form onSubmit={verify} className="login-form">
            <p className="card-text">{t('login.checkEmail', { email })}</p>
            <label className="field-label" htmlFor="login-code">
              {t('login.code')}
            </label>
            <input
              id="login-code"
              className="input input--code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6,10}"
              maxLength={10}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            />
            <button type="submit" className="button button--block" disabled={busy || code.length < 6}>
              {t('login.verify')}
            </button>
            <button
              type="button"
              className="button button--ghost button--block"
              onClick={() => {
                setStep('start');
                setCode('');
                setMessage(null);
              }}
            >
              {t('login.back')}
            </button>
          </form>
        )}

        {message ? (
          <p className="small text-error setting-help" role="alert">
            {t(message)}
          </p>
        ) : null}

        <p className="muted small login-legal">
          {t('login.legalPrefix')}{' '}
          <Link href="/condiciones" className="link link--inline">
            {t('legal.terms')}
          </Link>{' '}
          {t('login.legalAnd')}{' '}
          <Link href="/privacidad" className="link link--inline">
            {t('legal.privacy')}
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
