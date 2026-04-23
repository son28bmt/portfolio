import React, { useEffect, useState } from 'react';
import { Boxes, PackagePlus, Layers3, ShoppingCart } from 'lucide-react';
import { io } from 'socket.io-client';
import api from '../../services/api';

import TabCategories from './components/TabCategories';
import TabProducts from './components/TabProducts';
import TabStock from './components/TabStock';
import TabOrders from './components/TabOrders';

const tabs = [
  { key: 'categories', label: 'Danh mục', icon: Layers3 },
  { key: 'products', label: 'Sản phẩm', icon: Boxes },
  { key: 'stock', label: 'Kho hàng', icon: PackagePlus },
  { key: 'orders', label: 'Đơn hàng', icon: ShoppingCart },
];

const MarketplaceManager = () => {
  const [activeTab, setActiveTab] = useState('categories');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  
  // Biến cờ này dùng để báo hiệu cho các Tab con Reload Data khi có Socket đẩy về
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const apiUrl = api.defaults.baseURL || 'https://api.nguyenquangson.id.vn/api';
    const serverUrl = apiUrl.replace(/\/api\/?$/, '');
    
    const socket = io(serverUrl, {
      reconnectionDelayMax: 10000,
      transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
      const adminToken = localStorage.getItem('adminToken') || '';
      socket.emit('join_admin_room', { token: adminToken });
    });

    // Khi có biến động Mua Hàng, Nạp Thẻ -> Kích hoạt tăng refreshKey
    socket.on('admin_market_refresh', () => {
      setRefreshKey(prev => prev + 1);
    });

    return () => {
      setTimeout(() => socket.disconnect(), 100);
    };
  }, []);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold font-display uppercase tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">
          Cửa hàng (Marketplace)
        </h1>
        <p className="text-white/40 mt-2">Quản lý kho hàng, sản phẩm và giao dịch nội bộ</p>
      </div>

      {(notice || error) && (
        <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
          {notice && <div className="p-4 rounded-xl border border-green-500/20 bg-green-500/10 text-green-300 text-sm font-medium shadow-lg glow-green">{notice}</div>}
          {error && <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/10 text-red-300 text-sm font-medium shadow-lg glow-red">{error}</div>}
        </div>
      )}

      {/* Tabs Menu */}
      <div className="glass rounded-[24px] p-3 flex flex-wrap gap-2 shadow-lg">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => {
              setActiveTab(tab.key);
              setError('');
              setNotice('');
            }}
            className={`px-5 py-3 rounded-xl text-sm font-bold inline-flex items-center gap-3 transition-all duration-300 ${
              activeTab === tab.key
                ? 'bg-primary text-white border-transparent shadow-lg glow scale-105 z-10'
                : 'bg-white/5 text-white/50 border border-white/5 hover:bg-white/10 hover:text-white/80'
            }`}
          >
            <tab.icon className={`w-5 h-5 ${activeTab === tab.key ? 'text-white' : 'text-white/40'}`} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Render Component Corresponding to Active Tab */}
      <div className="relative min-h-[500px]">
        {activeTab === 'categories' && (
          <TabCategories 
            setError={setError} 
            setNotice={setNotice} 
            refreshKey={refreshKey} 
          />
        )}
        {activeTab === 'products' && (
          <TabProducts 
            setError={setError} 
            setNotice={setNotice} 
            refreshKey={refreshKey} 
          />
        )}
        {activeTab === 'stock' && (
          <TabStock 
            setError={setError} 
            setNotice={setNotice} 
            refreshKey={refreshKey} 
          />
        )}
        {activeTab === 'orders' && (
          <TabOrders 
            setError={setError} 
            setNotice={setNotice} 
            refreshKey={refreshKey} 
          />
        )}
      </div>
    </div>
  );
};

export default MarketplaceManager;
