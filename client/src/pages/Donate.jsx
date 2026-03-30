import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Gift, QrCode, Clock3, CheckCircle2, AlertCircle, Copy, RefreshCw } from 'lucide-react';
import api from '../services/api';

const SUGGESTED_AMOUNTS = [20000, 50000, 100000, 200000];

const STATUS_LABELS = {
  pending: 'Đang chờ thanh toán',
  paid: 'Thanh toán thành công',
  expired: 'Đơn đã hết hạn',
  failed: 'Thanh toán thất bại',
};

const statusClass = (status) => {
  if (status === 'paid') return 'text-green-300 bg-green-500/10 border-green-500/20';
  if (status === 'expired') return 'text-orange-300 bg-orange-500/10 border-orange-500/20';
  if (status === 'failed') return 'text-red-300 bg-red-500/10 border-red-500/20';
  return 'text-yellow-300 bg-yellow-500/10 border-yellow-500/20';
};

const formatVnd = (amount) =>
  Number(amount || 0).toLocaleString('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  });

const formatDateTime = (value) => {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('vi-VN');
};

const Donate = () => {
  const [summary, setSummary] = useState({
    totalAmount: 0,
    totalCount: 0,
    latestDonations: [],
  });
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [form, setForm] = useState({
    donorName: '',
    amount: '50000',
  });
  const [intent, setIntent] = useState(null);
  const [creating, setCreating] = useState(false);
  const [polling, setPolling] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  const fetchSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const { data } = await api.get('/donate/public-summary');
      setSummary({
        totalAmount: Number(data?.totalAmount || 0),
        totalCount: Number(data?.totalCount || 0),
        latestDonations: Array.isArray(data?.latestDonations) ? data.latestDonations : [],
      });
    } catch (err) {
      console.error('Không thể tải dữ liệu donate:', err);
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  useEffect(() => {
    if (!intent?.expiresAt || intent?.status !== 'pending') {
      setRemainingSeconds(0);
      return undefined;
    }

    const updateRemaining = () => {
      const now = Date.now();
      const expiredAtMs = new Date(intent.expiresAt).getTime();
      if (Number.isNaN(expiredAtMs)) {
        setRemainingSeconds(0);
        return;
      }
      const diffMs = Math.max(0, expiredAtMs - now);
      setRemainingSeconds(Math.ceil(diffMs / 1000));
    };

    updateRemaining();
    const timer = setInterval(updateRemaining, 1000);
    return () => clearInterval(timer);
  }, [intent?.expiresAt, intent?.status]);

  useEffect(() => {
    if (!intent?.orderCode || intent.status !== 'pending') return undefined;

    setPolling(true);
    let sse;
    
    const baseUrl = api.defaults.baseURL || 'https://api.nguyenquangson.id.vn/api';
    sse = new EventSource(`${baseUrl}/sse/donates/${intent.orderCode}`);

    sse.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.status === 'paid') {
          setIntent((prev) => (prev ? { ...prev, status: 'paid' } : prev));
          setNotice('Đã nhận thanh toán thành công. Cảm ơn bạn đã ủng hộ!');
          setError('');
          setPolling(false);
          fetchSummary();
          sse.close();
        }
      } catch {
        // ignore
      }
    };

    return () => {
      if (sse) sse.close();
      setPolling(false);
    };
  }, [intent?.orderCode, intent?.status, fetchSummary]);

  const createIntent = async () => {
    setCreating(true);
    setError('');
    setNotice('');
    try {
      const cleanDonorName = String(form.donorName || '').trim();
      const cleanAmount = Number(form.amount || 0);

      if (cleanAmount < 100) {
        setError('không đủ mua con tôm rồi bạn ơi. Tối thiểu là 3000 VND để mình có thể mua được gói mì tôm có tôm :D');
        return;
      }

      const payload = {
        donorName: cleanDonorName,
        amount: cleanAmount,
      };
      const { data } = await api.post('/donate/intents', payload);
      setIntent(data);
      setForm((prev) => ({
        ...prev,
        donorName: cleanDonorName,
        amount: String(cleanAmount),
      }));
    } catch (err) {
      console.error('Không thể tạo phiên donate:', err);
      setError(err?.response?.data?.message || 'Không thể tạo mã QR thanh toán.');
    } finally {
      setCreating(false);
    }
  };

  const handleCreateIntent = async (e) => {
    e.preventDefault();
    await createIntent();
  };

  const handleCopy = async (text) => {
    try {
      await navigator.clipboard.writeText(String(text || ''));
      setNotice('Đã copy nội dung chuyển khoản.');
    } catch {
      setError('Không thể copy. Vui lòng sao chép thủ công.');
    }
  };

  const handleStartNew = () => {
    setIntent(null);
    setError('');
    setNotice('');
  };

  const countdownText = useMemo(() => {
    if (!remainingSeconds || remainingSeconds <= 0) return '00:00';
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }, [remainingSeconds]);

  return (
    <div className="py-12 max-w-6xl mx-auto px-4 md:px-0 space-y-10">
      <div className="text-center md:text-left">
        <h1 className="text-3xl md:text-5xl font-bold mb-4 flex items-center justify-center md:justify-start gap-3">
          Nuôi Dev
          <Gift className="text-primary w-8 h-8" />
        </h1>
        <p className="text-white/60 max-w-3xl">
          Tớ là sinh viên năm cuối chưa ra trường, Cảm ơn bạn đã hổ trợ. Mỗi khoản donate gói mì tôm, nhiều hơn là gói mì có tôm giúp mình duy trì qua ngày.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-[32px] p-6 md:p-8 space-y-6"
        >
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl md:text-2xl font-bold">Tổng quan donate</h2>
            <button
              onClick={fetchSummary}
              className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-bold flex items-center gap-2 hover:bg-white/10"
            >
              <RefreshCw className="w-4 h-4" />
              Làm mới
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
              <p className="text-xs uppercase tracking-wider text-white/40 mb-2">Tổng đã nhận</p>
              <p className="text-lg md:text-2xl font-black text-green-300">
                {summaryLoading ? '...' : formatVnd(summary.totalAmount)}
              </p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
              <p className="text-xs uppercase tracking-wider text-white/40 mb-2">Số lượt ủng hộ</p>
              <p className="text-lg md:text-2xl font-black">
                {summaryLoading ? '...' : summary.totalCount.toLocaleString('vi-VN')}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-bold text-white/70 uppercase tracking-wider">Người ủng hộ gần đây</h3>
            <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
              {!summaryLoading && summary.latestDonations.length === 0 ? (
                <div className="text-sm text-white/40 bg-white/5 border border-white/10 rounded-xl p-4">
                  Chưa có giao dịch donate nào.
                </div>
              ) : (
                summary.latestDonations.map((item, index) => (
                  <div
                    key={`${item.donorName}-${item.paidAt}-${index}`}
                    className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center justify-between gap-3"
                  >
                    <div>
                      <p className="font-semibold text-sm">{item.donorName}</p>
                      <p className="text-xs text-white/40">{formatDateTime(item.paidAt)}</p>
                    </div>
                    <p className="font-bold text-green-300 text-sm">{formatVnd(item.amount)}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="glass rounded-[32px] p-6 md:p-8 space-y-6"
        >
          {!intent ? (
            <form onSubmit={handleCreateIntent} className="space-y-5">
              <h2 className="text-xl md:text-2xl font-bold">Tạo mã QR donate</h2>

              <div className="space-y-2">
                <label className="text-xs font-bold text-white/50 uppercase tracking-wider">Tên hiển thị</label>
                <input
                  value={form.donorName}
                  onChange={(e) => setForm((prev) => ({ ...prev, donorName: e.target.value }))}
                  placeholder="Ví dụ: Nguyễn Văn A"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-primary"
                  maxLength={120}
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-white/50 uppercase tracking-wider">Số tiền (VND)</label>
                <input
                  type="number"
                  value={form.amount}
                  onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
                  placeholder="Nhập số tiền bạn muốn ủng hộ"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-primary"
                  min={1000}
                  step={1000}
                  required
                />
                <div className="flex flex-wrap gap-2 pt-1">
                  {SUGGESTED_AMOUNTS.map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, amount: String(value) }))}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                        Number(form.amount || 0) === value
                          ? 'border-primary/50 bg-primary/15 text-primary'
                          : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
                      }`}
                    >
                      {value.toLocaleString('vi-VN')}đ
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-white/40">
                  Bạn có thể nhập số tiền bất kỳ. tôi không chê 
                </p>
              </div>

              <button
                type="submit"
                disabled={creating}
                className="w-full py-3.5 rounded-2xl bg-primary font-bold hover:bg-primary/90 transition-colors disabled:opacity-60"
              >
                {creating ? 'Đang tạo QR...' : 'Tạo mã QR thanh toán'}
              </button>
            </form>
          ) : (
            <div className="space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl md:text-2xl font-bold mb-2">Quét mã để donate</h2>
                  <div className={`inline-flex px-3 py-1 rounded-full border text-xs font-bold ${statusClass(intent.status)}`}>
                    {STATUS_LABELS[intent.status] || intent.status}
                  </div>
                </div>
                <button
                  onClick={handleStartNew}
                  className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-bold hover:bg-white/10"
                >
                  Tạo đơn mới
                </button>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
                <p className="text-sm font-semibold text-white/80">Đổi số tiền nhanh</p>
                <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
                  <input
                    type="number"
                    value={form.amount}
                    onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
                    placeholder="Nhập số tiền mới"
                    min={1000}
                    step={1000}
                    className="bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary"
                  />
                  <button
                    type="button"
                    onClick={createIntent}
                    disabled={creating}
                    className="px-4 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-sm font-bold transition-colors disabled:opacity-60"
                  >
                    {creating ? 'Đang tạo...' : 'Tạo lại QR'}
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTED_AMOUNTS.map((value) => (
                    <button
                      key={`intent-${value}`}
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, amount: String(value) }))}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                        Number(form.amount || 0) === value
                          ? 'border-primary/50 bg-primary/15 text-primary'
                          : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
                      }`}
                    >
                      {value.toLocaleString('vi-VN')}đ
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-4">
                <div className="flex items-center gap-2 text-sm text-white/70">
                  <QrCode className="w-4 h-4" />
                  Mã đơn: <span className="font-mono text-white">{intent.orderCode}</span>
                </div>
                <p className="text-lg font-black text-green-300">{formatVnd(intent.amount)}</p>

                {intent.qrImageUrl ? (
                  <img
                    src={intent.qrImageUrl}
                    alt="QR Donate"
                    className="w-full max-w-[320px] mx-auto rounded-2xl border border-white/10 bg-white p-2"
                  />
                ) : (
                  <div className="text-sm text-red-300">Không tạo được QR. Vui lòng kiểm tra cấu hình ngân hàng trên server.</div>
                )}

                <div className="grid grid-cols-1 gap-3 text-sm">
                  <div className="bg-black/20 border border-white/10 rounded-xl p-3">
                    <p className="text-xs text-white/40 mb-1">Nội dung chuyển khoản</p>
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-mono text-white">{intent.transferContent}</p>
                      <button
                        onClick={() => handleCopy(intent.transferContent)}
                        className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10"
                        title="Copy nội dung"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="bg-black/20 border border-white/10 rounded-xl p-3">
                    <p className="text-xs text-white/40 mb-1">Tài khoản nhận</p>
                    <p className="text-white">{intent.accountName}</p>
                    <p className="text-white/70 font-mono">{intent.accountNo} - {intent.bankBin}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-white/60">
                  <Clock3 className="w-4 h-4" />
                  {intent.status === 'pending'
                    ? `Mã còn hiệu lực: ${countdownText}`
                    : `Trạng thái cập nhật lúc: ${formatDateTime(intent.paidAt || intent.expiresAt)}`}
                </div>
              </div>
            </div>
          )}

          {polling && (
            <div className="text-xs text-primary bg-primary/10 border border-primary/20 rounded-xl p-3">
              Hệ thống đang chờ thanh toán...
            </div>
          )}

          {notice && (
            <div className="text-sm text-green-300 bg-green-500/10 border border-green-500/20 rounded-xl p-3 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              {notice}
            </div>
          )}

          {error && (
            <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}
        </motion.section>
      </div>
    </div>
  );
};

export default Donate;
