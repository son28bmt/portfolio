import React, { useEffect, useState } from 'react';
import { BadgeCheck, Info, Landmark, Plus, RefreshCw, Save, Trash2 } from 'lucide-react';
import api from '../../services/api';

const BACKEND_UPGRADE_MESSAGE =
  'Backend production chưa có API quản lý ngân hàng. Hãy deploy backend mới để lưu cấu hình từ admin.';

const emptyAccount = () => ({
  key: '',
  label: '',
  bankBin: '',
  accountNo: '',
  accountName: '',
});

const normalizeKey = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '');

const normalizeAccount = (account = {}, index = 0) => ({
  key: normalizeKey(account.key || account.id || account.code || `bank_${index + 1}`),
  label: String(account.label || account.title || account.bankName || `Tài khoản #${index + 1}`).trim(),
  bankBin: String(account.bankBin || account.bank_bin || account.bin || '').trim(),
  accountNo: String(account.accountNo || account.account_no || account.number || '').trim(),
  accountName: String(account.accountName || account.account_name || account.name || '').trim(),
});

const readAccounts = (data) => {
  const rawItems = Array.isArray(data?.items)
    ? data.items
    : Array.isArray(data?.paymentAccounts)
      ? data.paymentAccounts
      : Array.isArray(data)
        ? data
        : [];

  return rawItems.map(normalizeAccount).filter((item) => item.bankBin && item.accountNo && item.accountName);
};

const getErrorMessage = (error, fallback) =>
  error?.response?.data?.message || error?.response?.data?.error || error?.message || fallback;

const isNotFound = (error) => error?.response?.status === 404;

