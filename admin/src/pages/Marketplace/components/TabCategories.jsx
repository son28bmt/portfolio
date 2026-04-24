import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react';
import api from '../../../services/api';

const sectionOptions = [
  { value: 'service', label: 'Dịch vụ số' },
  { value: 'custom', label: 'Tài khoản' },
  { value: 'card', label: 'Card và mã số' },
];

const sectionLabels = Object.fromEntries(sectionOptions.map((item) => [item.value, item.label]));

const sectionDescriptions = {
  service: 'Danh mục dùng cho khu dịch vụ số và các sản phẩm lấy từ supplier / panel.',
  custom: 'Danh mục dùng cho những sản phẩm bạn tự thêm và tự quản lý trong kho.',
  card: 'Danh mục dành cho card, mã số, key và các sản phẩm giao ngay.',
};

const sectionBadgeClasses = {
  service: 'border-cyan-400/20 bg-cyan-400/10 text-cyan-200',
  custom: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200',
  card: 'border-fuchsia-400/20 bg-fuchsia-400/10 text-fuchsia-200',
};

const defaultOpenSections = {
  service: true,
  custom: true,
  card: false,
};

const TabCategories = ({ setError, setNotice, refreshKey }) => {
  const [categories, setCategories] = useState([]);
  const [categoryName, setCategoryName] = useState('');
  const [storeSection, setStoreSection] = useState('service');
  const [openSections, setOpenSections] = useState(defaultOpenSections);

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

  const groupedCategories = useMemo(
    () =>
      sectionOptions.map((section) => ({
        ...section,
        items: categories
          .filter((item) => (item.storeSection || 'service') === section.value)
          .sort((a, b) => a.name.localeCompare(b.name, 'vi')),
      })),
    [categories],
  );

  const toggleSection = (sectionKey) => {
    setOpenSections((prev) => ({
      ...prev,
      [sectionKey]: !prev[sectionKey],
    }));
  };

  const createCategory = async (event) => {
    event.preventDefault();
    setError('');
    setNotice('');

    try {
      await api.post('/admin/categories', {
        name: categoryName.trim(),
        storeSection,
      });

      setCategoryName('');
      setStoreSection('service');
      setNotice('Đã tạo danh mục mới.');
      setOpenSections((prev) => ({
        ...prev,
        [storeSection]: true,
      }));
      await fetchCategories();
    } catch (err) {
      setError(err?.response?.data?.message || 'Không thể tạo danh mục.');
    }
  };

  const updateCategory = async (item) => {
    const nextName = window.prompt('Nhập tên danh mục mới', item.name);
    if (!nextName) return;

    const nextSection =
      window.prompt(
        'Danh mục này thuộc khu nào? Nhập: service / custom / card',
        item.storeSection || 'service',
      ) || item.storeSection;

    setError('');
    setNotice('');

    try {
      await api.put(`/admin/categories/${item.id}`, {
        name: nextName.trim(),
        storeSection: nextSection.trim().toLowerCase(),
      });
      setNotice('Đã cập nhật danh mục.');
      setOpenSections((prev) => ({
        ...prev,
        [nextSection.trim().toLowerCase()]: true,
      }));
      await fetchCategories();
    } catch (err) {
      setError(err?.response?.data?.message || 'Không thể cập nhật danh mục.');
    }
  };

  const deleteCategory = async (item) => {
    if (!window.confirm(`Xóa danh mục "${item.name}"?`)) return;

    setError('');
    setNotice('');

    try {
      await api.delete(`/admin/categories/${item.id}`);
      setNotice('Đã xóa danh mục.');
      await fetchCategories();
    } catch (err) {
      setError(err?.response?.data?.message || 'Không thể xóa danh mục.');
    }
  };

  return (
    <div className="glass animate-in fade-in zoom-in-95 space-y-5 rounded-[24px] p-6 duration-300">
      <div>
        <h2 className="text-xl font-bold">Danh mục sản phẩm</h2>
        <p className="mt-2 max-w-3xl text-sm text-white/45">
          Mỗi danh mục nên được gắn rõ nó thuộc khu nào: dịch vụ số, tài khoản hay card. Bạn có
          thể đóng mở từng khu để nhìn danh sách gọn hơn.
        </p>
      </div>

      <form onSubmit={createCategory} className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_240px_auto]">
        <input
          value={categoryName}
          onChange={(e) => setCategoryName(e.target.value)}
          placeholder="Tên danh mục mới"
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm transition-colors hover:bg-white/10 focus:border-primary focus:outline-none"
          required
        />

        <select
          value={storeSection}
          onChange={(e) => setStoreSection(e.target.value)}
          className="cursor-pointer rounded-xl border border-white/10 bg-slate-800 px-4 py-3 text-sm text-white focus:border-primary focus:outline-none"
        >
          {sectionOptions.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>

        <button
          type="submit"
          className="glow inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 font-bold text-white shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98]"
        >
          <Plus className="h-4 w-4" />
          Thêm danh mục
        </button>
      </form>

      <div className="custom-scrollbar max-h-[620px] space-y-4 overflow-y-auto pr-2">
        {groupedCategories.map((group) => {
          const isOpen = Boolean(openSections[group.value]);

          return (
            <div key={group.value} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <button
                type="button"
                onClick={() => toggleSection(group.value)}
                className="flex w-full items-start justify-between gap-3 text-left"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-bold text-white">{group.label}</h3>
                    <span
                      className={`rounded-full border px-2 py-1 text-[11px] font-bold ${sectionBadgeClasses[group.value] || sectionBadgeClasses.service}`}
                    >
                      {group.items.length.toLocaleString('vi-VN')} danh mục
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-white/45">{sectionDescriptions[group.value]}</p>
                </div>

                <span className="mt-1 rounded-lg border border-white/10 bg-white/5 p-2 text-white/60">
                  {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </span>
              </button>

              {isOpen && (
                <div className="mt-4 space-y-2 border-t border-white/10 pt-4">
                  {group.items.length > 0 ? (
                    group.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/10 p-3 transition-colors hover:bg-white/10"
                      >
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="leading-tight font-bold text-white">{item.name}</p>
                            <span
                              className={`rounded-full border px-2 py-1 text-[11px] font-bold ${sectionBadgeClasses[group.value] || sectionBadgeClasses.service}`}
                            >
                              {group.label}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-white/40">ID: {item.id}</p>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => updateCategory(item)}
                            className="rounded-lg border border-white/10 bg-white/5 p-2 text-white/70 transition-all hover:bg-white/20 hover:text-white"
                            title="Sửa danh mục"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => deleteCategory(item)}
                            className="rounded-lg border border-red-500/20 bg-red-500/10 p-2 text-red-400 shadow-sm transition-all hover:bg-red-500 hover:text-white"
                            title="Xóa danh mục"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-xl border border-dashed border-white/10 px-4 py-6 text-center text-sm text-white/40">
                      Khu này chưa có danh mục nào.
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {categories.length === 0 && (
          <div className="rounded-2xl border-2 border-dashed border-white/10 p-8 text-center text-white/40">
            Chưa có danh mục nào trên hệ thống.
          </div>
        )}
      </div>
    </div>
  );
};

export default TabCategories;
