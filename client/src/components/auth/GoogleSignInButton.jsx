import { useEffect, useRef, useState } from 'react';

const GOOGLE_SCRIPT_URL = 'https://accounts.google.com/gsi/client';
let googleScriptPromise;

const loadGoogleScript = () => {
  if (window.google?.accounts?.id) return Promise.resolve(window.google);
  if (googleScriptPromise) return googleScriptPromise;
  googleScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${GOOGLE_SCRIPT_URL}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(window.google), { once: true });
      existing.addEventListener('error', () => reject(new Error('Không thể tải Google Sign-In.')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = GOOGLE_SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(window.google);
    script.onerror = () => reject(new Error('Không thể tải Google Sign-In.'));
    document.head.appendChild(script);
  });
  return googleScriptPromise;
};

export default function GoogleSignInButton({ onCredential, disabled = false }) {
  const container = useRef(null);
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const [error, setError] = useState('');

  useEffect(() => {
    if (!clientId || !container.current) return undefined;
    let active = true;
    loadGoogleScript()
      .then((google) => {
        if (!active || !google?.accounts?.id) throw new Error('Google Sign-In chưa sẵn sàng.');
        google.accounts.id.initialize({
          client_id: clientId,
          callback: ({ credential }) => onCredential(credential),
          auto_select: false,
          cancel_on_tap_outside: true,
        });
        google.accounts.id.renderButton(container.current, {
          type: 'standard', theme: 'outline', size: 'large', text: 'continue_with',
          shape: 'pill', logo_alignment: 'left', width: Math.min(container.current.clientWidth || 400, 400),
        });
      })
      .catch((loadError) => { if (active) setError(loadError.message); });
    return () => { active = false; };
  }, [clientId, onCredential]);

  if (!clientId) return null;
  return <div className={disabled ? 'pointer-events-none opacity-60' : ''}>
    <div ref={container} className="flex min-h-[44px] justify-center" />
    {error && <p className="mt-2 text-center text-xs text-red-300">{error}</p>}
  </div>;
}