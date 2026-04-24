import React, { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AtSign, BadgePlus, LockKeyhole, UserRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Register = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { register, isAuthenticated } = useAuth();
  const [form, setForm] = useState({
    username: '',
    fullName: '',
    email: location.state?.email || '',
    password: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) {
    return <Navigate to="/tai-khoan" replace />;
  }

  const updateField = (key) => (event) => {
    setForm((prev) => ({ ...prev, [key]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      await register(form);
      navigate('/tai-khoan', { replace: true });
    } catch (err) {
      setError(err?.response?.data?.message || 'Không thể tạo tài khoản lúc này.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl py-12 md:py-20">
      <div className="glass rounded-[32px] overflow-hidden border border-white/10 shadow-2xl">
        <div className="bg-gradient-to-r from-secondary/20 to-primary/20 px-6 py-8 md:px-10">
          <p className="text-xs uppercase tracking-[0.3em] text-white/50">Member Benefits</p>
          <h1 className="mt-3 text-3xl md:text-4xl font-black">Tạo tài khoản ưu đãi</h1>
          <p className="mt-3 max-w-xl text-sm md:text-base text-white/65">
            Tài khoản giúp bạn nạp quỹ, mua bằng số dư, xem lịch sử giao dịch và nhận ưu đãi về
            sau.
          </p>
        </div>

        <div className="px-6 py-8 md:px-10 md:py-10 space-y-5">
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
                  placeholder="username mới"
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
                  required
                />
              </div>
            </label>

            <button
              type="submit"
              disabled={loading}
              className="md:col-span-2 w-full rounded-2xl bg-primary px-5 py-3.5 text-sm font-bold text-white transition hover:bg-primary/90 disabled:opacity-60"
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
