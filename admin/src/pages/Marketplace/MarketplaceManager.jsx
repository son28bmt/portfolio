import React, { useEffect, useState } from 'react';
import {
  ActivitySquare,
  Boxes,
  Layers3,
  PackagePlus,
  ShoppingCart,
  WalletCards,
  Wrench,
} from 'lucide-react';
import { io } from 'socket.io-client';
import api from '../../services/api';

import TabCategories from './components/TabCategories';
import TabOrders from './components/TabOrders';
import TabProducts from './components/TabProducts';
import TabStock from './components/TabStock';
import TabSupplier from './components/TabSupplier';
import TabWallet from './components/TabWallet';
import TabMaintenance from './components/TabMaintenance';

const tabs = [
  { key: 'supplier', label: 'Nhà cung cấp', icon: ActivitySquare },
  { key: 'categories', label: 'Danh mục', icon: Layers3 },
  { key: 'products', label: 'Sản phẩm', icon: Boxes },
  { key: 'stock', label: 'Kho hàng', icon: PackagePlus },
  { key: 'orders', label: 'Đơn hàng', icon: ShoppingCart },
  { key: 'wallet', label: 'Quỹ nội bộ', icon: WalletCards },
  { key: 'maintenance', label: 'Bảo trì', icon: Wrench },
];

const MarketplaceManager = () => {
  const [activeTab, setActiveTab] = useState('supplier');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const apiUrl = api.defaults.baseURL || 'https://api.nguyenquangson.id.vn/api';
    const serverUrl = apiUrl.replace(/\/api\/?$/, '');

    const socket = io(serverUrl, {
      reconnectionDelayMax: 10000,
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      const adminToken = localStorage.getItem('adminToken') || '';
      socket.emit('join_admin_room', { token: adminToken });
    });

    socket.on('admin_market_refresh', () => {
      setRefreshKey((prev) => prev + 1);
    });

    socket.on('admin_wallet_refresh', () => {
      setRefreshKey((prev) => prev + 1);
    });

    return () => {
      setTimeout(() => socket.disconnect(), 100);
    };
  }, []);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="bg-gradient-to-r from-primary to-secondary bg-clip-text font-display text-3xl font-bold uppercase tracking-wider text-transparent">
          Quản lý cửa hàng
        </h1>
        <p className="mt-2 text-white/40">
          Khu quản trị chung cho danh mục, sản phẩm, đơn hàng, nhà cung cấp và quỹ nội bộ.
        </p>
      </div>

      {(notice || error) && (
        <div className="animate-in fade-in slide-in-from-top-2 space-y-2">
          {notice && (
            <div className="rounded-xl border border-green-500/20 bg-green-500/10 p-4 text-sm font-medium text-green-300 shadow-lg">
              {notice}
            </div>
          )}
          {error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm font-medium text-red-300 shadow-lg">
              {error}
            </div>
          )}
        </div>
      )}

      <div className="glass flex flex-wrap gap-2 rounded-[24px] p-3 shadow-lg">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => {
              setActiveTab(tab.key);
              setError('');
              setNotice('');
            }}
            className={`inline-flex items-center gap-3 rounded-xl px-5 py-3 text-sm font-bold transition-all duration-300 ${
              activeTab === tab.key
                ? 'z-10 scale-105 border-transparent bg-primary text-white shadow-lg glow'
                : 'border border-white/5 bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/80'
            }`}
          >
            <tab.icon className={`h-5 w-5 ${activeTab === tab.key ? 'text-white' : 'text-white/40'}`} />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="relative min-h-[500px]">
        {activeTab === 'supplier' && (
          <TabSupplier setError={setError} setNotice={setNotice} refreshKey={refreshKey} />
        )}
        {activeTab === 'categories' && (
          <TabCategories setError={setError} setNotice={setNotice} refreshKey={refreshKey} />
        )}
        {activeTab === 'products' && (
          <TabProducts setError={setError} setNotice={setNotice} refreshKey={refreshKey} />
        )}
        {activeTab === 'stock' && (
          <TabStock setError={setError} setNotice={setNotice} refreshKey={refreshKey} />
        )}
        {activeTab === 'orders' && (
          <TabOrders setError={setError} setNotice={setNotice} refreshKey={refreshKey} />
        )}
        {activeTab === 'wallet' && (
          <TabWallet setError={setError} setNotice={setNotice} refreshKey={refreshKey} />
        )}
        {activeTab === 'maintenance' && (
          <TabMaintenance setError={setError} setNotice={setNotice} refreshKey={refreshKey} />
        )}
      </div>
    </div>
  );
};

export default MarketplaceManager;