const BankAccounts = () => {
  const [items, setItems] = useState([emptyAccount()]);
  const [integratedItems, setIntegratedItems] = useState([]);
  const [adminApiReady, setAdminApiReady] = useState(true);
  const [sourceLabel, setSourceLabel] = useState('');
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const applyAccounts = (accounts, source) => {
    setIntegratedItems(accounts);
    setSourceLabel(source);
    setItems(accounts.length > 0 ? accounts : [emptyAccount()]);
  };

  const fetchAccounts = async () => {
    setLoading(true);
    setNotice('');
    setError('');

    try {
      const { data } = await api.get('/admin/payment/bank-accounts');
      setAdminApiReady(true);
      applyAccounts(readAccounts(data), 'Cấu hình admin');
    } catch (err) {
      if (!isNotFound(err)) {
        setError(getErrorMessage(err, 'Không thể tải cấu hình ngân hàng.'));
        setLoading(false);
        return;
      }

      setAdminApiReady(false);
      try {
        const { data } = await api.get('/payment-accounts');
        const accounts = readAccounts(data);
        applyAccounts(accounts, 'API thanh toán public');
        setNotice(
          accounts.length > 0
            ? 'Đang hiển thị ngân hàng hệ thống đang dùng. Muốn lưu từ admin, cần deploy backend mới.'
            : BACKEND_UPGRADE_MESSAGE,
        );
      } catch (fallbackErr) {
        setIntegratedItems([]);
        setSourceLabel('');
        setError(getErrorMessage(fallbackErr, BACKEND_UPGRADE_MESSAGE));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const updateItem = (index, key, value) => {
    setItems((prev) =>
      prev.map((item, itemIndex) => {
        if (itemIndex !== index) return item;
        const next = { ...item, [key]: value };
        if (key === 'label' && !item.key) {
          next.key = normalizeKey(value);
        }
        if (key === 'key') {
          next.key = normalizeKey(value);
        }
        return next;
      }),
    );
  };

  const addItem = () => {
    setItems((prev) => [...prev, emptyAccount()]);
  };

  const removeItem = (index) => {
    setItems((prev) => {
      const next = prev.filter((_, itemIndex) => itemIndex !== index);
      return next.length > 0 ? next : [emptyAccount()];
    });
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setLoading(true);
    setNotice('');
    setError('');

    const payload = items
      .map((item, index) => ({
        key: normalizeKey(item.key || item.label || `bank_${index + 1}`),
        label: String(item.label || '').trim(),
        bankBin: String(item.bankBin || '').trim(),
        accountNo: String(item.accountNo || '').trim(),
        accountName: String(item.accountName || '').trim(),
      }))
      .filter((item) => item.bankBin && item.accountNo && item.accountName);

    try {
      const { data } = await api.put('/admin/payment/bank-accounts', { items: payload });
      const accounts = readAccounts(data);
      setAdminApiReady(true);
      setIntegratedItems(accounts);
      setSourceLabel('Cấu hình admin');
      setItems(accounts.length > 0 ? accounts : [emptyAccount()]);
      setNotice('Đã lưu danh sách tài khoản ngân hàng.');
    } catch (err) {
      setError(isNotFound(err) ? BACKEND_UPGRADE_MESSAGE : getErrorMessage(err, 'Không thể lưu cấu hình ngân hàng.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-white/35">Thanh toán</p>
          <h1 className="mt-2 bg-gradient-to-r from-primary to-secondary bg-clip-text font-display text-3xl font-bold uppercase tracking-wider text-transparent">
            Tài khoản ngân hàng
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-white/45">
            Thêm tài khoản đã kết nối trong SePay để hệ thống tự hiển thị lựa chọn khi tạo QR thanh toán và nạp quỹ.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={fetchAccounts}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white/80 transition hover:bg-white/10 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Tải lại
          </button>
          <button
            type="button"
            onClick={addItem}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white/80 transition hover:bg-white/10"
          >
            <Plus className="h-4 w-4" />
            Thêm tài khoản
          </button>
        </div>
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

      <section className="glass rounded-[24px] border border-white/10 p-5">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <BadgeCheck className="h-5 w-5 text-green-300" />
              <h2 className="font-bold">Ngân hàng đang tích hợp</h2>
            </div>
            <p className="mt-1 text-sm text-white/40">
              Danh sách này là dữ liệu hệ thống đang dùng để tạo VietQR cho thanh toán và nạp quỹ.
            </p>
          </div>
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-white/55">
            <Info className="h-3.5 w-3.5" />
            {sourceLabel || 'Chưa có nguồn dữ liệu'}
          </div>
        </div>

        {integratedItems.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2">
            {integratedItems.map((item, index) => (
              <article
                key={`${item.key || item.accountNo}-${index}`}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-white">{item.label || `Tài khoản #${index + 1}`}</p>
                    <p className="mt-1 truncate text-xs text-white/40">{item.key || 'default'}</p>
                  </div>
                  <span className="shrink-0 rounded-full border border-green-400/20 bg-green-400/10 px-3 py-1 text-xs font-bold text-green-300">
                    Đang dùng
                  </span>
                </div>
                <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs font-bold uppercase tracking-[0.18em] text-white/30">BIN</dt>
                    <dd className="mt-1 text-white/75">{item.bankBin}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-bold uppercase tracking-[0.18em] text-white/30">Số tài khoản</dt>
                    <dd className="mt-1 text-white/75">{item.accountNo}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-xs font-bold uppercase tracking-[0.18em] text-white/30">Chủ tài khoản</dt>
                    <dd className="mt-1 truncate text-white/75">{item.accountName}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-6 text-sm text-white/45">
            Chưa đọc được ngân hàng đã tích hợp. Nếu backend mới chưa deploy, hệ thống vẫn có thể dùng cấu hình trong env
            nhưng admin chưa xem/lưu được qua API quản lý.
          </div>
        )}
      </section>

      {!adminApiReady && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm font-medium text-amber-200">
          API admin `/admin/payment/bank-accounts` chưa có trên backend đang chạy. Sau khi deploy backend mới, nút lưu cấu
          hình sẽ hoạt động và danh sách trên sẽ lấy trực tiếp từ cấu hình admin.
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-4">
        {items.map((item, index) => (
          <section key={`${item.key || 'bank'}-${index}`} className="glass rounded-[24px] border border-white/10 p-5">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl border border-primary/20 bg-primary/10 p-3 text-primary">
                  <Landmark className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-bold">Tài khoản #{index + 1}</h2>
                  <p className="text-sm text-white/40">Thông tin dùng để tạo ảnh VietQR.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => removeItem(index)}
                className="rounded-xl border border-red-500/20 bg-red-500/10 p-2 text-red-300 hover:bg-red-500/15"
                aria-label="Xóa tài khoản"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-[0.22em] text-white/35">
                  Tên hiển thị
                </span>
                <input
                  value={item.label}
                  onChange={(event) => updateItem(index, 'label', event.target.value)}
                  placeholder="Ví dụ: MB Bank"
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none transition focus:border-primary"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-[0.22em] text-white/35">
                  Key nội bộ
                </span>
                <input
                  value={item.key}
                  onChange={(event) => updateItem(index, 'key', event.target.value)}
                  placeholder="mb, bank_1..."
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none transition focus:border-primary"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-[0.22em] text-white/35">
                  BIN ngân hàng
                </span>
                <input
                  value={item.bankBin}
                  onChange={(event) => updateItem(index, 'bankBin', event.target.value)}
                  placeholder="Ví dụ: 970422"
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none transition focus:border-primary"
                  required={items.length === 1 || Boolean(item.accountNo || item.accountName || item.label)}
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-[0.22em] text-white/35">
                  Số tài khoản
                </span>
                <input
                  value={item.accountNo}
                  onChange={(event) => updateItem(index, 'accountNo', event.target.value)}
                  placeholder="Số tài khoản đã kết nối SePay"
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none transition focus:border-primary"
                  required={items.length === 1 || Boolean(item.bankBin || item.accountName || item.label)}
                />
              </label>

              <label className="block md:col-span-2">
                <span className="mb-2 block text-xs font-bold uppercase tracking-[0.22em] text-white/35">
                  Chủ tài khoản
                </span>
                <input
                  value={item.accountName}
                  onChange={(event) => updateItem(index, 'accountName', event.target.value)}
                  placeholder="NGUYEN QUANG SON"
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm uppercase outline-none transition focus:border-primary"
                  required={items.length === 1 || Boolean(item.bankBin || item.accountNo || item.label)}
                />
              </label>
            </div>
          </section>
        ))}

        <div className="sticky bottom-4 flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-3 text-sm font-bold text-white shadow-2xl transition hover:bg-primary/90 disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            {loading ? 'Đang lưu...' : 'Lưu cấu hình ngân hàng'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default BankAccounts;
