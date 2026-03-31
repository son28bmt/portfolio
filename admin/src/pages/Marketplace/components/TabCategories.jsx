import React, { useState, useEffect } from 'react';
import { Pencil, Trash2, Plus } from 'lucide-react';
import api from '../../../services/api';

const TabCategories = ({ setError, setNotice, refreshKey }) => {
  const [categories, setCategories] = useState([]);
  const [categoryName, setCategoryName] = useState('');

  const fetchCategories = async () => {
    try {
      const { data } = await api.get('/admin/categories');
      setCategories(Array.isArray(data) ? data : []);
    } catch (err) {
      setError('Lỗi lấy danh mục.');
    }
  };

  useEffect(() => {
    fetchCategories();
  }, [refreshKey]);

  const createCategory = async (event) => {
    event.preventDefault();
    setError(''); setNotice('');
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
    setError(''); setNotice('');
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
    setError(''); setNotice('');
    try {
      await api.delete(`/admin/categories/${item.id}`);
      setNotice('Đã xóa danh mục.');
      await fetchCategories();
    } catch (err) {
      setError(err?.response?.data?.message || 'Không thể xóa danh mục.');
    }
  };

  return (
    <div className="glass rounded-[24px] p-6 space-y-5 animate-in fade-in zoom-in-95 duration-300">
      <h2 className="text-xl font-bold">Danh mục sản phẩm</h2>
      <form onSubmit={createCategory} className="flex flex-col md:flex-row gap-3">
        <input
          value={categoryName}
          onChange={(e) => setCategoryName(e.target.value)}
          placeholder="Tên danh mục mới"
          className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-primary transition-colors hover:bg-white/10"
          required
        />
        <button type="submit" className="px-5 py-3 rounded-xl bg-primary text-white font-bold inline-flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-transform shadow-lg glow">
          <Plus className="w-4 h-4" />
          Thêm danh mục
        </button>
      </form>

      <div className="space-y-2 max-h-[500px] overflow-y-auto custom-scrollbar pr-2">
        {categories.map((item) => (
          <div key={item.id} className="p-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors flex items-center justify-between gap-3">
            <div>
              <p className="font-bold text-white leading-tight">{item.name}</p>
              <p className="text-xs text-white/40 mt-1">ID: {item.id}</p>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => updateCategory(item)} 
                className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/20 transition-all text-white/70 hover:text-white"
                title="Sửa danh mục"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button 
                onClick={() => deleteCategory(item)} 
                className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500 hover:text-white transition-all shadow-sm"
                title="Xóa danh mục"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
        {categories.length === 0 && (
          <div className="p-8 text-center text-white/40 border-2 border-dashed border-white/10 rounded-2xl">
            Chưa có danh mục nào trên hệ thống.
          </div>
        )}
      </div>
    </div>
  );
};

export default TabCategories;
