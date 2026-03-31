import React, { useState, useEffect, useMemo } from 'react';
import { Trash2 } from 'lucide-react';
import api from '../../../services/api';

const TabStock = ({ setError, setNotice, refreshKey }) => {
  const [stockItems, setStockItems] = useState([]);
  const [products, setProducts] = useState([]);
  const [stockFilter, setStockFilter] = useState('all');
  const [stockForm, setStockForm] = useState({
    productId: '',
    data: '',
    quantity: '1',
  });
  
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalAvailableStock, setTotalAvailableStock] = useState(0);
  const [selectedAvailableStock, setSelectedAvailableStock] = useState(0);

  const fetchStockItems = async () => {
    try {
      const params = { page, limit: 15 };
      if (stockFilter !== 'all') params.status = stockFilter;
      if (stockForm.productId) params.productId = stockForm.productId;
      
      const { data } = await api.get('/admin/stock_items', { params });
      setStockItems(Array.isArray(data.items) ? data.items : []);
      setTotalPages(data.totalPages || 1);
      setTotalAvailableStock(data.totalAvailableStock || 0);
      setSelectedAvailableStock(data.selectedAvailableStock || 0);
    } catch (err) {
      setError('Lỗi lấy dữ liệu kho hàng.');
    }
  };

  const fetchProducts = async () => {
    try {
      const { data } = await api.get('/admin/products');
      setProducts(Array.isArray(data) ? data : []);
    } catch (err) {
      setError('Lỗi lấy dữ liệu sản phẩm.');
    }
  };

  useEffect(() => {
    fetchStockItems();
    fetchProducts();
  }, [refreshKey]);

  useEffect(() => {
    fetchStockItems();
  }, [page, stockFilter, stockForm.productId]);

  const productOptions = useMemo(
    () => products.map((item) => ({ id: item.id, name: item.name })),
    [products]
  );
  
  const selectedProductId = Number(stockForm.productId || 0);

  const selectedProduct = useMemo(
    () => products.find((item) => Number(item.id) === selectedProductId) || null,
    [products, selectedProductId]
  );

  const createStockItem = async (event) => {
    event.preventDefault();
    setError(''); setNotice('');
    try {
      const quantity = Math.max(1, Number(stockForm.quantity || 1));
      await api.post('/admin/stock_items', {
        product_id: Number(stockForm.productId),
        data: stockForm.data.trim(),
        quantity,
      });
      setStockForm({ productId: '', data: '', quantity: '1' });
      setNotice('Đã thêm dữ liệu kho hàng.');
      await fetchStockItems();
      await fetchProducts();
    } catch (err) {
      setError(err?.response?.data?.message || 'Không thể thêm kho hàng.');
    }
  };

  const changeStockStatus = async (item, status) => {
    setError(''); setNotice('');
    try {
      await api.put(`/admin/stock_items/${item.id}`, { status });
      setNotice('Đã cập nhật trạng thái kho.');
      await fetchStockItems();
      await fetchProducts();
    } catch (err) {
      setError(err?.response?.data?.message || 'Không thể cập nhật trạng thái kho.');
    }
  };

  const deleteStockItem = async (item) => {
    if (!window.confirm(`Xóa stock item #${item.id}?`)) return;
    setError(''); setNotice('');
    try {
      await api.delete(`/admin/stock_items/${item.id}`);
      setNotice('Đã xóa stock item.');
      await fetchStockItems();
      await fetchProducts();
    } catch (err) {
      setError(err?.response?.data?.message || 'Không thể xóa stock item.');
    }
  };

  return (
    <div className="glass rounded-[24px] p-6 space-y-5 animate-in fade-in zoom-in-95 duration-300">
      <h2 className="text-xl font-bold">Kho hàng (Stock Items)</h2>

      <div className="flex flex-wrap gap-2">
        <span className="px-3 py-1 rounded-full text-xs font-semibold border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 shadow-sm">
          Số lượng khả dụng toàn kho: {Number(totalAvailableStock || 0).toLocaleString('vi-VN')}
        </span>
        {selectedProduct && (
          <>
            <span className="px-3 py-1 rounded-full text-xs font-semibold border border-primary/30 bg-primary/10 text-primary shadow-sm">
              {selectedProduct.name}
            </span>
            <span className="px-3 py-1 rounded-full text-xs font-semibold border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 shadow-sm">
              SL Hiển Thị trên Shop: {Number(selectedProduct.quantity || 0).toLocaleString('vi-VN')}
            </span>
            <span className="px-3 py-1 rounded-full text-xs font-semibold border border-white/20 bg-white/10 text-white/80 shadow-sm">
              Thực tế tồn kho (Available): {Number(selectedAvailableStock || 0).toLocaleString('vi-VN')}
            </span>
          </>
        )}
      </div>

      <form onSubmit={createStockItem} className="grid grid-cols-1 gap-3 border border-white/5 bg-white-[0.02] p-4 rounded-2xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <select
            value={stockForm.productId}
            onChange={(e) => setStockForm((prev) => ({ ...prev, productId: e.target.value }))}
            className="px-4 py-3 rounded-xl bg-slate-800 border border-white/10 text-sm text-white focus:outline-none focus:border-primary transition-colors cursor-pointer"
            required
          >
            <option value="">-- Chọn sản phẩm cần nạp kho --</option>
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
            placeholder="Khối lượng nạp (Hệ số nhân)"
            className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-primary transition-colors"
            required
          />
        </div>
        <textarea
          value={stockForm.data}
          onChange={(e) => setStockForm((prev) => ({ ...prev, data: e.target.value }))}
          placeholder="Dữ liệu tài khoản/key. Ví dụ: user:abc | pass:123"
          className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm min-h-[110px] focus:outline-none focus:border-primary transition-colors custom-scrollbar"
          required
        />
        <p className="text-xs text-white/50 italic px-2">
          * Nếu Data chỉ có 1 dòng, hệ thống sẽ clone ra đủ "Khối lượng nạp". Nếu Data có nhiều dòng, mỗi dòng sẽ tạo thành 1 Item riêng.
        </p>
        <button type="submit" className="px-5 py-3 rounded-xl bg-primary text-white font-bold hover:scale-[1.01] active:scale-[0.99] transition-transform shadow-lg glow mt-2">
          Tiến hành Nạp Kho
        </button>
      </form>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-t border-white/10 pt-5 mt-2">
        <span className="text-sm font-bold text-white/60">Danh sách Item tồn kho:</span>
        <select
          value={stockFilter}
          onChange={(e) => setStockFilter(e.target.value)}
          className="px-4 py-2 rounded-xl bg-slate-800 border border-white/10 text-xs text-white focus:outline-none cursor-pointer"
        >
          <option value="all">Hiển thị Tất cả</option>
          <option value="available">Chỉ những Item Chưa bán (available)</option>
          <option value="sold">Chỉ những Item Đã bán (sold)</option>
        </select>
      </div>

      <div className="space-y-3 max-h-[420px] overflow-y-auto custom-scrollbar pr-2">
        {stockItems.map((item) => (
          <div key={item.id} className="p-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <p className="font-bold text-sm text-primary"> #{item.id} - {item.product?.name || `Sản phẩm ID: ${item.productId}`}</p>
              <div className="flex items-center gap-2">
                <select
                  value={item.status}
                  onChange={(e) => changeStockStatus(item, e.target.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${item.status === 'available' ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400' : 'border-slate-500/20 bg-slate-500/10 text-slate-400'} cursor-pointer`}
                >
                  <option value="available">Available (Còn hàng)</option>
                  <option value="sold">Sold (Đã bán)</option>
                </select>
                <button 
                  onClick={() => deleteStockItem(item)} 
                  className="p-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500 hover:text-white transition-colors"
                  title="Xóa item này"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            <pre className="text-xs text-white/60 whitespace-pre-wrap break-all bg-black/20 p-3 rounded-lg border border-white/5">{item.data}</pre>
          </div>
        ))}
        {stockItems.length === 0 && (
          <div className="p-8 text-center text-white/40 border-2 border-dashed border-white/10 rounded-2xl">
            Không tìm thấy dữ liệu nào phù hợp với bộ lọc.
          </div>
        )}
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

export default TabStock;
