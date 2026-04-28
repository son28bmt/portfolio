import React, { useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Turnstile } from '@marsidev/react-turnstile';
import { AtSign, BadgePlus, LockKeyhole, UserRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const isLocalhost = () =>
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

const Register = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const turnstileRef = useRef();
  const { register, isAuthenticated } = useAuth();
  const [form, setForm] = useState({
    username: '',
    fullName: '',
    email: location.state?.email || '',
    password: '',
    website: '',
  });
  const [turnstileToken, setTurnstileToken] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) {
    return <Navigate to="/tai-khoan" replace />;
  }

  const updateField = (key) => (event) => {
    setForm((prev) => ({ ...prev, [key]: event.target.value }));
  };

  const resetTurnstile = () => {
    setTurnstileToken(null);
    turnstileRef.current?.reset?.();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!turnstileToken && !isLocalhost()) {
      setError('Hệ thống đang kiểm tra chống bot. Vui lòng thử lại sau vài giây.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await register({
        ...form,
        turnstileToken,
      });
      navigate('/tai-khoan', { replace: true });
    } catch (err) {
      setError(err?.response?.data?.message || 'Không thể tạo tài khoản lúc này.');
      resetTurnstile();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl py-12 md:py-20">
      <div className="glass overflow-hidden rounded-[32px] border border-white/10 shadow-2xl">
        <div className="bg-gradient-to-r from-secondary/20 to-primary/20 px-6 py-8 md:px-10">
          <p className="text-xs uppercase tracking-[0.3em] text-white/50">Member Benefits</p>
          <h1 className="mt-3 text-3xl font-black md:text-4xl">Tạo tài khoản ưu đãi</h1>
          <p className="mt-3 max-w-xl text-sm text-white/65 md:text-base">
            Tài khoản giúp bạn nạp quỹ, mua bằng số dư, xem lịch sử giao dịch và nhận ưu đãi về sau.
          </p>
        </div>

        <div className="space-y-5 px-6 py-8 md:px-10 md:py-10">
          {error && (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-white/70">Username</span>
              <div className="relative">
                <BadgePlus className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                <input
                  value={form.username}
                  onChange={updateField('username')}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 py-3 pl-11 pr-4 text-sm outline-none transition focus:border-primary"
                  placeholder="username"
                  autoComplete="username"
                  required
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-white/70">Họ tên</span>
              <div className="relative">
                <UserRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                <input
                  value={form.fullName}
                  onChange={updateField('fullName')}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 py-3 pl-11 pr-4 text-sm outline-none transition focus:border-primary"
                  placeholder="Tên hiển thị"
                  autoComplete="name"
                  required
                />
              </div>
            </label>

            <label className="block md:col-span-2">
              <span className="mb-2 block text-sm font-semibold text-white/70">Email</span>
              <div className="relative">
                <AtSign className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                <input
                  type="email"
                  value={form.email}
                  onChange={updateField('email')}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 py-3 pl-11 pr-4 text-sm outline-none transition focus:border-primary"
                  placeholder="ban@example.com"
                  autoComplete="email"
                  required
                />
              </div>
            </label>

            <label className="block md:col-span-2">
              <span className="mb-2 block text-sm font-semibold text-white/70">Mật khẩu</span>
              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                <input
                  type="password"
                  value={form.password}
                  onChange={updateField('password')}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 py-3 pl-11 pr-4 text-sm outline-none transition focus:border-primary"
                  placeholder="Tối thiểu 6 ký tự"
                  autoComplete="new-password"
                  required
                />
              </div>
            </label>

            <label className="hidden" aria-hidden="true">
              Company website
              <input
                value={form.website}
                onChange={updateField('website')}
                tabIndex={-1}
                autoComplete="off"
              />
            </label>

            <div className="pointer-events-none absolute h-0 opacity-0">
              <Turnstile
                ref={turnstileRef}
                siteKey={
                  isLocalhost()
                    ? '1x00000000000000000000AA'
                    : import.meta.env.VITE_TURNSTILE_SITE_KEY || '1x00000000000000000000AA'
                }
                onSuccess={(token) => setTurnstileToken(token)}
                onExpire={resetTurnstile}
                onError={resetTurnstile}
                options={{ theme: 'dark', size: 'invisible' }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-primary px-5 py-3.5 text-sm font-bold text-white transition hover:bg-primary/90 disabled:opacity-60 md:col-span-2"
            >
              {loading ? 'Đang tạo tài khoản...' : 'Đăng ký'}
            </button>
          </form>

          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-white/65">
            Đã có tài khoản?{' '}
            <Link
              to="/dang-nhap"
              state={location.state?.fromMarketplace ? { fromMarketplace: true } : undefined}
              className="font-bold text-secondary hover:underline"
            >
              Đăng nhập
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
