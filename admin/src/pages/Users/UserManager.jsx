import React, { useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  KeyRound,
  LockKeyhole,
  RefreshCw,
  Save,
  Search,
  ShieldAlert,
  UserRoundCog,
  WalletCards,
} from 'lucide-react';
import api from '../../services/api';

const formatVnd = (value) =>
  Number(value || 0).toLocaleString('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  });

const formatDate = (value) => {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleString('vi-VN');
};

const emptyProfile = {
  fullName: '',
  email: '',
  phone: '',
  tier: 'standard',
};

const isNotFound = (error) => error?.response?.status === 404;

const backendUpgradeMessage =
  'API quản lý user chưa có trên backend production. Hãy deploy backend mới để dùng đầy đủ thao tác.';

const normalizeUser = (user = {}) => ({
  ...user,
  wallet: user.wallet || {
    id: user.walletId || null,
    balance: Number(user.walletBalance || 0),
    status: user.walletStatus || 'active',
  },
});

const UserManager = () => {
  const [users, setUsers] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState(null);
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState({
    q: '',
    tier: '',
    walletStatus: '',
  });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [profileForm, setProfileForm] = useState(emptyProfile);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busyKey, setBusyKey] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const selectedUser = detail?.user || users.find((item) => item.id === selectedId) || null;
  const walletStatus = selectedUser?.wallet?.status || 'active';

  const summary = useMemo(() => {
    const active = users.filter((item) => item.wallet?.status !== 'locked').length;
    const locked = users.filter((item) => item.wallet?.status === 'locked').length;
    const balance = users.reduce((sum, item) => sum + Number(item.wallet?.balance || 0), 0);
    return { active, locked, balance };
  }, [users]);

  const applyDetailToForm = (user) => {
    setProfileForm({
      fullName: user?.fullName || '',
      email: user?.email || '',
      phone: user?.phone || '',
      tier: user?.tier || 'standard',
    });
  };

  const fetchUsers = async (nextPage = page) => {
    setLoading(true);
    if (!notice) setError('');
    try {
      let data;
      try {
        const response = await api.get('/admin/users', {
          params: {
            page: nextPage,
            limit: 20,
            q: filters.q,
            tier: filters.tier,
            walletStatus: filters.walletStatus,
          },
        });
        data = response.data;
      } catch (primaryError) {
        if (!isNotFound(primaryError)) throw primaryError;

        const response = await api.get('/admin/wallet/users', {
          params: {
            page: nextPage,
            limit: 20,
            q: filters.q,
          },
        });
        data = response.data;
        setNotice((prev) => prev || backendUpgradeMessage);
      }

      let items = Array.isArray(data?.items) ? data.items.map(normalizeUser) : [];
      if (filters.tier) {
        items = items.filter((item) => item.tier === filters.tier);
      }
      if (filters.walletStatus) {
        items = items.filter((item) => item.wallet?.status === filters.walletStatus);
      }
      setUsers(items);
      setTotal(Number(data?.total || 0));
      setTotalPages(Number(data?.totalPages || 1));

      if (!selectedId && items[0]?.id) {
        setSelectedId(items[0].id);
      }
    } catch (err) {
      setError(err?.response?.data?.message || 'Không thể tải danh sách người dùng.');
    } finally {
      setLoading(false);
    }
  };

  const fetchDetail = async (id) => {
    if (!id) {
      setDetail(null);
      setProfileForm(emptyProfile);
      return;
    }

    setDetailLoading(true);
    if (!notice) setError('');
    try {
      const { data } = await api.get(`/admin/users/${id}`);
      const normalized = {
        ...data,
        user: normalizeUser(data?.user),
      };
      setDetail(normalized);
      applyDetailToForm(normalized.user);
    } catch (err) {
      if (isNotFound(err)) {
        const fallbackUser = users.find((item) => item.id === id);
        if (fallbackUser) {
          const normalized = normalizeUser(fallbackUser);
          setDetail({
            user: normalized,
            orders: [],
            topups: [],
            ledger: [],
          });
          applyDetailToForm(normalized);
          setNotice((prev) => prev || backendUpgradeMessage);
          return;
        }
      }
      setError(err?.response?.data?.message || 'Không thể tải chi tiết người dùng.');
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers(page);
  }, [filters, page]);

  useEffect(() => {
    fetchDetail(selectedId);
  }, [selectedId]);

  const handleSearch = (event) => {
    event.preventDefault();
    setPage(1);
    setFilters((prev) => ({ ...prev, q: query.trim() }));
  };

  const refreshAll = async () => {
    await fetchUsers(page);
    if (selectedId) await fetchDetail(selectedId);
  };

  const patchSelectedInList = (nextUser) => {
    setUsers((prev) => prev.map((item) => (item.id === nextUser.id ? nextUser : item)));
    setDetail((prev) => (prev ? { ...prev, user: nextUser } : prev));
    applyDetailToForm(nextUser);
  };

  const handleProfileSave = async (event) => {
    event.preventDefault();
    if (!selectedId) return;

    setBusyKey('profile');
    setNotice('');
    setError('');
    try {
      const { data } = await api.put(`/admin/users/${selectedId}/profile`, profileForm);
      patchSelectedInList(normalizeUser(data));
      setNotice('Đã cập nhật hồ sơ người dùng.');
    } catch (err) {
      setError(isNotFound(err) ? backendUpgradeMessage : (err?.response?.data?.message || 'Không thể cập nhật hồ sơ.'));
    } finally {
      setBusyKey('');
    }
  };

  const handleWalletStatus = async (status) => {
    if (!selectedId) return;

    setBusyKey('wallet');
    setNotice('');
    setError('');
    try {
      const { data } = await api.patch(`/admin/users/${selectedId}/wallet-status`, { status });
      patchSelectedInList(normalizeUser(data));
      setNotice(status === 'locked' ? 'Đã khóa ví người dùng.' : 'Đã mở lại ví người dùng.');
    } catch (err) {
      setError(isNotFound(err) ? backendUpgradeMessage : (err?.response?.data?.message || 'Không thể cập nhật trạng thái ví.'));
    } finally {
      setBusyKey('');
    }
  };

  const handlePasswordReset = async (event) => {
    event.preventDefault();
    if (!selectedId) return;

    setBusyKey('password');
    setNotice('');
    setError('');
    try {
      await api.post(`/admin/users/${selectedId}/password`, { password });
      setPassword('');
      setNotice('Đã đặt lại mật khẩu người dùng.');
    } catch (err) {
      setError(isNotFound(err) ? backendUpgradeMessage : (err?.response?.data?.message || 'Không thể đặt lại mật khẩu.'));
    } finally {
      setBusyKey('');
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-white/35">Admin</p>
          <h1 className="mt-2 bg-gradient-to-r from-primary to-secondary bg-clip-text font-display text-3xl font-bold uppercase tracking-wider text-transparent">
            Quản lý người dùng
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-white/45">
            Theo dõi hồ sơ member, số dư ví, giao dịch gần đây và xử lý các thao tác hỗ trợ tài khoản.
          </p>
        </div>

        <button
          type="button"
          onClick={refreshAll}
          disabled={loading || detailLoading}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white/80 transition hover:bg-white/10 disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${loading || detailLoading ? 'animate-spin' : ''}`} />
          Làm mới
        </button>
      </div>

      {(notice || error) && (
        <div className="space-y-2">
          {notice && (
            <div className="rounded-xl border border-green-500/20 bg-green-500/10 p-4 text-sm font-medium text-green-300">
              {notice}
            </div>
          )}
          {error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm font-medium text-red-300">
              {error}
            </div>
          )}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="glass rounded-[22px] border border-white/10 p-5">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-white/35">Tổng user</p>
          <p className="mt-3 text-3xl font-black">{total}</p>
        </div>
        <div className="glass rounded-[22px] border border-white/10 p-5">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-white/35">Ví đang hoạt động</p>
          <p className="mt-3 text-3xl font-black text-green-300">{summary.active}</p>
        </div>
        <div className="glass rounded-[22px] border border-white/10 p-5">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-white/35">Số dư trang này</p>
          <p className="mt-3 text-2xl font-black text-primary">{formatVnd(summary.balance)}</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(520px,1.35fr)]">
        <section className="glass overflow-hidden rounded-[24px] border border-white/10">
          <div className="border-b border-white/10 p-5">
            <form onSubmit={handleSearch} className="flex flex-col gap-3">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Tìm username, email, họ tên"
                  className="w-full rounded-2xl border border-white/10 bg-white/5 py-3 pl-11 pr-4 text-sm outline-none transition focus:border-primary"
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                <select
                  value={filters.tier}
                  onChange={(event) => {
                    setPage(1);
                    setFilters((prev) => ({ ...prev, tier: event.target.value }));
                  }}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none transition focus:border-primary"
                >
                  <option value="">Mọi hạng</option>
                  <option value="standard">standard</option>
                  <option value="vip">vip</option>
                  <option value="partner">partner</option>
                </select>
                <select
                  value={filters.walletStatus}
                  onChange={(event) => {
                    setPage(1);
                    setFilters((prev) => ({ ...prev, walletStatus: event.target.value }));
                  }}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none transition focus:border-primary"
                >
                  <option value="">Mọi ví</option>
                  <option value="active">active</option>
                  <option value="locked">locked</option>
                </select>
                <button
                  type="submit"
                  className="rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-white transition hover:bg-primary/90"
                >
                  Tìm
                </button>
              </div>
            </form>
          </div>

          <div className="max-h-[660px] overflow-y-auto">
            {users.map((user) => (
              <button
                key={user.id}
                type="button"
                onClick={() => setSelectedId(user.id)}
                className={`block w-full border-b border-white/5 p-4 text-left transition hover:bg-white/5 ${
                  selectedId === user.id ? 'bg-primary/10' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate font-bold text-white">{user.fullName || user.username}</p>
                    <p className="mt-1 truncate text-xs text-white/45">@{user.username}</p>
                    <p className="mt-2 truncate text-sm text-white/55">{user.email || 'Chưa có email'}</p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${
                      user.wallet?.status === 'locked'
                        ? 'bg-red-500/10 text-red-300'
                        : 'bg-green-500/10 text-green-300'
                    }`}
                  >
                    {user.wallet?.status || 'active'}
                  </span>
                </div>
                <div className="mt-4 flex items-center justify-between gap-3 text-sm">
                  <span className="font-bold text-primary">{formatVnd(user.wallet?.balance)}</span>
                  <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/60">
                    {user.tier || 'standard'}
                  </span>
                </div>
              </button>
            ))}

            {!loading && users.length === 0 && (
              <div className="px-5 py-16 text-center text-sm text-white/40">
                Không có người dùng nào khớp bộ lọc.
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-white/10 p-4">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white/70 disabled:opacity-40"
            >
              Trước
            </button>
            <span className="text-sm text-white/45">
              Trang {page}/{totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white/70 disabled:opacity-40"
            >
              Sau
            </button>
          </div>
        </section>

        <section className="space-y-6">
          {!selectedUser ? (
            <div className="glass rounded-[24px] border border-dashed border-white/10 px-6 py-20 text-center text-white/45">
              Chọn một người dùng để xem chi tiết.
            </div>
          ) : (
            <>
              <div className="glass rounded-[24px] border border-white/10 p-6">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                        <UserRoundCog className="h-6 w-6" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-black">{selectedUser.fullName || selectedUser.username}</h2>
                        <p className="mt-1 text-sm text-white/45">@{selectedUser.username}</p>
                      </div>
                    </div>
                    <p className="mt-4 text-sm text-white/45">Tạo lúc {formatDate(selectedUser.createdAt)}</p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="flex items-center gap-2 text-white/45">
                        <WalletCards className="h-4 w-4" />
                        <span className="text-xs font-bold uppercase tracking-[0.2em]">Số dư</span>
                      </div>
                      <p className="mt-2 text-xl font-black text-primary">{formatVnd(selectedUser.wallet?.balance)}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="flex items-center gap-2 text-white/45">
                        {walletStatus === 'locked' ? <ShieldAlert className="h-4 w-4" /> : <BadgeCheck className="h-4 w-4" />}
                        <span className="text-xs font-bold uppercase tracking-[0.2em]">Ví</span>
                      </div>
                      <p className={walletStatus === 'locked' ? 'mt-2 text-xl font-black text-red-300' : 'mt-2 text-xl font-black text-green-300'}>
                        {walletStatus}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <form onSubmit={handleProfileSave} className="glass rounded-[24px] border border-white/10 p-6">
                  <h3 className="mb-5 flex items-center gap-2 text-lg font-bold">
                    <Save className="h-5 w-5 text-secondary" />
                    Hồ sơ
                  </h3>
                  <div className="space-y-4">
                    <label className="block">
                      <span className="mb-2 block text-xs font-bold uppercase tracking-[0.22em] text-white/35">Họ tên</span>
                      <input
                        value={profileForm.fullName}
                        onChange={(event) => setProfileForm((prev) => ({ ...prev, fullName: event.target.value }))}
                        className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none transition focus:border-primary"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-xs font-bold uppercase tracking-[0.22em] text-white/35">Email</span>
                      <input
                        type="email"
                        value={profileForm.email}
                        onChange={(event) => setProfileForm((prev) => ({ ...prev, email: event.target.value }))}
                        className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none transition focus:border-primary"
                      />
                    </label>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="block">
                        <span className="mb-2 block text-xs font-bold uppercase tracking-[0.22em] text-white/35">SĐT</span>
                        <input
                          value={profileForm.phone}
                          onChange={(event) => setProfileForm((prev) => ({ ...prev, phone: event.target.value }))}
                          className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none transition focus:border-primary"
                        />
                      </label>
                      <label className="block">
                        <span className="mb-2 block text-xs font-bold uppercase tracking-[0.22em] text-white/35">Hạng</span>
                        <select
                          value={profileForm.tier}
                          onChange={(event) => setProfileForm((prev) => ({ ...prev, tier: event.target.value }))}
                          className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none transition focus:border-primary"
                        >
                          <option value="standard">standard</option>
                          <option value="vip">vip</option>
                          <option value="partner">partner</option>
                        </select>
                      </label>
                    </div>
                    <button
                      type="submit"
                      disabled={busyKey === 'profile'}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-white transition hover:bg-primary/90 disabled:opacity-60"
                    >
                      <Save className="h-4 w-4" />
                      {busyKey === 'profile' ? 'Đang lưu...' : 'Lưu hồ sơ'}
                    </button>
                  </div>
                </form>

                <div className="space-y-6">
                  <div className="glass rounded-[24px] border border-white/10 p-6">
                    <h3 className="mb-5 flex items-center gap-2 text-lg font-bold">
                      <LockKeyhole className="h-5 w-5 text-orange-300" />
                      Trạng thái ví
                    </h3>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <button
                        type="button"
                        disabled={busyKey === 'wallet' || walletStatus === 'active'}
                        onClick={() => handleWalletStatus('active')}
                        className="rounded-2xl border border-green-500/20 bg-green-500/10 px-5 py-3 text-sm font-bold text-green-300 transition hover:bg-green-500/15 disabled:opacity-40"
                      >
                        Mở ví
                      </button>
                      <button
                        type="button"
                        disabled={busyKey === 'wallet' || walletStatus === 'locked'}
                        onClick={() => handleWalletStatus('locked')}
                        className="rounded-2xl border border-red-500/20 bg-red-500/10 px-5 py-3 text-sm font-bold text-red-300 transition hover:bg-red-500/15 disabled:opacity-40"
                      >
                        Khóa ví
                      </button>
                    </div>
                  </div>

                  <form onSubmit={handlePasswordReset} className="glass rounded-[24px] border border-white/10 p-6">
                    <h3 className="mb-5 flex items-center gap-2 text-lg font-bold">
                      <KeyRound className="h-5 w-5 text-accent" />
                      Đặt lại mật khẩu
                    </h3>
                    <input
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="Mật khẩu mới tối thiểu 6 ký tự"
                      className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none transition focus:border-primary"
                    />
                    <button
                      type="submit"
                      disabled={busyKey === 'password' || password.length < 6}
                      className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-secondary px-5 py-3 text-sm font-bold text-white transition hover:bg-secondary/90 disabled:opacity-50"
                    >
                      <KeyRound className="h-4 w-4" />
                      {busyKey === 'password' ? 'Đang đặt lại...' : 'Đặt lại mật khẩu'}
                    </button>
                  </form>
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-3">
                <HistoryColumn title="Đơn hàng" items={detail?.orders || []} render={(item) => (
                  <>
                    <p className="font-bold text-white">{formatVnd(item.amount)}</p>
                    <p className="mt-1 font-mono text-xs text-white/45">{item.paymentRef}</p>
                    <p className="mt-2 text-xs text-white/45">{item.status} / {item.fulfillmentStatus}</p>
                  </>
                )} />
                <HistoryColumn title="Topup" items={detail?.topups || []} render={(item) => (
                  <>
                    <p className="font-bold text-white">{formatVnd(item.amount)}</p>
                    <p className="mt-1 font-mono text-xs text-white/45">{item.paymentRef}</p>
                    <p className="mt-2 text-xs text-white/45">{item.status}</p>
                  </>
                )} />
                <HistoryColumn title="Ledger" items={detail?.ledger || []} render={(item) => (
                  <>
                    <p className="font-bold text-white">{item.type} / {item.direction}</p>
                    <p className="mt-1 text-sm font-semibold text-primary">{formatVnd(item.amount)}</p>
                    <p className="mt-2 text-xs text-white/45">
                      {formatVnd(item.balanceBefore)} {'->'} {formatVnd(item.balanceAfter)}
                    </p>
                  </>
                )} />
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
};

const HistoryColumn = ({ title, items, render }) => (
  <div className="glass rounded-[24px] border border-white/10 p-5">
    <div className="mb-4 flex items-center justify-between gap-4">
      <h3 className="text-lg font-bold">{title}</h3>
      <span className="text-xs text-white/40">{items.length}</span>
    </div>
    <div className="max-h-80 space-y-3 overflow-y-auto">
      {items.map((item) => (
        <div key={item.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
          {render(item)}
          <p className="mt-3 text-[11px] text-white/30">{formatDate(item.createdAt)}</p>
        </div>
      ))}
      {items.length === 0 && (
        <div className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-white/40">
          Chưa có dữ liệu.
        </div>
      )}
    </div>
  </div>
);

export default UserManager;
