import React, { useState, useEffect, useMemo } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import api from '../../../services/api';

const formatVnd = (value) =>
  Number(value || 0).toLocaleString('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  });

const TabProducts = ({ setError, setNotice, refreshKey }) => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [productForm, setProductForm] = useState({
    name: '',
    description: '',
    price: '',
    categoryId: '',
  });

  const fetchData = async () => {
    try {
      const [prodRes, catRes] = await Promise.all([
        api.get('/admin/products'),
        api.get('/admin/categories')
      ]);
      setProducts(Array.isArray(prodRes.data) ? prodRes.data : []);
      setCategories(Array.isArray(catRes.data) ? catRes.data : []);
    } catch (err) {
      setError('Lỗi tải dữ liệu Sản phẩm/Danh mục.');
    }
  };

  useEffect(() => {
    fetchData();
  }, [refreshKey]);

  const categoryMap = useMemo(() => {
    const map = new Map();
    categories.forEach((item) => map.set(Number(item.id), item.name));
    return map;
  }, [categories]);

  const createProduct = async (event) => {
    event.preventDefault();
    setError(''); setNotice('');
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
      await fetchData();
    } catch (err) {
      setError(err?.response?.data?.message || 'Không thể tạo sản phẩm.');
    }
  };

  const editProduct = async (product) => {
    const nextPrice = window.prompt('Giá mới (VND)', product.price);
    if (!nextPrice) return;
    setError(''); setNotice('');
    try {
      await api.put(`/admin/products/${product.id}`, {
        price: Number(nextPrice),
      });
      setNotice('Đã cập nhật sản phẩm.');
      await fetchData();
    } catch (err) {
      setError(err?.response?.data?.message || 'Không thể cập nhật sản phẩm.');
    }
  };

  const deleteProduct = async (product) => {
    if (!window.confirm(`Xóa sản phẩm "${product.name}"?`)) return;
    setError(''); setNotice('');
    try {
      await api.delete(`/admin/products/${product.id}`);
      setNotice('Đã xóa sản phẩm.');
      await fetchData();
    } catch (err) {
      setError(err?.response?.data?.message || 'Không thể xóa sản phẩm.');
    }
  };

  return (
    <div className="glass rounded-[24px] p-6 space-y-5 animate-in fade-in zoom-in-95 duration-300">
      <h2 className="text-xl font-bold">Sản phẩm</h2>

      <form onSubmit={createProduct} className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <input
          value={productForm.name}
          onChange={(e) => setProductForm((prev) => ({ ...prev, name: e.target.value }))}
          placeholder="Tên sản phẩm"
          className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-primary transition-colors"
          required
        />
        <select
          value={productForm.categoryId}
          onChange={(e) => setProductForm((prev) => ({ ...prev, categoryId: e.target.value }))}
          className="px-4 py-3 rounded-xl bg-slate-800 border border-white/10 text-sm text-white focus:outline-none focus:border-primary transition-colors cursor-pointer"
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
          className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-primary transition-colors"
          required
        />
        <textarea
          value={productForm.description}
          onChange={(e) => setProductForm((prev) => ({ ...prev, description: e.target.value }))}
          placeholder="Mô tả sản phẩm"
          className="md:col-span-2 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm min-h-[90px] focus:outline-none focus:border-primary transition-colors custom-scrollbar"
        />
        <p className="md:col-span-2 text-[11px] text-white/50 italic">
          * Số lượng hiển thị sẽ mặc định là 0 và tự động tăng khi bạn nhập dữ liệu vào Kho hàng (Stock).
        </p>
        <button type="submit" className="md:col-span-2 px-5 py-3 rounded-xl bg-primary text-white font-bold hover:scale-[1.01] active:scale-[0.99] transition-transform shadow-lg glow">
          Tạo sản phẩm
        </button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/5">
        <table className="w-full text-sm text-left">
          <thead className="bg-white/5 border-b border-white/10 text-xs uppercase text-white/60">
            <tr>
              <th className="px-4 py-3 font-semibold">Tên</th>
              <th className="px-4 py-3 font-semibold">Danh mục</th>
              <th className="px-4 py-3 font-semibold">Giá</th>
              <th className="px-4 py-3 font-semibold">Số lượng (Auto)</th>
              <th className="px-4 py-3 font-semibold text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {products.map((item) => (
              <tr key={item.id} className="hover:bg-white/5 transition-colors">
                <td className="px-4 py-3 font-medium text-white">{item.name}</td>
                <td className="px-4 py-3 text-white/70">
                  {item.category?.name || categoryMap.get(Number(item.categoryId)) || '-'}
                </td>
                <td className="px-4 py-3 text-emerald-400 font-medium">{formatVnd(item.price)}</td>
                <td className="px-4 py-3 text-white/70">
                  <span className="bg-white/10 px-2 py-1 rounded-lg text-xs font-bold">
                    {Number(item.quantity || 0).toLocaleString('vi-VN')}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <button 
                      onClick={() => editProduct(item)} 
                      className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/20 transition-all text-white/70 hover:text-white"
                      title="Sửa giá"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => deleteProduct(item)} 
                      className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500 hover:text-white transition-all shadow-sm"
                      title="Xóa sản phẩm"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {products.length === 0 && (
              <tr>
                <td colSpan="5" className="px-4 py-8 text-center text-white/40">
                  Chưa có danh mục sản phẩm nào.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TabProducts;
