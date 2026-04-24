import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CircleDollarSign,
  CheckCircle2,
  Copy,
  CreditCard,
  LogOut,
  ShieldCheck,
  ShoppingBag,
  UserRoundCog,
  WalletCards,
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const formatVnd = (value) =>
  Number(value || 0).toLocaleString('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  });

const cardClass =
  'glass rounded-[28px] border border-white/10 p-5 md:p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)]';

const Account = () => {
  const { account, refreshAccount, logout, updateAccount } = useAuth();
  const [walletSummary, setWalletSummary] = useState(null);
  const [ledger, setLedger] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [topupAmount, setTopupAmount] = useState('100000');
  const [topupIntent, setTopupIntent] = useState(null);
  const [profileForm, setProfileForm] = useState({
    fullName: '',
    email: '',
    phone: '',
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
  });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyKey, setBusyKey] = useState('');

  const walletBalance = useMemo(
    () => Number(walletSummary?.wallet?.balance ?? account?.wallet?.balance ?? 0),
    [walletSummary, account],
  );
  const topupStatus = topupIntent?.topup?.status || '';

  const loadWalletData = async () => {
    const [walletRes, ledgerRes, purchasesRes] = await Promise.all([
      api.get('/wallet/me'),
      api.get('/wallet/ledger', { params: { limit: 10 } }),
      api.get('/wallet/purchases', { params: { limit: 10, page: 1 } }),
    ]);

    setWalletSummary(walletRes.data);
    setLedger(Array.isArray(ledgerRes.data?.items) ? ledgerRes.data.items : []);
    setPurchases(Array.isArray(purchasesRes.data?.items) ? purchasesRes.data.items : []);
  };

  useEffect(() => {
    if (!account) return;
    setProfileForm({
      fullName: account.fullName || '',
      email: account.email || '',
      phone: account.phone || '',
    });
    loadWalletData().catch((err) => {
      setError(err?.response?.data?.message || 'Không thể tải dữ liệu tài khoản.');
    });
  }, [account?.id]);

  useEffect(() => {
    if (!topupIntent?.topup?.id || topupIntent?.topup?.status !== 'pending') return undefined;

    const timer = window.setInterval(async () => {
      try {
        const { data } = await api.get(`/wallet/topups/${topupIntent.topup.id}/status`);
        setTopupIntent((prev) => (prev ? { ...prev, topup: data } : prev));
        if (data.status === 'paid' || data.status === 'expired' || data.status === 'failed') {
          await refreshAccount();
          await loadWalletData();
          if (data.status === 'paid') {
            setNotice('Nạp quỹ thành công. Số dư của bạn đã được cập nhật.');
          }
          window.clearInterval(timer);
        }
      } catch {
        window.clearInterval(timer);
      }
    }, 5000);

    return () => window.clearInterval(timer);
  }, [topupIntent?.topup?.id, topupIntent?.topup?.status]);

  const handleProfileSave = async (event) => {
    event.preventDefault();
    setBusyKey('profile');
    setError('');
    setNotice('');
    try {
      const { data } = await api.put('/account/me', profileForm);
      updateAccount(data);
      setNotice('Đã cập nhật thông tin tài khoản.');
    } catch (err) {
      setError(err?.response?.data?.message || 'Không thể cập nhật thông tin.');
    } finally {
      setBusyKey('');
    }
  };

  const handlePasswordChange = async (event) => {
    event.preventDefault();
    setBusyKey('password');
    setError('');
    setNotice('');
    try {
      const { data } = await api.put('/account/password', passwordForm);
      setPasswordForm({ currentPassword: '', newPassword: '' });
      setNotice(data?.message || 'Đã đổi mật khẩu.');
    } catch (err) {
      setError(err?.response?.data?.message || 'Không thể đổi mật khẩu.');
    } finally {
      setBusyKey('');
    }
  };

  const handleTopup = async () => {
    setBusyKey('topup');
    setError('');
    setNotice('');
    try {
      const { data } = await api.post('/wallet/topups', { amount: Number(topupAmount || 0) });
      setTopupIntent(data);
      setNotice('Đã tạo lệnh nạp quỹ. Vui lòng chuyển khoản đúng nội dung.');
    } catch (err) {
      setError(err?.response?.data?.message || 'Không thể tạo lệnh nạp quỹ.');
    } finally {
      setBusyKey('');
    }
  };

  const copyText = async (text, successMessage) => {
    try {
      await navigator.clipboard.writeText(String(text || ''));
      setNotice(successMessage);
    } catch {
      setError('Không thể sao chép tự động. Vui lòng sao chép thủ công.');
    }
  };

  return (
    <div className="space-y-8 py-8 md:py-12">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-white/40">Member Area</p>
          <h1 className="mt-3 text-4xl md:text-5xl font-black">Tài khoản và Quỹ nội bộ</h1>
          <p className="mt-3 max-w-3xl text-white/60">
            Bạn vẫn có thể mua guest, nhưng tài khoản giúp bạn nạp quỹ, xem lịch sử giao dịch
            và nhận ưu đãi sau này.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/cua-hang"
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white/80 hover:bg-white/10"
          >
            Về cửa hàng
          </Link>
          <button
            type="button"
            onClick={logout}
            className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-300 hover:bg-red-500/15"
          >
            <span className="inline-flex items-center gap-2">
              <LogOut className="h-4 w-4" />
              Đăng xuất
            </span>
          </button>
        </div>
      </div>

      {(error || notice) && (
        <div className="space-y-2">
          {notice && (
            <div className="rounded-2xl border border-green-500/20 bg-green-500/10 px-4 py-3 text-sm text-green-300">
              {notice}
            </div>
          )}
          {error && (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr_0.8fr]">
        <div className={cardClass}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-white/45">
                Số dư hiện tại
              </p>
              <p className="mt-4 text-4xl md:text-5xl font-black text-gradient">
                {formatVnd(walletBalance)}
              </p>
              <p className="mt-4 max-w-md text-sm text-white/55">
                Quỹ nội bộ chỉ dùng để mua trong hệ thống, không hỗ trợ rút tiền mặt.
              </p>
            </div>
            <div className="rounded-3xl border border-primary/20 bg-primary/10 p-4 text-primary">
              <WalletCards className="h-8 w-8" />
            </div>
          </div>
        </div>

        <div className={cardClass}>
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-secondary/20 bg-secondary/10 p-3 text-secondary">
              <CircleDollarSign className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-white/40">Tier</p>
              <p className="mt-1 text-xl font-bold capitalize">{account?.tier || 'standard'}</p>
            </div>
          </div>
          <p className="mt-4 text-sm text-white/55">
            Mức ưu đãi sẽ được mở rộng ở phase tiếp theo. Nền tảng này đã sẵn cho lane member benefits.
          </p>
        </div>

        <div className={cardClass}>
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-white/80">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-white/40">Lịch sử mua</p>
              <p className="mt-1 text-xl font-bold">{purchases.length} giao dịch gần đây</p>
            </div>
          </div>
          <p className="mt-4 text-sm text-white/55">
            Những đơn mua bằng quỹ sẽ được lưu tại đây để bạn theo dõi lại bất kỳ lúc nào.
          </p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <section className={cardClass}>
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-primary/20 bg-primary/10 p-3 text-primary">
                <WalletCards className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Nạp quỹ</h2>
                <p className="text-sm text-white/55">Tạo lệnh topup bằng QR và đợi webhook xác nhận.</p>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-4 md:flex-row">
              <input
                type="number"
                min="10000"
                step="1000"
                value={topupAmount}
                onChange={(e) => setTopupAmount(e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none transition focus:border-primary"
                placeholder="Số tiền nạp"
              />
              <button
                type="button"
                onClick={handleTopup}
                disabled={busyKey === 'topup'}
                className="rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-white transition hover:bg-primary/90 disabled:opacity-60"
              >
                {busyKey === 'topup' ? 'Đang tạo...' : 'Tạo lệnh nạp'}
              </button>
            </div>

            {topupIntent?.topup && (
              <div className="mt-6 space-y-4">
                {topupStatus === 'pending' ? (
                  <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
                    <div className="rounded-3xl border border-white/10 bg-white p-3">
                      <img src={topupIntent.qrImageUrl} alt="QR topup" className="w-full rounded-2xl" />
                    </div>
                    <div className="space-y-3">
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <p className="text-xs uppercase tracking-[0.24em] text-white/40">Trạng thái</p>
                        <p className="mt-2 text-lg font-bold capitalize">{topupIntent.topup.status}</p>
                        <p className="mt-2 text-sm text-white/55">
                          Số tiền:{' '}
                          <span className="font-bold text-white">{formatVnd(topupIntent.topup.amount)}</span>
                        </p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <p className="text-xs uppercase tracking-[0.24em] text-white/40">Nội dung chuyển khoản</p>
                        <div className="mt-2 flex items-center justify-between gap-3">
                          <span className="font-mono text-sm text-white">{topupIntent.transferContent}</span>
                          <button
                            type="button"
                            onClick={() => copyText(topupIntent.transferContent, 'Đã sao chép mã nạp quỹ.')}
                            className="rounded-xl border border-white/10 bg-white/5 p-2 text-white/75 hover:bg-white/10"
                          >
                            <Copy className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      <div className="rounded-2xl border border-orange-500/20 bg-orange-500/10 p-4 text-sm text-orange-200">
                        Chỉ chuyển đúng một lần cho mỗi mã nạp quỹ. Nếu bạn chuyển lặp lại cùng mã này,
                        hệ thống sẽ không tự cộng dư thêm lần nữa.
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    className={`rounded-3xl border p-5 ${
                      topupStatus === 'paid'
                        ? 'border-green-500/20 bg-green-500/10'
                        : topupStatus === 'expired'
                          ? 'border-orange-500/20 bg-orange-500/10'
                          : 'border-red-500/20 bg-red-500/10'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.24em] text-white/45">Lệnh nạp gần nhất</p>
                        <div className="mt-3 flex items-center gap-3">
                          {topupStatus === 'paid' && <CheckCircle2 className="h-6 w-6 text-green-300" />}
                          <p className="text-xl font-bold capitalize text-white">{topupStatus}</p>
                        </div>
                        <p className="mt-3 text-sm text-white/70">
                          Số tiền:{' '}
                          <span className="font-bold text-white">{formatVnd(topupIntent.topup.amount)}</span>
                        </p>
                        <p className="mt-2 text-sm text-white/60">
                          Mã nạp: <span className="font-mono text-white">{topupIntent.transferContent}</span>
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setTopupIntent(null)}
                        className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white/80 hover:bg-white/10"
                      >
                        Ẩn lệnh này
                      </button>
                    </div>

                    <div className="mt-4 rounded-2xl border border-white/10 bg-black/10 p-4 text-sm text-white/70">
                      {topupStatus === 'paid'
                        ? 'Nạp quỹ đã thành công và số dư đã được cập nhật. Nếu người dùng chuyển thêm lần nữa vào cùng mã này, hệ thống sẽ không cộng lặp tự động.'
                        : topupStatus === 'expired'
                          ? 'Lệnh nạp đã hết hạn. Bạn nên tạo một mã nạp mới trước khi chuyển khoản.'
                          : 'Lệnh nạp này không còn hợp lệ. Hãy tạo lại lệnh mới để tiếp tục.'}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          <section className={cardClass}>
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-white/80">
                <CreditCard className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Lịch sử sổ cái</h2>
                <p className="text-sm text-white/55">Mọi biến động số dư đều phải đi qua ledger.</p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {ledger.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-bold uppercase tracking-wide text-white">
                        {entry.type} / {entry.direction}
                      </p>
                      <p className="mt-1 text-xs text-white/45">{new Date(entry.createdAt).toLocaleString('vi-VN')}</p>
                    </div>
                    <div
                      className={`rounded-full px-3 py-1 text-xs font-bold ${
                        entry.direction === 'credit'
                          ? 'bg-green-500/10 text-green-300'
                          : 'bg-orange-500/10 text-orange-300'
                      }`}
                    >
                      {entry.direction === 'credit' ? '+' : '-'} {formatVnd(entry.amount)}
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-white/55">
                    Số dư: {formatVnd(entry.balanceBefore)} {' -> '} {formatVnd(entry.balanceAfter)}
                  </p>
                </div>
              ))}
              {ledger.length === 0 && (
                <div className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-white/45">
                  Chưa có biến động số dư nào.
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className={cardClass}>
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-secondary/20 bg-secondary/10 p-3 text-secondary">
                <UserRoundCog className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Hồ sơ tài khoản</h2>
                <p className="text-sm text-white/55">Cập nhật thông tin để nhận hàng và ưu đãi.</p>
              </div>
            </div>

            <form onSubmit={handleProfileSave} className="mt-5 space-y-4">
              <input
                value={profileForm.fullName}
                onChange={(e) => setProfileForm((prev) => ({ ...prev, fullName: e.target.value }))}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none transition focus:border-primary"
                placeholder="Họ tên"
              />
              <input
                value={profileForm.email}
                onChange={(e) => setProfileForm((prev) => ({ ...prev, email: e.target.value }))}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none transition focus:border-primary"
                placeholder="Email"
                type="email"
              />
              <input
                value={profileForm.phone}
                onChange={(e) => setProfileForm((prev) => ({ ...prev, phone: e.target.value }))}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none transition focus:border-primary"
                placeholder="Số điện thoại"
              />
              <button
                type="submit"
                disabled={busyKey === 'profile'}
                className="w-full rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-white transition hover:bg-primary/90 disabled:opacity-60"
              >
                {busyKey === 'profile' ? 'Đang lưu...' : 'Lưu thông tin'}
              </button>
            </form>
          </section>

          <section className={cardClass}>
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-white/80">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Đổi mật khẩu</h2>
                <p className="text-sm text-white/55">2FA và session manager sẽ được mở rộng ở phase sau.</p>
              </div>
            </div>

            <form onSubmit={handlePasswordChange} className="mt-5 space-y-4">
              <input
                type="password"
                value={passwordForm.currentPassword}
                onChange={(e) =>
                  setPasswordForm((prev) => ({ ...prev, currentPassword: e.target.value }))
                }
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none transition focus:border-primary"
                placeholder="Mật khẩu hiện tại"
              />
              <input
                type="password"
                value={passwordForm.newPassword}
                onChange={(e) =>
                  setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))
                }
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none transition focus:border-primary"
                placeholder="Mật khẩu mới"
              />
              <button
                type="submit"
                disabled={busyKey === 'password'}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10 disabled:opacity-60"
              >
                {busyKey === 'password' ? 'Đang cập nhật...' : 'Đổi mật khẩu'}
              </button>
            </form>
          </section>

          <section className={cardClass}>
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-white/80">
                <ShoppingBag className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Mua bằng quỹ gần đây</h2>
                <p className="text-sm text-white/55">Những đơn được thanh toán từ số dư nội bộ.</p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {purchases.map((item) => (
                <div key={item.id} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-bold text-white">{item.product?.name || 'Sản phẩm'}</p>
                      <p className="mt-1 text-xs text-white/45">{new Date(item.createdAt).toLocaleString('vi-VN')}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-secondary">{formatVnd(item.amount)}</p>
                      <p className="mt-1 text-xs uppercase tracking-wider text-white/45">{item.status}</p>
                    </div>
                  </div>
                </div>
              ))}
              {purchases.length === 0 && (
                <div className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-white/45">
                  Chưa có đơn hàng nào thanh toán bằng quỹ.
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Account;
