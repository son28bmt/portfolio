import React, { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Trash2 } from 'lucide-react';
import api from '../../../services/api';

const formatVnd = (value) =>
  Number(value || 0).toLocaleString('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  });

const statusLabels = {
  pending: 'Chờ thanh toán',
  paid: 'Đã thanh toán',
  failed: 'Thất bại',
};

const fulfillmentLabels = {
  processing: 'Đang xử lý',
  manual_review: 'Cần kiểm tra tay',
  delivered: 'Đã hoàn tất',
  failed: 'Thất bại',
};

const TabOrders = ({ setError, setNotice, refreshKey }) => {
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [refreshingOrderId, setRefreshingOrderId] = useState(null);
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
    } catch {
      setError('Lỗi lấy danh sách đơn hàng.');
    }
  };

  const fetchProducts = async () => {
    try {
      const { data } = await api.get('/admin/products');
      setProducts(Array.isArray(data) ? data : []);
    } catch {
      setError('Lỗi lấy dữ liệu sản phẩm.');
    }
  };

  useEffect(() => {
    fetchOrders();
    fetchProducts();
  }, [refreshKey]);

  useEffect(() => {
    fetchOrders();
  }, [page]);

  const productOptions = useMemo(
    () => products.map((item) => ({ id: item.id, name: item.name })),
    [products],
  );

  const createOrder = async (event) => {
    event.preventDefault();
    setError('');
    setNotice('');

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
    setError('');
    setNotice('');

    try {
      await api.put(`/admin/orders/${item.id}`, { status });
      setNotice(`Đã cập nhật trạng thái đơn hàng #${item.id}.`);
      await fetchOrders();
    } catch (err) {
      setError(err?.response?.data?.message || 'Không thể cập nhật trạng thái đơn.');
    }
  };

  const refreshSupplierOrder = async (item) => {
    setRefreshingOrderId(item.id);
    setError('');
    setNotice('');

    try {
      await api.post(`/admin/orders/${item.id}/refresh-fulfillment`);
      setNotice(`Đã làm mới trạng thái nhà cung cấp cho đơn #${item.id}.`);
      await fetchOrders();
    } catch (err) {
      setError(err?.response?.data?.message || 'Không thể làm mới trạng thái nhà cung cấp.');
    } finally {
      setRefreshingOrderId(null);
    }
  };

  const deleteOrder = async (order) => {
    if (!window.confirm(`Xóa vĩnh viễn đơn hàng #${order.id}?`)) return;
    setError('');
    setNotice('');

    try {
      await api.delete(`/admin/orders/${order.id}`);
      setNotice('Đã xóa đơn hàng.');
      await fetchOrders();
    } catch (err) {
      setError(err?.response?.data?.message || 'Không thể xóa đơn hàng.');
    }
  };

  return (
    <div className="glass animate-in fade-in zoom-in-95 space-y-5 rounded-[24px] p-6 duration-300">
      <div>
        <h2 className="text-xl font-bold">Đơn hàng</h2>
        <p className="mt-2 text-sm text-white/45">
          Theo dõi toàn bộ đơn trong hệ thống, đổi trạng thái thanh toán, làm mới đơn từ nhà cung
          cấp và xóa các đơn không còn cần thiết.
        </p>
      </div>

      <form
        onSubmit={createOrder}
        className="grid grid-cols-1 gap-3 rounded-2xl border border-white/5 bg-white/[0.02] p-4 md:grid-cols-3"
      >
        <input
          type="email"
          value={orderForm.email}
          onChange={(e) => setOrderForm((prev) => ({ ...prev, email: e.target.value }))}
          placeholder="Email khách hàng"
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm transition-colors focus:border-primary focus:outline-none"
          required
        />
        <select
          value={orderForm.productId}
          onChange={(e) => setOrderForm((prev) => ({ ...prev, productId: e.target.value }))}
          className="cursor-pointer rounded-xl border border-white/10 bg-slate-800 px-4 py-3 text-sm text-white transition-colors focus:border-primary focus:outline-none"
          required
        >
          <option value="">-- Chọn sản phẩm --</option>
          {productOptions.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="glow rounded-xl bg-primary px-5 py-3 font-bold text-white shadow-lg transition-transform hover:scale-[1.01] active:scale-[0.99]"
        >
          Tạo đơn thủ công
        </button>
      </form>

      <div className="grid grid-cols-1 gap-3 pt-2 md:grid-cols-[1fr_220px_auto]">
        <input
          value={orderFilter.email}
          onChange={(e) => setOrderFilter((prev) => ({ ...prev, email: e.target.value }))}
          placeholder="Lọc theo email"
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm transition-colors focus:border-primary focus:outline-none"
        />
        <select
          value={orderFilter.status}
          onChange={(e) => setOrderFilter((prev) => ({ ...prev, status: e.target.value }))}
          className="cursor-pointer rounded-xl border border-white/10 bg-slate-800 px-4 py-3 text-sm text-white transition-colors focus:border-primary focus:outline-none"
        >
          <option value="">Tất cả trạng thái thanh toán</option>
          <option value="pending">Chờ thanh toán</option>
          <option value="paid">Đã thanh toán</option>
          <option value="failed">Thất bại</option>
        </select>
        <button
          onClick={fetchOrders}
          className="rounded-xl border border-white/10 bg-secondary px-5 py-3 text-sm font-bold text-white shadow-md transition-colors hover:bg-secondary/80"
        >
          Lọc danh sách
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/5">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-white/10 bg-white/5 text-xs uppercase text-white/60">
            <tr>
              <th className="px-4 py-3 font-semibold">Mã đơn</th>
              <th className="px-4 py-3 font-semibold">Email</th>
              <th className="px-4 py-3 font-semibold">Sản phẩm</th>
              <th className="px-4 py-3 font-semibold">Tiền thu</th>
              <th className="px-4 py-3 font-semibold">Thanh toán</th>
              <th className="px-4 py-3 font-semibold">Xử lý đơn</th>
              <th className="px-4 py-3 font-semibold">Mã chuyển khoản</th>
              <th className="px-4 py-3 text-right font-semibold">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {orders.map((item) => {
              const isSupplierOrder = item.fulfillmentSource === 'supplier_api';

              return (
                <tr key={item.id} className="transition-colors hover:bg-white/5">
                  <td className="px-4 py-3 font-bold text-white">#{item.id}</td>
                  <td className="px-4 py-3 text-white/90">{item.email}</td>
                  <td className="px-4 py-3 font-medium text-primary">{item.product?.name || '-'}</td>
                  <td className="px-4 py-3 font-bold text-emerald-400">{formatVnd(item.amount)}</td>
                  <td className="px-4 py-3">
                    <select
                      value={item.status}
                      onChange={(e) => updateOrderStatus(item, e.target.value)}
                      className={`cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-bold ${
                        item.status === 'paid'
                          ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                          : item.status === 'pending'
                            ? 'border-orange-500/20 bg-orange-500/10 text-orange-400'
                            : 'border-red-500/20 bg-red-500/10 text-red-400'
                      }`}
                    >
                      <option value="pending">Chờ thanh toán</option>
                      <option value="paid">Đã thanh toán</option>
                      <option value="failed">Thất bại</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-lg bg-white/10 px-2 py-1 text-xs font-bold text-white/75">
                      {fulfillmentLabels[item.fulfillmentStatus] || item.fulfillmentStatus || '-'}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-white/50">{item.payment_ref}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      {isSupplierOrder && (
                        <button
                          onClick={() => refreshSupplierOrder(item)}
                          disabled={refreshingOrderId === item.id}
                          className="rounded-lg border border-secondary/20 bg-secondary/15 p-2 text-secondary shadow-sm transition-all hover:bg-secondary hover:text-white disabled:opacity-60"
                          title="Làm mới trạng thái từ nhà cung cấp"
                        >
                          <RefreshCw
                            className={`h-4 w-4 ${
                              refreshingOrderId === item.id ? 'animate-spin' : ''
                            }`}
                          />
                        </button>
                      )}
                      <button
                        onClick={() => deleteOrder(item)}
                        className="rounded-lg border border-red-500/20 bg-red-500/10 p-2 text-red-400 shadow-sm transition-all hover:bg-red-500 hover:text-white"
                        title="Xóa đơn hàng"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}

            {orders.length === 0 && (
              <tr>
                <td colSpan="8" className="px-4 py-8 text-center text-white/40">
                  Chưa có đơn hàng nào trên hệ thống.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 border-t border-white/10 pt-4">
          <button
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
          >
            Trước
          </button>
          <span className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold">
            Trang {page} / {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
          >
            Sau
          </button>
        </div>
      )}
    </div>
  );
};

export default TabOrders;
