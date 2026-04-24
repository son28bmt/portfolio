import React, { useEffect, useState } from 'react';
import api from '../services/api';
import {
  CircleDollarSign,
  Clock,
  FileText,
  FolderKanban,
  HeartHandshake,
  MessageSquare,
  ShoppingCart,
  TrendingUp,
  WalletCards,
} from 'lucide-react';

const formatVnd = (value) =>
  Number(value || 0).toLocaleString('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  });

const Dashboard = () => {
  const [stats, setStats] = useState({
    projects: 0,
    blogs: 0,
    messages: 0,
  });
  const [finance, setFinance] = useState({
    donateReceived: 0,
    walletReceived: 0,
    orderReceived: 0,
    totalReceived: 0,
    paidDonateCount: 0,
    paidTopupCount: 0,
    paidOrderCount: 0,
  });
  const [recentMessages, setRecentMessages] = useState([]);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const { data } = await api.get('/admin/dashboard/summary');
        setStats({
          projects: Number(data?.stats?.projects || 0),
          blogs: Number(data?.stats?.blogs || 0),
          messages: Number(data?.stats?.messages || 0),
        });
        setFinance({
          donateReceived: Number(data?.finance?.donateReceived || 0),
          walletReceived: Number(data?.finance?.walletReceived || 0),
          orderReceived: Number(data?.finance?.orderReceived || 0),
          totalReceived: Number(data?.finance?.totalReceived || 0),
          paidDonateCount: Number(data?.finance?.paidDonateCount || 0),
          paidTopupCount: Number(data?.finance?.paidTopupCount || 0),
          paidOrderCount: Number(data?.finance?.paidOrderCount || 0),
        });
        setRecentMessages(Array.isArray(data?.recentMessages) ? data.recentMessages : []);
      } catch (err) {
        console.error('Lỗi khi lấy dữ liệu dashboard:', err);
      }
    };

    fetchDashboard();
  }, []);

  const cards = [
    { label: 'Dự án', value: stats.projects, icon: FolderKanban, color: 'text-primary', bg: 'bg-primary/10' },
    { label: 'Bài blog', value: stats.blogs, icon: FileText, color: 'text-secondary', bg: 'bg-secondary/10' },
    { label: 'Tin nhắn', value: stats.messages, icon: MessageSquare, color: 'text-accent', bg: 'bg-accent/10' },
  ];

  const financeCards = [
    {
      label: 'Tổng tiền đã nhận',
      value: formatVnd(finance.totalReceived),
      meta: `${finance.paidOrderCount + finance.paidTopupCount + finance.paidDonateCount} giao dịch đã ghi nhận`,
      icon: CircleDollarSign,
      color: 'text-emerald-300',
      bg: 'bg-emerald-500/10',
    },
    {
      label: 'Tiền đơn hàng',
      value: formatVnd(finance.orderReceived),
      meta: `${finance.paidOrderCount} đơn hàng QR`,
      icon: ShoppingCart,
      color: 'text-cyan-300',
      bg: 'bg-cyan-500/10',
    },
    {
      label: 'Tiền nạp quỹ',
      value: formatVnd(finance.walletReceived),
      meta: `${finance.paidTopupCount} lệnh nạp thành công`,
      icon: WalletCards,
      color: 'text-violet-300',
      bg: 'bg-violet-500/10',
    },
    {
      label: 'Tiền donate',
      value: formatVnd(finance.donateReceived),
      meta: `${finance.paidDonateCount} lượt donate`,
      icon: HeartHandshake,
      color: 'text-pink-300',
      bg: 'bg-pink-500/10',
    },
  ];

  return (
    <div className="space-y-10">
      <div>
        <h1 className="mb-2 text-3xl font-bold">Xin chào, Admin!</h1>
        <p className="text-white/40">Đây là những gì đang diễn ra trong hệ thống của bạn.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {cards.map((card, i) => (
          <div key={i} className="glass flex items-center gap-6 rounded-[24px] p-6 transition-all group hover:border-white/20">
            <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${card.bg} ${card.color} transition-transform group-hover:scale-110`}>
              <card.icon className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-bold uppercase tracking-wider text-white/40">{card.label}</p>
              <h3 className="mt-1 text-3xl font-bold">{card.value}</h3>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        <div>
          <h2 className="text-2xl font-bold">Tổng tiền đã nhận</h2>
          <p className="mt-2 text-sm text-white/45">
            Dashboard này tách riêng tiền đơn hàng qua QR, tiền nạp quỹ và tiền donate để bạn theo dõi nhanh.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
          {financeCards.map((card, i) => (
            <div key={i} className="glass space-y-4 rounded-[24px] border border-white/10 p-6 transition-all hover:border-white/20">
              <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${card.bg} ${card.color}`}>
                <card.icon className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-bold uppercase tracking-wider text-white/45">{card.label}</p>
                <h3 className="mt-2 text-2xl font-black">{card.value}</h3>
                <p className="mt-2 text-sm text-white/45">{card.meta}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
        <div className="glass overflow-hidden rounded-[32px]">
          <div className="flex items-center justify-between border-b border-white/5 p-6">
            <h3 className="flex items-center gap-2 font-bold">
              <MessageSquare className="h-5 w-5 text-accent" /> Tin nhắn mới nhất
            </h3>
            <button className="text-xs font-bold text-accent hover:underline">Xem tất cả</button>
          </div>
          <div className="space-y-4 p-6">
            {recentMessages.length > 0 ? (
              recentMessages.map((msg) => (
                <div key={msg.id} className="flex items-start justify-between rounded-2xl border border-white/5 bg-white/5 p-4">
                  <div>
                    <p className="mb-1 text-sm font-bold">{msg.name}</p>
                    <p className="max-w-[200px] truncate text-xs text-white/40">{msg.message}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="flex items-center gap-1 text-[10px] text-white/20">
                      <Clock className="h-3 w-3" />
                      {new Date(msg.createdAt).toLocaleDateString()}
                    </span>
                    {msg.status === 'unread' && <span className="h-2 w-2 rounded-full bg-accent animate-pulse" />}
                  </div>
                </div>
              ))
            ) : (
              <p className="py-10 text-center text-sm italic text-white/20">Chưa có tin nhắn nào</p>
            )}
          </div>
        </div>

        <div className="flex flex-col items-center justify-center space-y-6 rounded-[32px] border border-white/10 bg-gradient-to-br from-primary/20 to-secondary/20 p-10 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full border border-white/20 bg-white/10 shadow-2xl backdrop-blur-xl">
            <TrendingUp className="h-10 w-10 text-white" />
          </div>
          <div>
            <h3 className="mb-2 text-2xl font-bold">Hệ thống sẵn sàng</h3>
            <p className="max-w-xs text-sm leading-relaxed text-white/60">
              Mọi thứ đều ổn định. Bạn có thể theo dõi cả nội dung lẫn dòng tiền ngay trên dashboard này.
            </p>
          </div>
          <button className="rounded-full bg-white px-8 py-3 text-sm font-bold text-black transition-transform hover:scale-105">
            Bắt đầu bài viết mới
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
