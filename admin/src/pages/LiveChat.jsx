import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { 
  MessageSquare, 
  User, 
  Send, 
  Clock, 
  Circle, 
  Headphones, 
  ChevronRight,
  ShieldCheck,
  Search,
  Bell,
  BellOff,
  CheckCircle2,
  Trash2,
  MoreVertical
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';

const normalizeChatMessage = message => ({
  ...message,
  messageType: message.messageType || (message.questionSnapshot ? 'guide_question' : 'text'),
  replyContext: message.replyContext || null,
  guideContext: message.guideContext || null,
  questionSnapshot: message.questionSnapshot || null,
});

const LiveChat = () => {
  const [sessions, setSessions] = useState([]); // Array of { guestId, name, email, lastMessageAt, unreadCount }
  const [activeChatId, setActiveChatId] = useState(null);
  const [messages, setMessages] = useState([]); // Current active chat messages
  const [input, setInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isNotificationsEnabled, setIsNotificationsEnabled] = useState(true);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [purchase, setPurchase] = useState(null);
  const [purchaseForm, setPurchaseForm] = useState({ purchaseStatus: 'unknown', packageType: '', printerModel: '', assignmentNotes: '' });
  const [purchaseError, setPurchaseError] = useState('');
  const [replyTarget, setReplyTarget] = useState(null);
  const [completionNotice, setCompletionNotice] = useState('');
  const [sessionLoadError, setSessionLoadError] = useState('');
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  
  const socketRef = useRef();
  const messagesEndRef = useRef(null);
  const activeChatIdRef = useRef(null);
  const isNotificationsEnabledRef = useRef(true);

  // Keep refs in sync with state
  useEffect(() => {
    activeChatIdRef.current = activeChatId;
  }, [activeChatId]);

  useEffect(() => {
    isNotificationsEnabledRef.current = isNotificationsEnabled;
  }, [isNotificationsEnabled]);

  useEffect(() => {
    const getSocketUrl = () => {
      const vBaseUrl = import.meta.env.VITE_API_BASE_URL || '';
      const vSocketUrl = import.meta.env.VITE_SOCKET_URL || '';

      if (vSocketUrl) return vSocketUrl;

      // Handle common 'https' error or empty fallback
      if (vBaseUrl === 'https' || !vBaseUrl) {
        if (window.location.hostname !== 'localhost') {
          return 'https://api.nguyenquangson.id.vn';
        }
        return 'http://localhost:5000';
      }

      try {
        const urlObj = new URL(vBaseUrl);
        if (urlObj.origin === 'https' || urlObj.hostname === 'https') {
          return 'https://api.nguyenquangson.id.vn';
        }
        return urlObj.origin;
      } catch {
        if (window.location.hostname !== 'localhost') {
          return 'https://api.nguyenquangson.id.vn';
        }
        return window.location.origin;
      }
    };

    const socketUrl = getSocketUrl();
    console.log('[AdminSocket] Connecting to:', socketUrl);

    socketRef.current = io(socketUrl, {
      withCredentials: true,
      transports: ['websocket', 'polling']
    });

    socketRef.current.on('connect', () => {
      console.log('[AdminSocket] Connected as admin');
      setSessionLoadError('');
      setIsLoadingSessions(true);
      const adminToken = localStorage.getItem('adminToken') || '';
      socketRef.current.emit('join_admin_room', { token: adminToken });
    });

    socketRef.current.on('admin_auth_error', ({ message }) => {
      setIsLoadingSessions(false);
      setSessionLoadError(message || 'Phiên admin hết hạn. Hãy đăng nhập lại.');
    });

    socketRef.current.on('init_sessions', (data) => {
      console.log('[AdminSocket] Received sessions:', data.length);
      setIsLoadingSessions(false);
      setSessionLoadError('');
      setSessions(data.map(s => ({
        ...s,
        unreadCount: parseInt(s.unreadCount) || 0
      })));
    });

    socketRef.current.on('session_load_error', ({ message }) => {
      setIsLoadingSessions(false);
      setSessionLoadError(message || 'Không tải được danh sách hội thoại.');
    });

    socketRef.current.on('connect_error', (error) => {
      setIsLoadingSessions(false);
      setSessionLoadError(`Không kết nối được máy chủ chat: ${error.message}`);
    });

    socketRef.current.on('new_user_message', (data) => {
      const { id, guestId, text, name, email, purchase, messageType, questionSnapshot, guideContext, timestamp, isAccountChat } = data;
      console.log('[AdminSocket] New user message from:', guestId);
      
      setSessions(prev => {
        const index = prev.findIndex(s => s.guestId === guestId);
        if (index !== -1) {
          const updated = [...prev];
          updated[index] = {
            ...updated[index],
            lastMessageAt: timestamp,
            purchase: purchase || updated[index].purchase,
            lastMessageType: messageType || (questionSnapshot ? 'guide_question' : 'text'),
            guideContext: guideContext || updated[index].guideContext,
            questionSnapshot: questionSnapshot || updated[index].questionSnapshot,
            isAccountChat: Boolean(isAccountChat || updated[index].isAccountChat),
            guestCleanupAt: null,
            unreadCount: activeChatIdRef.current === guestId ? 0 : (updated[index].unreadCount + 1)
          };
          const session = updated.splice(index, 1)[0];
          return [session, ...updated];
        } else {
          return [{
            guestId,
            name: name || guestId,
            email: email || 'N/A',
            purchase,
            lastMessageAt: timestamp,
            lastMessageType: messageType || (questionSnapshot ? 'guide_question' : 'text'),
            guideContext,
            questionSnapshot,
            isAccountChat: Boolean(isAccountChat),
            guestCleanupAt: null,
            unreadCount: activeChatIdRef.current === guestId ? 0 : 1
          }, ...prev];
        }
      });

      if (activeChatIdRef.current === guestId) {
        setMessages(prev => [...prev, normalizeChatMessage({ id, role: 'user', content: text, messageType: questionSnapshot ? 'guide_question' : 'text', questionSnapshot, guideContext, createdAt: timestamp })]);
        socketRef.current.emit('mark_as_read', { guestId });
      }

      if (isNotificationsEnabledRef.current) {
        new Audio('/notification.mp3').play().catch(() => {});
      }
    });

    socketRef.current.on('guest_support_completed', ({ guestId, guestCleanupAt }) => {
      setSessions(prev => prev.map(session => session.guestId === guestId ? { ...session, guestCleanupAt } : session));
    });

    socketRef.current.on('guest_chat_deleted', ({ guestId }) => {
      setSessions(prev => prev.filter(session => session.guestId !== guestId));
      if (activeChatIdRef.current === guestId) {
        setActiveChatId(null);
        setMessages([]);
      }
    });

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, []); // Only connect once on mount

  useEffect(() => {
    if (activeChatId) {
      setReplyTarget(null);
      setCompletionNotice('');
      loadChatHistory(activeChatId);
    }
  }, [activeChatId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadChatHistory = async (guestId) => {
    setIsLoadingHistory(true);
    try {
      const { data } = await api.get(`/chat/history/${guestId}`);
      const sessionHasQuestion = sessions.find(s => s.guestId === guestId)?.lastMessageType === 'guide_question';
      let lastQuestionId = null;
      if (sessionHasQuestion) {
        for (let index = data.length - 1; index >= 0; index -= 1) {
          if (data[index].questionSnapshot) {
            lastQuestionId = data[index].id;
            break;
          }
        }
      }
      const normalizedMessages = data.map(message => normalizeChatMessage(
        lastQuestionId && message.id === lastQuestionId
          ? { ...message, messageType: 'guide_question' }
          : message,
      ));
      setMessages(normalizedMessages);
      const lastQuestion = [...normalizedMessages].reverse().find(message => message.questionSnapshot);
      if (lastQuestion) {
        setSessions(prev => prev.map(session => session.guestId === guestId ? {
          ...session,
          lastMessageType: 'guide_question',
          guideContext: lastQuestion.guideContext,
          questionSnapshot: lastQuestion.questionSnapshot,
        } : session));
      }
      const purchaseResponse = await api.get(`/chat/purchase-status/${guestId}`);
      setPurchase(purchaseResponse.data);
      setPurchaseForm({
        purchaseStatus: purchaseResponse.data.purchaseStatus || 'unknown',
        packageType: purchaseResponse.data.packageType || '',
        printerModel: purchaseResponse.data.printerModel || '',
        assignmentNotes: purchaseResponse.data.assignmentNotes || '',
      });
      setSessions(prev => prev.map(s => s.guestId === guestId ? { ...s, unreadCount: 0 } : s));
      socketRef.current.emit('mark_as_read', { guestId });
      await api.put(`/chat/read/${guestId}`);
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const savePurchaseStatus = async (event) => {
    event.preventDefault();
    if (!activeChatId) return;
    setPurchaseError('');
    try {
      const { data } = await api.patch(`/chat/purchase-status/${activeChatId}`, purchaseForm);
      setPurchase(data);
    } catch (error) {
      setPurchaseError(error.response?.data?.message || 'Không thể cập nhật trạng thái khách mua.');
    }
  };

  const completeGuestSupport = async () => {
    if (!activeChatId || activeSession?.isAccountChat) return;
    setCompletionNotice('');
    try {
      const { data } = await api.post(`/chat/complete/${activeChatId}`);
      setSessions(prev => prev.map(session => session.guestId === activeChatId ? { ...session, guestCleanupAt: data.guestCleanupAt } : session));
      setCompletionNotice('Đã kết thúc hỗ trợ. Hội thoại guest sẽ được xóa sau 10 phút.');
    } catch (error) {
      setCompletionNotice(error.response?.data?.message || 'Không thể kết thúc hỗ trợ.');
    }
  };

  const retryLoadSessions = () => {
    if (!socketRef.current?.connected) {
      socketRef.current?.connect();
      return;
    }
    setSessionLoadError('');
    setIsLoadingSessions(true);
    socketRef.current.emit('join_admin_room', { token: localStorage.getItem('adminToken') || '' });
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || !activeChatId) return;

    const text = input.trim();
    const replyContext = replyTarget ? {
      requestId: replyTarget.id,
      requestNumber: replyTarget.questionSnapshot?.requestNumber || String(replyTarget.id || '').replace(/-/g, '').slice(-8).toUpperCase(),
      guideTitle: replyTarget.guideContext?.title,
      guideSlug: replyTarget.guideContext?.slug,
    } : null;
    socketRef.current.emit('send_to_user', { guestId: activeChatId, text, replyContext });

    const now = new Date();
    setMessages(prev => [...prev, { role: 'admin', content: text, createdAt: now, replyContext }]);
    setInput('');
    setReplyTarget(null);
    setSessions(prev => prev.map(s => s.guestId === activeChatId ? { ...s, lastMessageAt: now } : s));
  };

  const filteredSessions = sessions.filter(s => 
    s.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.guestId?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const activeSession = sessions.find(s => s.guestId === activeChatId);

  return (
    <div className="h-[calc(100vh-4rem)] min-h-0 w-full flex flex-col lg:flex-row gap-4 px-4 py-4 lg:px-5">
      <div className="w-full lg:w-[21rem] xl:w-[23rem] min-w-0 flex flex-col gap-4 border-r border-white/5 pr-0 lg:pr-4 shrink-0">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-xl md:text-2xl font-black flex items-center gap-3 uppercase tracking-tighter">
             Live <span className="text-primary italic">Support</span>
          </h1>
          <button 
            onClick={() => setIsNotificationsEnabled(!isNotificationsEnabled)}
            className={`p-2.5 rounded-2xl border transition-all ${isNotificationsEnabled ? 'bg-primary/10 border-primary/20 text-primary' : 'bg-white/5 border-white/10 text-white/20'}`}
          >
            {isNotificationsEnabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
          </button>
        </div>

        <div className="relative mb-2">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
          <input 
            type="text" 
            placeholder="Tìm kiếm khách hàng..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-white/[0.03] border border-white/10 rounded-2xl pl-11 pr-4 py-3.5 text-sm focus:border-primary outline-none transition-all placeholder:text-white/10"
          />
        </div>

        <div className="flex-grow overflow-y-auto space-y-2.5 custom-scrollbar pr-2">
          {filteredSessions.length === 0 ? (
            <div className="text-center py-20 border border-dashed border-white/5 rounded-[40px] text-white/10 text-xs uppercase tracking-widest font-bold">
              {isLoadingSessions ? 'Đang tải hội thoại...' : sessionLoadError ? <div className="space-y-3 px-5 normal-case tracking-normal"><p className="text-red-300">{sessionLoadError}</p><button type="button" onClick={retryLoadSessions} className="rounded-lg border border-white/15 px-3 py-2 text-white/70 hover:bg-white/5">Thử tải lại</button></div> : 'Chưa có hội thoại'}
            </div>
          ) : filteredSessions.map(session => (
            <button
              key={session.guestId}
              onClick={() => setActiveChatId(session.guestId)}
              className={`w-full p-4 rounded-[30px] flex items-center gap-4 transition-all text-left border relative group ${
                activeChatId === session.guestId 
                ? 'bg-primary/10 border-primary/20 shadow-[0_15px_30px_-10px_rgba(var(--primary-rgb),0.3)]' 
                : 'bg-white/[0.02] border-transparent hover:bg-white/[0.05]'
              }`}
            >
              <div className="w-12 h-12 rounded-[20px] bg-white/5 border border-white/5 flex items-center justify-center font-black text-primary shadow-inner">
                  {session.name?.charAt(0).toUpperCase() || '?'}
              </div>
              <div className="flex-grow min-w-0">
                <div className="flex justify-between items-center mb-1">
                  <h3 className="font-bold text-sm truncate">{session.name || 'Guest User'}</h3>
                  <span className="text-[9px] text-white/20 font-medium">
                    {new Date(session.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                    <p className="text-[11px] text-white/30 truncate uppercase tracking-tighter font-medium italic">{session.isAccountChat ? `Tài khoản · ${session.email || session.guestId.slice(-6)}` : `Guest ID: ${session.guestId.slice(-6)}`}</p>
                 {session.lastMessageType === 'guide_question' && <p className="mt-1 text-[9px] font-bold uppercase text-secondary">Câu hỏi từ bài hướng dẫn</p>}
                 <p className={`mt-1 text-[9px] font-bold uppercase tracking-wider ${session.purchase?.purchaseStatus === 'purchased' ? 'text-emerald-300' : session.purchase?.purchaseStatus === 'not_purchased' ? 'text-amber-300' : 'text-white/25'}`}>{session.purchase?.purchaseStatus === 'purchased' ? 'Đã mua' : session.purchase?.purchaseStatus === 'not_purchased' ? 'Chưa mua' : 'Chưa xác định'}</p>
              </div>
              {session.unreadCount > 0 && (
                <div className="absolute top-4 right-4 w-5 h-5 bg-primary text-white text-[10px] font-black rounded-full flex items-center justify-center animate-bounce shadow-lg shadow-primary/40">
                  {session.unreadCount}
                </div>
              )}
              <ChevronRight className={`w-4 h-4 transition-transform group-hover:translate-x-1 ${activeChatId === session.guestId ? 'text-primary' : 'text-white/5'}`} />
            </button>
          ))}
        </div>
      </div>

      <div className="min-w-0 flex-1 flex flex-col glass rounded-[28px] border border-white/5 overflow-hidden shadow-2xl relative">
        <AnimatePresence mode="wait">
          {activeSession ? (
            <motion.div 
              key={activeChatId}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex-grow flex flex-col h-full"
            >
              <div className="p-5 md:p-6 border-b border-white/5 bg-white/[0.02] flex items-center justify-between backdrop-blur-3xl">
                <div className="flex items-center gap-5">
                  <div className="w-14 h-14 rounded-[24px] bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-black text-xl shadow-lg">
                    {activeSession.name?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-black text-lg md:text-xl uppercase tracking-tighter">{activeSession.name}</h3>
                    <p className="text-[11px] text-white/40 flex items-center gap-2 font-medium">
                      <ShieldCheck className="w-3.5 h-3.5 text-green-400" /> {activeSession.email} • {activeChatId}
                    </p>
                    <p className="mt-2 text-xs font-bold uppercase tracking-wider">
                      {purchase?.purchaseStatus === 'purchased' ? <span className="text-emerald-300">Đã mua</span> : purchase?.purchaseStatus === 'not_purchased' ? <span className="text-amber-300">Chưa mua</span> : <span className="text-white/40">Chưa xác định</span>}
                      {purchase?.automaticPurchase && <span className="ml-2 text-[10px] text-white/40">(tự động)</span>}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                   <div className="hidden md:flex flex-col text-right mr-4">
                      <div className="text-[9px] text-white/20 font-bold uppercase tracking-widest">Connection</div>
                      <div className="text-[10px] text-green-400 font-black uppercase">Established</div>
                   </div>
                   {!activeSession.isAccountChat && <button type="button" onClick={completeGuestSupport} title="Kết thúc hỗ trợ và xóa hội thoại guest sau 10 phút" className="rounded-[18px] border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-[10px] font-bold uppercase text-amber-200 hover:bg-amber-300/20">
                      <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" />Đã hỗ trợ xong
                   </button>}
                   <button className="w-12 h-12 bg-white/5 rounded-[20px] flex items-center justify-center hover:bg-white/10 transition-all border border-white/5 shadow-lg">
                      <MoreVertical className="w-5 h-5 text-white/20" />
                   </button>
                </div>
              </div>

              <div className="min-h-0 flex-1 p-5 md:p-7 overflow-y-auto space-y-6 custom-scrollbar bg-black/10">
                {(completionNotice || activeSession.guestCleanupAt) && <p className="rounded-xl border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-xs text-amber-100">{completionNotice || `Đã kết thúc hỗ trợ. Hội thoại guest sẽ được xóa lúc ${new Date(activeSession.guestCleanupAt).toLocaleTimeString()}.`}</p>}
                {isLoadingHistory && (
                  <div className="flex justify-center py-10">
                    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
                {messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'admin' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-4 duration-500`}>
                  <div className="max-w-[85%] md:max-w-[70%] space-y-2">
                      <div className={`p-4 md:p-5 rounded-[30px] text-[13px] md:text-sm leading-relaxed shadow-xl border ${
                        msg.role === 'admin' 
                        ? 'bg-primary text-white rounded-tr-none border-white/10' 
                        : 'bg-white/[0.06] text-white/90 border-white/5 rounded-tl-none backdrop-blur-md'
                      }`}>
                        {msg.replyContext?.requestNumber && <p className="mb-2 text-[10px] font-bold uppercase text-secondary">Phản hồi yêu cầu #{msg.replyContext.requestNumber}{msg.replyContext.guideTitle ? ` từ bài ${msg.replyContext.guideTitle}` : ''}</p>}
       {msg.messageType === 'guide_question' ? <div className="space-y-3"><p className="font-bold">Yêu cầu #{msg.questionSnapshot?.requestNumber || String(msg.id || '').replace(/-/g, '').slice(-8).toUpperCase()} từ bài: {msg.guideContext?.title || 'Hướng dẫn'}</p>{msg.guideContext?.slug && <a className="text-xs text-secondary underline" href={`https://nguyenquangson.id.vn/huong-dan/${encodeURIComponent(msg.guideContext.slug)}`} target="_blank" rel="noreferrer">Mở bài hướng dẫn</a>}{msg.questionSnapshot?.fields?.length ? msg.questionSnapshot.fields.map((field, fieldIndex) => <div key={`${field.key}-${fieldIndex}`}><p className="text-[10px] font-bold uppercase opacity-60">{field.label}</p><p className="whitespace-pre-wrap">{field.value || '(bỏ trống)'}</p></div>) : <p className="whitespace-pre-wrap">{msg.content || 'Nội dung yêu cầu không còn trong snapshot.'}</p>}<button type="button" onClick={() => setReplyTarget(msg)} className="mt-2 rounded-lg bg-secondary px-3 py-2 text-xs font-bold text-white">Phản hồi yêu cầu #{msg.questionSnapshot?.requestNumber || String(msg.id || '').replace(/-/g, '').slice(-8).toUpperCase()}</button></div> : msg.content}
                      </div>
                      <div className={`text-[9px] text-white/10 font-bold uppercase tracking-widest ${msg.role === 'admin' ? 'text-right' : 'text-left'}`}>
                        {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString() : ''}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              <form onSubmit={savePurchaseStatus} className="border-t border-white/5 bg-white/[0.02] p-4 space-y-3">
                <div className="grid gap-3 md:grid-cols-3">
                  <select value={purchaseForm.purchaseStatus} onChange={e => setPurchaseForm(f => ({ ...f, purchaseStatus: e.target.value }))} className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs">
                    <option value="unknown">Chưa xác định</option><option value="purchased">Đã mua</option><option value="not_purchased">Chưa mua</option>
                  </select>
                  <input value={purchaseForm.packageType} onChange={e => setPurchaseForm(f => ({ ...f, packageType: e.target.value }))} placeholder="Gói phần mềm" className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs" />
                  <input value={purchaseForm.printerModel} onChange={e => setPurchaseForm(f => ({ ...f, printerModel: e.target.value }))} placeholder="Model máy in" className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs" />
                </div>
                <div className="flex gap-3"><input value={purchaseForm.assignmentNotes} onChange={e => setPurchaseForm(f => ({ ...f, assignmentNotes: e.target.value }))} placeholder="Ghi chú gán khách" className="min-w-0 flex-grow rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs" /><button className="rounded-xl bg-secondary px-4 py-2 text-xs font-bold text-white">Lưu nhãn</button></div>
                {purchaseError && <p className="text-xs text-red-300">{purchaseError}</p>}
              </form>

              <div className="p-4 md:p-5 bg-white/[0.03] border-t border-white/5 backdrop-blur-3xl shrink-0">
                {replyTarget && <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-secondary/30 bg-secondary/10 px-3 py-2 text-xs"><span>Đang phản hồi yêu cầu #{replyTarget.questionSnapshot?.requestNumber || String(replyTarget.id || '').replace(/-/g, '').slice(-8).toUpperCase()}{replyTarget.guideContext?.title ? ` từ bài ${replyTarget.guideContext.title}` : ''}</span><button type="button" onClick={() => setReplyTarget(null)} aria-label="Hủy phản hồi" className="text-white/60 hover:text-white">×</button></div>}
                <form onSubmit={handleSend} className="flex gap-4 items-center">
                  <div className="flex-grow bg-black/40 border border-white/10 rounded-[28px] focus-within:border-primary/50 transition-all duration-500 px-2 group">
                    <input 
                      type="text" 
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      placeholder="Type a premium response..."
                      className="w-full bg-transparent px-6 py-5 text-sm outline-none placeholder:text-white/5 font-medium"
                    />
                  </div>
                  <button 
                    type="submit"
                    className="w-16 h-16 bg-primary text-white rounded-[28px] flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-[0_20px_40px_-10px_rgba(var(--primary-rgb),0.5)] group overflow-hidden relative border border-white/10"
                  >
                    <Send className="w-6 h-6 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform duration-500" />
                    <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                </form>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex-grow flex flex-col items-center justify-center text-center p-12 space-y-10"
            >
              <div className="relative">
                 <div className="w-32 h-32 md:w-40 md:h-40 bg-white/[0.02] rounded-[60px] flex items-center justify-center border border-white/5 shadow-inner animate-pulse">
                    <MessageSquare className="w-12 h-12 md:w-16 md:h-16 text-white/5" />
                 </div>
                 <div className="absolute -top-2 -right-2 w-12 h-12 bg-primary/20 rounded-full blur-2xl animate-pulse" />
              </div>
              <div className="space-y-3">
                <h2 className="text-2xl md:text-4xl font-black uppercase tracking-tighter">Command <span className="text-primary italic">Center</span></h2>
                <p className="text-[11px] md:text-xs text-white/20 max-w-sm mx-auto uppercase tracking-[0.3em] font-bold leading-relaxed">
                  Select a guest perspective to begin real-time engagement and support synchronization.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { 
          background: rgba(255,255,255,0.05); 
          border-radius: 10px; 
          transition: background 0.3s;
        }
        .custom-scrollbar:hover::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.1);
        }
        .glass { 
          background: rgba(12, 12, 12, 0.7) !important; 
          backdrop-filter: blur(60px) saturate(200%) brightness(0.8) !important;
          -webkit-backdrop-filter: blur(60px) saturate(200%) brightness(0.8) !important;
        }
      `}</style>
    </div>
  );
};

export default LiveChat;
