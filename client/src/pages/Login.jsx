import React, { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { LockKeyhole, UserRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) {
    return <Navigate to="/tai-khoan" replace />;
  }

  const redirectTo = location.state?.from?.pathname || '/tai-khoan';
  const fromMarketplace = Boolean(location.state?.fromMarketplace);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login({ username, password });
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err?.response?.data?.message || 'Không thể đăng nhập lúc này.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl py-12 md:py-20">
      <div className="glass overflow-hidden rounded-[32px] border border-white/10 shadow-2xl">
        <div className="bg-gradient-to-r from-primary/25 to-secondary/20 px-6 py-8 md:px-10">
          <p className="text-xs uppercase tracking-[0.3em] text-white/50">Member Access</p>
          <h1 className="mt-3 text-3xl font-black md:text-4xl">Đăng nhập để nhận ưu đãi</h1>
          <p className="mt-3 max-w-lg text-sm text-white/65 md:text-base">
            Mua hàng vẫn có thể guest checkout, nhưng đăng nhập sẽ giúp bạn quản lý quỹ nội bộ,
            lịch sử mua và các ưu đãi sau này.
          </p>
        </div>

        <div className="space-y-5 px-6 py-8 md:px-10 md:py-10">
          {fromMarketplace && (
            <div className="rounded-2xl border border-secondary/20 bg-secondary/10 px-4 py-3 text-sm text-secondary">
              Bạn vừa hoàn tất đơn guest checkout. Đăng nhập để tiếp tục dùng quỹ nội bộ và theo dõi
              tài khoản thuận tiện hơn.
            </div>
          )}

          {error && (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-white/70">Username</span>
              <div className="relative">
                <UserRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 py-3 pl-11 pr-4 text-sm outline-none transition focus:border-primary"
                  placeholder="username của bạn"
                  autoComplete="username"
                  required
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-white/70">Mật khẩu</span>
              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 py-3 pl-11 pr-4 text-sm outline-none transition focus:border-primary"
                  placeholder="Nhập mật khẩu"
                  autoComplete="current-password"
                  required
                />
              </div>
            </label>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-primary px-5 py-3.5 text-sm font-bold text-white transition hover:bg-primary/90 disabled:opacity-60"
            >
              {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
            </button>
          </form>

          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-white/65">
            Chưa có tài khoản?{' '}
            <Link
              to="/dang-ky"
              state={fromMarketplace ? { fromMarketplace: true } : undefined}
              className="font-bold text-secondary hover:underline"
            >
              Đăng ký ngay
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
