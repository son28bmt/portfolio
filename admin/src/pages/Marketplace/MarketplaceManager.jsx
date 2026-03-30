import React, { useEffect, useMemo, useState } from 'react';
import {
  Boxes,
  PackagePlus,
  Layers3,
  ShoppingCart,
  RefreshCw,
  Trash2,
  Pencil,
  Plus,
} from 'lucide-react';
import { io } from 'socket.io-client';
import api from '../../services/api';

const tabs = [
  { key: 'categories', label: 'Danh mục', icon: Layers3 },
  { key: 'products', label: 'Sản phẩm', icon: Boxes },
  { key: 'stock', label: 'Kho hàng', icon: PackagePlus },
  { key: 'orders', label: 'Đơn hàng', icon: ShoppingCart },
];

const formatVnd = (value) =>
  Number(value || 0).toLocaleString('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  });

const MarketplaceManager = () => {
  const [activeTab, setActiveTab] = useState('categories');
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [stockItems, setStockItems] = useState([]);
  const [stockFilter, setStockFilter] = useState('all');
  const [orders, setOrders] = useState([]);

  const [categoryName, setCategoryName] = useState('');
  const [productForm, setProductForm] = useState({
    name: '',
    description: '',
    price: '',
    categoryId: '',
  });
  const [stockForm, setStockForm] = useState({
    productId: '',
    data: '',
    quantity: '1',
  });
  const [orderForm, setOrderForm] = useState({
    email: '',
    productId: '',
  });

  const [orderFilter, setOrderFilter] = useState({
    status: '',
    email: '',
  });

  const resetNotice = () => {
    setNotice('');
    setError('');
  };

  const fetchCategories = async () => {
    const { data } = await api.get('/admin/categories');
    setCategories(Array.isArray(data) ? data : []);
  };

  const fetchProducts = async () => {
    const { data } = await api.get('/admin/products');
    setProducts(Array.isArray(data) ? data : []);
  };

  const fetchStockItems = async () => {
    const { data } = await api.get('/admin/stock_items');
    setStockItems(Array.isArray(data) ? data : []);
  };

  const fetchOrders = async () => {
    const params = {};
    if (orderFilter.status) params.status = orderFilter.status;
    if (orderFilter.email) params.email = orderFilter.email;
    const { data } = await api.get('/admin/orders', { params });
    setOrders(Array.isArray(data) ? data : []);
  };

  const fetchAll = async () => {
    setLoading(true);
    resetNotice();
    try {
      await Promise.all([fetchCategories(), fetchProducts(), fetchStockItems(), fetchOrders()]);
    } catch (err) {
      setError(err?.response?.data?.message || 'Không thể tải dữ liệu marketplace.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const productOptions = useMemo(
    () => products.map((item) => ({ id: item.id, name: item.name })),
    [products]
  );

  const categoryMap = useMemo(() => {
    const map = new Map();
    categories.forEach((item) => map.set(Number(item.id), item.name));
    return map;
  }, [categories]);

  const selectedProductId = Number(stockForm.productId || 0);

  const selectedProduct = useMemo(
    () => products.find((item) => Number(item.id) === selectedProductId) || null,
    [products, selectedProductId]
  );

  const selectedAvailableStock = useMemo(() => {
    if (!selectedProductId) return 0;
    return stockItems.filter(
      (item) => Number(item.productId) === selectedProductId && item.status === 'available'
    ).length;
  }, [stockItems, selectedProductId]);

  const totalAvailableStock = useMemo(
    () => stockItems.filter((item) => item.status === 'available').length,
    [stockItems]
  );

  const filteredStockItems = useMemo(() => {
    if (stockFilter === 'all') return stockItems;
    return stockItems.filter((item) => item.status === stockFilter);
  }, [stockItems, stockFilter]);

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

    socket.on('admin_market_refresh', () => {
      fetchAll(); // Tự động reload lại toàn bộ dữ liệu mới nhất
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const createCategory = async (event) => {
    event.preventDefault();
    resetNotice();
    try {
      await api.post('/admin/categories', { name: categoryName.trim() });
      setCategoryName('');
      setNotice('Đã tạo danh mục mới.');
      await fetchCategories();
    } catch (err) {
      setError(err?.response?.data?.message || 'Không thể tạo danh mục.');
    }
  };

  const updateCategory = async (item) => {
    const nextName = window.prompt('Nhập tên danh mục mới', item.name);
    if (!nextName || nextName.trim() === item.name) return;
    resetNotice();
    try {
      await api.put(`/admin/categories/${item.id}`, { name: nextName.trim() });
      setNotice('Đã cập nhật danh mục.');
      await fetchCategories();
    } catch (err) {
      setError(err?.response?.data?.message || 'Không thể cập nhật danh mục.');
    }
  };

  const deleteCategory = async (item) => {
    if (!window.confirm(`Xóa danh mục "${item.name}"?`)) return;
    resetNotice();
    try {
      await api.delete(`/admin/categories/${item.id}`);
      setNotice('Đã xóa danh mục.');
      await fetchCategories();
    } catch (err) {
      setError(err?.response?.data?.message || 'Không thể xóa danh mục.');
    }
  };

  const createProduct = async (event) => {
    event.preventDefault();
    resetNotice();
    try {
      await api.post('/admin/products', {
        name: productForm.name.trim(),
        description: productForm.description.trim(),
        price: Number(productForm.price || 0),
        category_id: Number(productForm.categoryId),
        quantity: 0,
      });
      setProductForm({
        name: '',
        description: '',
        price: '',
        categoryId: '',
      });
      setNotice('Đã tạo sản phẩm mới.');
      await fetchProducts();
    } catch (err) {
      setError(err?.response?.data?.message || 'Không thể tạo sản phẩm.');
    }
  };

  const editProduct = async (product) => {
    const nextPrice = window.prompt('Giá mới (VND)', product.price);
    if (!nextPrice) return;
    resetNotice();
    try {
      await api.put(`/admin/products/${product.id}`, {
        price: Number(nextPrice),
      });
      setNotice('Đã cập nhật sản phẩm.');
      await fetchProducts();
    } catch (err) {
      setError(err?.response?.data?.message || 'Không thể cập nhật sản phẩm.');
    }
  };

  const deleteProduct = async (product) => {
    if (!window.confirm(`Xóa sản phẩm "${product.name}"?`)) return;
    resetNotice();
    try {
      await api.delete(`/admin/products/${product.id}`);
      setNotice('Đã xóa sản phẩm.');
      await fetchProducts();
    } catch (err) {
      setError(err?.response?.data?.message || 'Không thể xóa sản phẩm.');
    }
  };

  const createStockItem = async (event) => {
    event.preventDefault();
    resetNotice();
    try {
      const quantity = Math.max(1, Number(stockForm.quantity || 1));
      const { data } = await api.post('/admin/stock_items', {
        product_id: Number(stockForm.productId),
        data: stockForm.data.trim(),
        quantity,
      });
      setStockForm({ productId: '', data: '', quantity: '1' });
      setNotice('Đã thêm dữ liệu kho hàng.');
      await Promise.all([fetchStockItems(), fetchProducts()]);
    } catch (err) {
      setError(err?.response?.data?.message || 'Không thể thêm kho hàng.');
    }
  };

  const changeStockStatus = async (item, status) => {
    resetNotice();
    try {
      await api.put(`/admin/stock_items/${item.id}`, { status });
      setNotice('Đã cập nhật trạng thái kho.');
      await Promise.all([fetchStockItems(), fetchProducts()]);
    } catch (err) {
      setError(err?.response?.data?.message || 'Không thể cập nhật trạng thái kho.');
    }
  };

  const deleteStockItem = async (item) => {
    if (!window.confirm(`Xóa stock item #${item.id}?`)) return;
    resetNotice();
    try {
      await api.delete(`/admin/stock_items/${item.id}`);
      setNotice('Đã xóa stock item.');
      await Promise.all([fetchStockItems(), fetchProducts()]);
    } catch (err) {
      setError(err?.response?.data?.message || 'Không thể xóa stock item.');
    }
  };

  const createOrder = async (event) => {
    event.preventDefault();
    resetNotice();
    try {
      await api.post('/admin/orders', {
        email: orderForm.email.trim(),
        product_id: Number(orderForm.productId),
      });
      setOrderForm({ email: '', productId: '' });
      setNotice('Đã tạo đơn hàng thủ công.');
      await fetchOrders();
    } catch (err) {
      setError(err?.response?.data?.message || 'Không thể tạo đơn hàng.');
    }
  };

  const updateOrderStatus = async (order, status) => {
    resetNotice();
    try {
      await api.put(`/admin/orders/${order.id}`, { status });
      setNotice('Đã cập nhật trạng thái đơn hàng.');
      await fetchOrders();
    } catch (err) {
      setError(err?.response?.data?.message || 'Không thể cập nhật đơn hàng.');
    }
  };

  const deleteOrder = async (order) => {
    if (!window.confirm(`Xóa đơn hàng #${order.id}?`)) return;
    resetNotice();
    try {
      await api.delete(`/admin/orders/${order.id}`);
      setNotice('Đã xóa đơn hàng.');
      await fetchOrders();
    } catch (err) {
      setError(err?.response?.data?.message || 'Không thể xóa đơn hàng.');
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">Quản lý chợ số</h1>
          <p className="text-white/40">Quản lý danh mục, sản phẩm, kho hàng và đơn hàng tự động.</p>
        </div>
        <button
          onClick={fetchAll}
          disabled={loading}
          className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 font-bold text-sm inline-flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Làm mới dữ liệu
        </button>
      </div>

      {(notice || error) && (
        <div className="space-y-2">
          {notice && <div className="p-3 rounded-xl border border-green-500/20 bg-green-500/10 text-green-300 text-sm">{notice}</div>}
          {error && <div className="p-3 rounded-xl border border-red-500/20 bg-red-500/10 text-red-300 text-sm">{error}</div>}
        </div>
      )}

      <div className="glass rounded-[24px] p-3 flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-xl text-sm font-bold inline-flex items-center gap-2 transition-all ${
              activeTab === tab.key
                ? 'bg-primary/20 text-primary border border-primary/30'
                : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'categories' && (
        <div className="glass rounded-[24px] p-6 space-y-5">
          <h2 className="text-xl font-bold">Danh mục sản phẩm</h2>
          <form onSubmit={createCategory} className="flex flex-col md:flex-row gap-3">
            <input
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              placeholder="Tên danh mục mới"
              className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-primary"
              required
            />
            <button type="submit" className="px-5 py-3 rounded-xl bg-primary font-bold inline-flex items-center justify-center gap-2">
              <Plus className="w-4 h-4" />
              Thêm danh mục
            </button>
          </form>

          <div className="space-y-2">
            {categories.map((item) => (
              <div key={item.id} className="p-3 rounded-xl border border-white/10 bg-white/5 flex items-center justify-between gap-3">
                <div>
                  <p className="font-bold">{item.name}</p>
                  <p className="text-xs text-white/40">ID: {item.id}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => updateCategory(item)} className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => deleteCategory(item)} className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
            {categories.length === 0 && <p className="text-sm text-white/40">Chưa có danh mục nào.</p>}
          </div>
        </div>
      )}

      {activeTab === 'products' && (
        <div className="glass rounded-[24px] p-6 space-y-5">
          <h2 className="text-xl font-bold">Sản phẩm</h2>

          <form onSubmit={createProduct} className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              value={productForm.name}
              onChange={(e) => setProductForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Tên sản phẩm"
              className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm"
              required
            />
            <select
              value={productForm.categoryId}
              onChange={(e) => setProductForm((prev) => ({ ...prev, categoryId: e.target.value }))}
              className="admin-select"
              required
            >
              <option value="">Chọn danh mục</option>
              {categories.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <input
              value={productForm.price}
              onChange={(e) => setProductForm((prev) => ({ ...prev, price: e.target.value }))}
              placeholder="Giá (VND)"
              type="number"
              className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm"
              required
            />
            <textarea
              value={productForm.description}
              onChange={(e) => setProductForm((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Mô tả sản phẩm"
              className="md:col-span-2 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm min-h-[90px]"
            />
            <p className="md:col-span-2 text-xs text-white/50">
              Số lượng hiển thị sẽ mặc định là 0 và tự động tăng khi bạn thêm dữ liệu vào Kho hàng.
            </p>
            <button type="submit" className="md:col-span-2 px-5 py-3 rounded-xl bg-primary font-bold">
              Tạo sản phẩm
            </button>
          </form>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-white/40 border-b border-white/10">
                  <th className="py-2 text-left">Tên</th>
                  <th className="py-2 text-left">Danh mục</th>
                  <th className="py-2 text-left">Giá</th>
                  <th className="py-2 text-left">Số lượng</th>
                  <th className="py-2 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {products.map((item) => (
                  <tr key={item.id} className="border-b border-white/5">
                    <td className="py-3">{item.name}</td>
                    <td className="py-3">{item.category?.name || categoryMap.get(Number(item.categoryId)) || '-'}</td>
                    <td className="py-3">{formatVnd(item.price)}</td>
                    <td className="py-3">{Number(item.quantity || 0).toLocaleString('vi-VN')}</td>
                    <td className="py-3">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => editProduct(item)} className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => deleteProduct(item)} className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {products.length === 0 && <p className="text-sm text-white/40 py-4">Chưa có sản phẩm nào.</p>}
          </div>
        </div>
      )}

      {activeTab === 'stock' && (
        <div className="glass rounded-[24px] p-6 space-y-5">
          <h2 className="text-xl font-bold">Kho hàng (stock_items)</h2>

          <div className="flex flex-wrap gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-semibold border border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
              Số lượng khả dụng toàn kho: {Number(totalAvailableStock || 0).toLocaleString('vi-VN')}
            </span>
            {selectedProduct && (
              <>
                <span className="px-3 py-1 rounded-full text-xs font-semibold border border-primary/30 bg-primary/10 text-primary">
                  {selectedProduct.name}
                </span>
                <span className="px-3 py-1 rounded-full text-xs font-semibold border border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
                  Số lượng còn lại: {Number(selectedProduct.quantity || 0).toLocaleString('vi-VN')}
                </span>
                <span className="px-3 py-1 rounded-full text-xs font-semibold border border-white/20 bg-white/10 text-white/80">
                  Item available: {Number(selectedAvailableStock || 0).toLocaleString('vi-VN')}
                </span>
              </>
            )}
          </div>

          <form onSubmit={createStockItem} className="grid grid-cols-1 gap-3">
            <select
              value={stockForm.productId}
              onChange={(e) => setStockForm((prev) => ({ ...prev, productId: e.target.value }))}
              className="admin-select"
              required
            >
              <option value="">Chọn sản phẩm</option>
              {productOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <input
              type="number"
              min="1"
              value={stockForm.quantity}
              onChange={(e) => setStockForm((prev) => ({ ...prev, quantity: e.target.value }))}
              placeholder="Số lượng thêm"
              className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm"
              required
            />
            <textarea
              value={stockForm.data}
              onChange={(e) => setStockForm((prev) => ({ ...prev, data: e.target.value }))}
              placeholder="Dữ liệu tài khoản/key. Ví dụ: user:abc | pass:123"
              className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm min-h-[110px]"
              required
            />
            <p className="text-xs text-white/50">
              Nếu chỉ có 1 dòng dữ liệu, hệ thống sẽ thêm theo ô số lượng. Nếu có nhiều dòng, mỗi dòng sẽ tạo 1 item.
            </p>
            <button type="submit" className="px-5 py-3 rounded-xl bg-primary font-bold">
              Thêm vào kho
            </button>
          </form>

          <div className="flex items-center gap-3 border-t border-white/10 pt-4">
            <span className="text-sm font-bold text-white/60">Bộ lọc hiển thị:</span>
            <select
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value)}
              className="admin-select"
            >
              <option value="all">Tất cả</option>
              <option value="available">Chưa bán (available)</option>
              <option value="sold">Đã bán (sold)</option>
            </select>
          </div>

          <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
            {filteredStockItems.map((item) => (
              <div key={item.id} className="p-3 rounded-xl border border-white/10 bg-white/5">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <p className="font-bold text-sm">#{item.id} - {item.product?.name || `Sản phẩm ${item.productId}`}</p>
                  <div className="flex items-center gap-2">
                    <select
                      value={item.status}
                      onChange={(e) => changeStockStatus(item, e.target.value)}
                      className="admin-select-sm"
                    >
                      <option value="available">available</option>
                      <option value="sold">sold</option>
                    </select>
                    <button onClick={() => deleteStockItem(item)} className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <pre className="text-xs text-white/60 whitespace-pre-wrap break-all">{item.data}</pre>
              </div>
            ))}
            {filteredStockItems.length === 0 && <p className="text-sm text-white/40">Không tìm thấy dữ liệu nào.</p>}
          </div>
        </div>
      )}

      {activeTab === 'orders' && (
        <div className="glass rounded-[24px] p-6 space-y-5">
          <h2 className="text-xl font-bold">Đơn hàng</h2>

          <form onSubmit={createOrder} className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              type="email"
              value={orderForm.email}
              onChange={(e) => setOrderForm((prev) => ({ ...prev, email: e.target.value }))}
              placeholder="Email khách"
              className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm"
              required
            />
            <select
              value={orderForm.productId}
              onChange={(e) => setOrderForm((prev) => ({ ...prev, productId: e.target.value }))}
              className="admin-select"
              required
            >
              <option value="">Chọn sản phẩm</option>
              {productOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <button type="submit" className="px-5 py-3 rounded-xl bg-primary font-bold">
              Tạo đơn thủ công
            </button>
          </form>

          <div className="grid grid-cols-1 md:grid-cols-[1fr_180px_auto] gap-3">
            <input
              value={orderFilter.email}
              onChange={(e) => setOrderFilter((prev) => ({ ...prev, email: e.target.value }))}
              placeholder="Lọc theo email"
              className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm"
            />
            <select
              value={orderFilter.status}
              onChange={(e) => setOrderFilter((prev) => ({ ...prev, status: e.target.value }))}
              className="admin-select"
            >
              <option value="">Tất cả trạng thái</option>
              <option value="pending">pending</option>
              <option value="paid">paid</option>
              <option value="failed">failed</option>
            </select>
            <button onClick={fetchOrders} className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-sm font-bold">
              Lọc đơn
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-white/40 border-b border-white/10">
                  <th className="py-2 text-left">ID</th>
                  <th className="py-2 text-left">Email</th>
                  <th className="py-2 text-left">Sản phẩm</th>
                  <th className="py-2 text-left">Số tiền</th>
                  <th className="py-2 text-left">Trạng thái</th>
                  <th className="py-2 text-left">Mã thanh toán</th>
                  <th className="py-2 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((item) => (
                  <tr key={item.id} className="border-b border-white/5">
                    <td className="py-3">#{item.id}</td>
                    <td className="py-3">{item.email}</td>
                    <td className="py-3">{item.product?.name || '-'}</td>
                    <td className="py-3">{formatVnd(item.amount)}</td>
                    <td className="py-3">
                      <select
                        value={item.status}
                        onChange={(e) => updateOrderStatus(item, e.target.value)}
                        className="admin-select-sm"
                      >
                        <option value="pending">pending</option>
                        <option value="paid">paid</option>
                        <option value="failed">failed</option>
                      </select>
                    </td>
                    <td className="py-3 font-mono text-xs">{item.payment_ref}</td>
                    <td className="py-3">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => deleteOrder(item)} className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {orders.length === 0 && <p className="text-sm text-white/40 py-4">Chưa có đơn hàng nào.</p>}
          </div>
        </div>
      )}
    </div>
  );
};

export default MarketplaceManager;
