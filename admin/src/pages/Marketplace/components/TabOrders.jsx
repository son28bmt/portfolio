import React, { useState, useEffect, useMemo } from 'react';
import { Trash2 } from 'lucide-react';
import api from '../../../services/api';

const formatVnd = (value) =>
  Number(value || 0).toLocaleString('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  });

const TabOrders = ({ setError, setNotice, refreshKey }) => {
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  
  const [orderForm, setOrderForm] = useState({
    email: '',
    productId: '',
  });

  const [orderFilter, setOrderFilter] = useState({
    status: '',
    email: '',
  });

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchOrders = async () => {
    try {
      const params = { page, limit: 15 };
      if (orderFilter.status) params.status = orderFilter.status;
      if (orderFilter.email) params.email = orderFilter.email;
      const { data } = await api.get('/admin/orders', { params });
      setOrders(Array.isArray(data.items) ? data.items : []);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      setError('Lỗi lấy danh sách Đơn hàng.');
    }
  };

  const fetchProducts = async () => {
    try {
      const { data } = await api.get('/admin/products');
      setProducts(Array.isArray(data) ? data : []);
    } catch (err) {
      setError('Lỗi lấy dữ liệu Sản phẩm.');
    }
  };

  // Lắng nghe thay đổi từ refreshKey (khi socket được kích hoạt ở file mẹ)
  useEffect(() => {
    fetchOrders();
    fetchProducts();
  }, [refreshKey]);

  useEffect(() => {
    fetchOrders();
  }, [page]);

  const productOptions = useMemo(
    () => products.map((item) => ({ id: item.id, name: item.name })),
    [products]
  );

  const createOrder = async (event) => {
    event.preventDefault();
    setError(''); setNotice('');
    try {
      await api.post('/admin/orders', {
        email: orderForm.email.trim(),
        product_id: Number(orderForm.productId),
        status: 'pending',
      });
      setOrderForm({ email: '', productId: '' });
      setNotice('Đã tạo đơn hàng thủ công.');
      await fetchOrders();
    } catch (err) {
      setError(err?.response?.data?.message || 'Không thể tạo đơn hàng.');
    }
  };

  const updateOrderStatus = async (item, status) => {
    setError(''); setNotice('');
    try {
      await api.put(`/admin/orders/${item.id}`, { status });
      setNotice(`Đã cập nhật trạng thái đơn hàng #${item.id}.`);
      await fetchOrders();
    } catch (err) {
      setError(err?.response?.data?.message || 'Không thể cập nhật trạng thái đơn.');
    }
  };

  const deleteOrder = async (order) => {
    if (!window.confirm(`Xóa vĩnh viễn đơn hàng #${order.id}?`)) return;
    setError(''); setNotice('');
    try {
      await api.delete(`/admin/orders/${order.id}`);
      setNotice('Đã xóa đơn hàng.');
      await fetchOrders();
    } catch (err) {
      setError(err?.response?.data?.message || 'Không thể xóa đơn hàng.');
    }
  };

  return (
    <div className="glass rounded-[24px] p-6 space-y-5 animate-in fade-in zoom-in-95 duration-300">
      <h2 className="text-xl font-bold">Quản lý Đơn hàng</h2>

      <form onSubmit={createOrder} className="grid grid-cols-1 md:grid-cols-3 gap-3 border border-white/5 bg-white-[0.02] p-4 rounded-2xl">
        <input
          type="email"
          value={orderForm.email}
          onChange={(e) => setOrderForm((prev) => ({ ...prev, email: e.target.value }))}
          placeholder="Email khách hàng"
          className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-primary transition-colors"
          required
        />
        <select
          value={orderForm.productId}
          onChange={(e) => setOrderForm((prev) => ({ ...prev, productId: e.target.value }))}
          className="px-4 py-3 rounded-xl bg-slate-800 border border-white/10 text-sm text-white focus:outline-none focus:border-primary transition-colors cursor-pointer"
          required
        >
          <option value="">-- Chọn sản phẩm nạp --</option>
          {productOptions.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        <button type="submit" className="px-5 py-3 rounded-xl bg-primary text-white font-bold hover:scale-[1.01] active:scale-[0.99] transition-transform shadow-lg glow">
          Tạo đơn thủ công
        </button>
      </form>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_180px_auto] gap-3 pt-2">
        <input
          value={orderFilter.email}
          onChange={(e) => setOrderFilter((prev) => ({ ...prev, email: e.target.value }))}
          placeholder="Lọc chuẩn xác bằng Email"
          className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-primary transition-colors"
        />
        <select
          value={orderFilter.status}
          onChange={(e) => setOrderFilter((prev) => ({ ...prev, status: e.target.value }))}
          className="px-4 py-3 rounded-xl bg-slate-800 border border-white/10 text-sm text-white focus:outline-none transition-colors cursor-pointer"
        >
          <option value="">Tất cả trạng thái</option>
          <option value="pending">Chờ Thanh toán (pending)</option>
          <option value="paid">Đã thanh toán (paid)</option>
          <option value="failed">Lấy key thất bại (failed)</option>
        </select>
        <button 
          onClick={fetchOrders} 
          className="px-5 py-3 rounded-xl bg-secondary text-white border border-white/10 hover:bg-secondary/80 text-sm font-bold shadow-md transition-colors"
        >
          Tiến hành Lọc
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/5">
        <table className="w-full text-sm text-left">
          <thead className="bg-white/5 border-b border-white/10 text-xs uppercase text-white/60">
            <tr>
              <th className="px-4 py-3 font-semibold">Mã Đơn (ID)</th>
              <th className="px-4 py-3 font-semibold">Tài khoản Email</th>
              <th className="px-4 py-3 font-semibold">Tên Sản phẩm</th>
              <th className="px-4 py-3 font-semibold">Tiền thu</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Mã chuyển khoản</th>
              <th className="px-4 py-3 font-semibold text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {orders.map((item) => (
              <tr key={item.id} className="hover:bg-white/5 transition-colors">
                <td className="px-4 py-3 font-bold text-white">#{item.id}</td>
                <td className="px-4 py-3 text-white/90">{item.email}</td>
                <td className="px-4 py-3 text-primary font-medium">{item.product?.name || '-'}</td>
                <td className="px-4 py-3 text-emerald-400 font-bold">{formatVnd(item.amount)}</td>
                <td className="px-4 py-3">
                  <select
                    value={item.status}
                    onChange={(e) => updateOrderStatus(item, e.target.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${
                      item.status === 'paid' ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400' :
                      item.status === 'pending' ? 'border-orange-500/20 bg-orange-500/10 text-orange-400' :
                      'border-red-500/20 bg-red-500/10 text-red-400'
                    } cursor-pointer`}
                  >
                    <option value="pending">pending</option>
                    <option value="paid">paid</option>
                    <option value="failed">failed</option>
                  </select>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-white/50">{item.payment_ref}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <button 
                      onClick={() => deleteOrder(item)} 
                      className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500 hover:text-white transition-all shadow-sm"
                      title="Xóa đơn hàng"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan="7" className="px-4 py-8 text-center text-white/40">
                  Chưa có đơn hàng nào trên hệ thống.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-4 border-t border-white/10">
          <button 
            disabled={page === 1} 
            onClick={() => setPage(page - 1)} 
            className="px-4 py-2 bg-white/5 rounded-xl border border-white/10 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-sm font-bold"
          >
            ← Trước
          </button>
          <span className="px-4 py-2 text-sm font-bold bg-white/5 rounded-xl border border-white/10">
            Trang {page} / {totalPages}
          </span>
          <button 
            disabled={page >= totalPages} 
            onClick={() => setPage(page + 1)} 
            className="px-4 py-2 bg-white/5 rounded-xl border border-white/10 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-sm font-bold"
          >
            Sau →
          </button>
        </div>
      )}
    </div>
  );
};

export default TabOrders;
