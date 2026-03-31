import React, { useEffect, useState } from 'react';
import {
  Gift,
  Search,
  RefreshCw,
  Eye,
  EyeOff,
  CheckCircle2,
  Clock3,
  AlertTriangle,
  XCircle,
} from 'lucide-react';
import { io } from 'socket.io-client';
import api from '../../services/api';

const STATUS_OPTIONS = [
  { value: '', label: 'Tất cả' },
  { value: 'pending', label: 'Đang chờ' },
  { value: 'paid', label: 'Đã thanh toán' },
  { value: 'expired', label: 'Hết hạn' },
  { value: 'failed', label: 'Thất bại' },
];

const statusMeta = {
  pending: { label: 'Đang chờ', className: 'text-yellow-300 bg-yellow-500/10 border-yellow-500/20', icon: Clock3 },
  paid: { label: 'Đã thanh toán', className: 'text-green-300 bg-green-500/10 border-green-500/20', icon: CheckCircle2 },
  expired: { label: 'Hết hạn', className: 'text-orange-300 bg-orange-500/10 border-orange-500/20', icon: AlertTriangle },
  failed: { label: 'Thất bại', className: 'text-red-300 bg-red-500/10 border-red-500/20', icon: XCircle },
};

const formatVnd = (amount) =>
  Number(amount || 0).toLocaleString('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  });

const formatDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('vi-VN');
};

const DonateList = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState('');
  const [status, setStatus] = useState('');
  const [queryInput, setQueryInput] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [toggleRefresh, setToggleRefresh] = useState(false);

  const fetchDonations = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/donate/admin/donations', {
        params: {
          page,
          limit,
          status,
          q: query,
        },
      });
      setItems(Array.isArray(data.items) ? data.items : []);
      setTotalPages(Number(data.totalPages || 1));
      setTotal(Number(data.total || 0));
    } catch (error) {
      console.error('Không thể tải danh sách donate:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDonations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, status, query, toggleRefresh]);

  useEffect(() => {
    const apiUrl = api.defaults.baseURL || 'https://api.nguyenquangson.id.vn/api';
    const serverUrl = apiUrl.replace(/\/api\/?$/, '');
    
    const socket = io(serverUrl, {
      reconnectionDelayMax: 10000,
      transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
      socket.emit('join_admin_room');
    });

    socket.on('admin_donate_refresh', () => {
      setToggleRefresh(prev => !prev);
    });

    return () => {
      setTimeout(() => socket.disconnect(), 100);
    };
  }, []);

  const applySearch = (e) => {
    e.preventDefault();
    setPage(1);
    setQuery(queryInput.trim());
  };

  const handleToggleVisibility = async (item) => {
    setUpdatingId(item.id);
    try {
      const nextVisibility = !item.isPublic;
      await api.patch(`/donate/admin/donations/${item.id}/visibility`, { isPublic: nextVisibility });
      setItems((prev) =>
        prev.map((row) => (row.id === item.id ? { ...row, isPublic: nextVisibility } : row))
      );
    } catch (error) {
      console.error('Không thể cập nhật trạng thái hiển thị donate:', error);
      alert(error?.response?.data?.message || 'Không thể cập nhật trạng thái hiển thị.');
    } finally {
      setUpdatingId('');
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
            <Gift className="text-primary" /> Donate
          </h1>
          <p className="text-white/40">
            Theo dõi giao dịch ủng hộ và bật/tắt hiển thị công khai trên website.
          </p>
        </div>
        <button
          onClick={fetchDonations}
          className="px-5 py-3 bg-white/5 border border-white/10 rounded-2xl text-sm font-bold flex items-center gap-2 hover:bg-white/10 transition-all"
        >
          <RefreshCw className="w-4 h-4" />
          Làm mới
        </button>
      </div>

      <div className="glass rounded-[32px] overflow-hidden">
        <div className="p-6 border-b border-white/5 bg-white/5 space-y-4">
          <form onSubmit={applySearch} className="grid grid-cols-1 md:grid-cols-[1fr_220px_auto] gap-3">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
              <input
                type="text"
                value={queryInput}
                onChange={(e) => setQueryInput(e.target.value)}
                placeholder="Tìm theo tên người donate hoặc mã đơn..."
                className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-12 pr-4 text-sm focus:outline-none focus:border-primary"
              />
            </div>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              className="admin-select"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value || 'all'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="px-4 py-2.5 bg-primary rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors"
            >
              Lọc
            </button>
          </form>
          <p className="text-xs text-white/40">Tổng bản ghi: {total.toLocaleString('vi-VN')}</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/5 text-[10px] uppercase tracking-widest text-white/40 font-bold border-b border-white/5">
                <th className="px-6 py-4">Mã đơn</th>
                <th className="px-6 py-4">Người donate</th>
                <th className="px-6 py-4">Số tiền</th>
                <th className="px-6 py-4">Trạng thái</th>
                <th className="px-6 py-4">Thanh toán lúc</th>
                <th className="px-6 py-4 text-right">Hiển thị public</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-6 py-16 text-center text-white/30">
                    Đang tải dữ liệu donate...
                  </td>
                </tr>
              ) : items.length > 0 ? (
                items.map((item) => {
                  const meta = statusMeta[item.status] || statusMeta.pending;
                  const Icon = meta.icon;
                  return (
                    <tr key={item.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-4 text-xs text-white/70 font-mono">{item.orderCode}</td>
                      <td className="px-6 py-4 text-sm font-semibold">{item.donorName}</td>
                      <td className="px-6 py-4 text-sm font-bold text-green-300">{formatVnd(item.amount)}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-bold ${meta.className}`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-white/60">{formatDateTime(item.paidAt)}</td>
                      <td className="px-6 py-4 text-right">
                        <button
                          disabled={updatingId === item.id}
                          onClick={() => handleToggleVisibility(item)}
                          className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold transition-all ${
                            item.isPublic
                              ? 'text-green-300 border-green-500/30 bg-green-500/10 hover:bg-green-500/15'
                              : 'text-white/60 border-white/15 bg-white/5 hover:bg-white/10'
                          }`}
                        >
                          {item.isPublic ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                          {item.isPublic ? 'Đang hiển thị' : 'Đang ẩn'}
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="6" className="px-6 py-16 text-center text-white/30">
                    Không có bản ghi donate nào.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="px-6 py-4 border-t border-white/5 bg-white/[0.02] flex items-center justify-between">
          <span className="text-xs text-white/50">
            Trang {page}/{totalPages}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 rounded-lg border border-white/10 text-xs disabled:opacity-40"
            >
              Trước
            </button>
            <button
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1.5 rounded-lg border border-white/10 text-xs disabled:opacity-40"
            >
              Sau
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DonateList;
