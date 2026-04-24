import React, { useEffect, useState } from 'react';
import { RefreshCw, Search } from 'lucide-react';
import api from '../../../services/api';

const formatVnd = (value) =>
  Number(value || 0).toLocaleString('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  });

const panelClass = 'overflow-hidden rounded-2xl border border-white/10 bg-white/5';

const TabWallet = ({ setError, refreshKey }) => {
  const [users, setUsers] = useState([]);
  const [topups, setTopups] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [topupStatus, setTopupStatus] = useState('');
  const [ledgerType, setLedgerType] = useState('');
  const [totals, setTotals] = useState({
    users: 0,
    topups: 0,
    ledger: 0,
  });

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [usersRes, topupsRes, ledgerRes] = await Promise.all([
        api.get('/admin/wallet/users', {
          params: { q: query, limit: 50 },
        }),
        api.get('/admin/wallet/topups', {
          params: { status: topupStatus, limit: 50 },
        }),
        api.get('/admin/wallet/ledger', {
          params: { type: ledgerType, limit: 50 },
        }),
      ]);

      setUsers(Array.isArray(usersRes.data?.items) ? usersRes.data.items : []);
      setTopups(Array.isArray(topupsRes.data?.items) ? topupsRes.data.items : []);
      setLedger(Array.isArray(ledgerRes.data?.items) ? ledgerRes.data.items : []);
      setTotals({
        users: Number(usersRes.data?.total || 0),
        topups: Number(topupsRes.data?.total || 0),
        ledger: Number(ledgerRes.data?.total || 0),
      });
    } catch (err) {
      setError(err?.response?.data?.message || 'Không thể tải dữ liệu quỹ nội bộ.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, [refreshKey, query, topupStatus, ledgerType]);

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <div className="glass rounded-[24px] p-6 space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-xl font-bold">Quỹ nội bộ / Member benefits</h2>
            <p className="mt-2 max-w-3xl text-sm text-white/45">
              Giao diện vận hành cơ bản cho member, topup và ledger. V1 hiện hỗ trợ quan sát, tìm
              kiếm và lọc nhanh; các thao tác adjust/manual review sẽ làm ở phase sau.
            </p>
          </div>
          <button
            type="button"
            onClick={fetchAll}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold text-white/80 hover:bg-white/10 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Làm mới
          </button>
        </div>

        <div className="grid gap-3 xl:grid-cols-3">
          <label className="block">
            <span className="mb-2 block text-xs font-bold uppercase tracking-[0.24em] text-white/40">
              Tìm member
            </span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="username, email, họ tên"
                className="w-full rounded-2xl border border-white/10 bg-white/5 py-3 pl-10 pr-4 text-sm outline-none transition focus:border-primary"
              />
            </div>
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-bold uppercase tracking-[0.24em] text-white/40">
              Lọc topup
            </span>
            <select
              value={topupStatus}
              onChange={(event) => setTopupStatus(event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none transition focus:border-primary"
            >
              <option value="">Tất cả trạng thái</option>
              <option value="pending">pending</option>
              <option value="paid">paid</option>
              <option value="expired">expired</option>
              <option value="failed">failed</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-bold uppercase tracking-[0.24em] text-white/40">
              Lọc ledger
            </span>
            <select
              value={ledgerType}
              onChange={(event) => setLedgerType(event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none transition focus:border-primary"
            >
              <option value="">Tất cả loại</option>
              <option value="topup">topup</option>
              <option value="purchase">purchase</option>
              <option value="adjustment">adjustment</option>
            </select>
          </label>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <section className="glass rounded-[24px] p-5 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-lg font-bold">Members</h3>
            <span className="text-xs text-white/40">
              {users.length}/{totals.users} hiển thị
            </span>
          </div>
          <div className="space-y-3">
            {users.map((item) => (
              <div key={item.id} className={panelClass}>
                <div className="p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-bold text-white">{item.fullName || item.username}</p>
                      <p className="mt-1 text-xs text-white/45">@{item.username}</p>
                    </div>
                    <span className="rounded-full bg-secondary/10 px-3 py-1 text-xs font-bold text-secondary">
                      {item.tier || 'standard'}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-white/60">{item.email || 'Chưa có email'}</p>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <p className="text-sm font-bold text-primary">{formatVnd(item.walletBalance)}</p>
                    <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/65">
                      {item.walletStatus || 'active'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
            {users.length === 0 && (
              <div className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-white/40">
                Chưa có member nào khớp bộ lọc.
              </div>
            )}
          </div>
        </section>

        <section className="glass rounded-[24px] p-5 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-lg font-bold">Topups</h3>
            <span className="text-xs text-white/40">
              {topups.length}/{totals.topups} hiển thị
            </span>
          </div>
          <div className="space-y-3">
            {topups.map((item) => (
              <div key={item.id} className={panelClass}>
                <div className="p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-bold text-white">{formatVnd(item.amount)}</p>
                      <p className="mt-1 font-mono text-xs text-white/45">{item.paymentRef}</p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold ${
                        item.status === 'paid'
                          ? 'bg-green-500/10 text-green-300'
                          : item.status === 'pending'
                            ? 'bg-orange-500/10 text-orange-300'
                            : 'bg-white/10 text-white/60'
                      }`}
                    >
                      {item.status}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-white/55">{item.username || 'Unknown user'}</p>
                </div>
              </div>
            ))}
            {topups.length === 0 && (
              <div className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-white/40">
                Chưa có lệnh nạp quỹ nào khớp bộ lọc.
              </div>
            )}
          </div>
        </section>

        <section className="glass rounded-[24px] p-5 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-lg font-bold">Ledger</h3>
            <span className="text-xs text-white/40">
              {ledger.length}/{totals.ledger} hiển thị
            </span>
          </div>
          <div className="space-y-3">
            {ledger.map((item) => (
              <div key={item.id} className={panelClass}>
                <div className="p-4">
                  <div className="flex items-center justify-between gap-4">
                    <p className="font-bold uppercase tracking-wide text-white">
                      {item.type} / {item.direction}
                    </p>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold ${
                        item.direction === 'credit'
                          ? 'bg-green-500/10 text-green-300'
                          : 'bg-orange-500/10 text-orange-300'
                      }`}
                    >
                      {item.direction}
                    </span>
                  </div>
                  <p className="mt-3 text-sm font-semibold text-white">{formatVnd(item.amount)}</p>
                  <p className="mt-2 text-xs text-white/45">
                    {formatVnd(item.balanceBefore)} {'->'} {formatVnd(item.balanceAfter)}
                  </p>
                </div>
              </div>
            ))}
            {ledger.length === 0 && (
              <div className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-white/40">
                Chưa có ledger entry nào khớp bộ lọc.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default TabWallet;
