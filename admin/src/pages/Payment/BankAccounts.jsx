import React, { useEffect, useState } from 'react';
import { Landmark, Plus, Save, Trash2 } from 'lucide-react';
import api from '../../services/api';

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

const BankAccounts = () => {
  const [items, setItems] = useState([emptyAccount()]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const fetchAccounts = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/admin/payment/bank-accounts');
      const accounts = Array.isArray(data?.items) ? data.items : [];
      setItems(accounts.length > 0 ? accounts : [emptyAccount()]);
    } catch (err) {
      setError(err?.response?.data?.message || 'Không thể tải cấu hình ngân hàng.');
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
      const accounts = Array.isArray(data?.items) ? data.items : [];
      setItems(accounts.length > 0 ? accounts : [emptyAccount()]);
      setNotice('Đã lưu danh sách tài khoản ngân hàng.');
    } catch (err) {
      setError(err?.response?.data?.message || 'Không thể lưu cấu hình ngân hàng.');
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
        <button
          type="button"
          onClick={addItem}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white/80 transition hover:bg-white/10"
        >
          <Plus className="h-4 w-4" />
          Thêm tài khoản
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
