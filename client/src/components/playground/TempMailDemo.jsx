import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  Download,
  Inbox,
  Loader2,
  MailPlus,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import api from '../../services/api';

const STORAGE_KEY = 'playground_tempmail_session_v1';

const extractSession = (payload = {}) => {
  const sidToken = String(payload.sid_token || '').trim();
  const emailAddr = String(payload.email_addr || '').trim();
  if (!sidToken || !emailAddr) return null;

  return {
    sid_token: sidToken,
    email_addr: emailAddr,
    email_user: String(payload.email_user || '').trim(),
    email_domain: String(payload.email_domain || '').trim(),
    session_started_at: Number(payload.session_started_at || 0),
    session_expires_at: Number(payload.session_expires_at || 0),
    session_ttl_minutes: Number(payload.session_ttl_minutes || 0),
  };
};

const readStoredSession = () => {
  try {
    if (typeof window === 'undefined') return null;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return extractSession(parsed);
  } catch {
    return null;
  }
};

const saveStoredSession = (session) => {
  try {
    if (typeof window === 'undefined') return;
    if (!session) {
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // no-op
  }
};

const formatSessionExpire = (rawMs) => {
  const ms = Number(rawMs || 0);
  if (!Number.isFinite(ms) || ms <= 0) return '--';
  return new Date(ms).toLocaleString('vi-VN');
};

const formatMailTime = (rawTimestamp) => {
  const sec = Number(rawTimestamp);
  if (!Number.isFinite(sec) || sec <= 0) return '--';
  return new Date(sec * 1000).toLocaleString('vi-VN');
};

const TempMailDemo = () => {
  const [domains, setDomains] = useState([]);
  const [selectedDomain, setSelectedDomain] = useState('');
  const [session, setSession] = useState(() => readStoredSession());
  const [customUser, setCustomUser] = useState('');
  const [mailboxToOpen, setMailboxToOpen] = useState('');
  const [emails, setEmails] = useState([]);
  const [activeEmail, setActiveEmail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingList, setLoadingList] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const recoveringRef = useRef(null);

  const sidToken = String(session?.sid_token || '').trim();

  const setSessionAndPersist = (nextSession) => {
    setSession(nextSession);
    saveStoredSession(nextSession);
  };

  const resetNotice = () => {
    setMessage('');
    setError('');
  };

  const fetchDomains = async () => {
    const { data } = await api.get('/tempmail/domains');
    const list = Array.isArray(data?.domains)
      ? data.domains.map((d) => String(d || '').trim()).filter(Boolean)
      : [];
    setDomains(list);

    const fallback = String(data?.defaultDomain || '').trim();
    if (fallback && list.includes(fallback)) {
      setSelectedDomain((prev) => prev || fallback);
    } else if (!selectedDomain && list.length > 0) {
      setSelectedDomain(list[0]);
    }
  };

  const recoverSessionIfExpired = async ({ silent = true } = {}) => {
    if (recoveringRef.current) return recoveringRef.current;

    const run = (async () => {
      const mailboxEmail = String(session?.email_addr || '').trim().toLowerCase();
      const domainHint =
        selectedDomain || String(session?.email_domain || '').trim() || undefined;

      try {
        if (mailboxEmail) {
          const { data } = await api.post('/tempmail/open', {
            email_addr: mailboxEmail,
            sid_token: sidToken || undefined,
            force_takeover: true,
            lang: 'vi',
          });
          const recovered = extractSession(data);
          if (recovered) {
            setSessionAndPersist(recovered);
            if (recovered.email_domain) setSelectedDomain(recovered.email_domain);
            if (!silent) setMessage('Đã làm mới phiên mailbox tự động.');
            return recovered;
          }
        }

        const { data } = await api.post('/tempmail/address', {
          email_domain: domainHint,
          lang: 'vi',
        });
        const renewed = extractSession(data);
        if (renewed) {
          setSessionAndPersist(renewed);
          if (renewed.email_domain) setSelectedDomain(renewed.email_domain);
          if (!silent) setMessage('Phiên cũ hết hạn, hệ thống đã tạo phiên mới.');
          return renewed;
        }
      } catch {
        // handled below
      }

      setSessionAndPersist(null);
      setEmails([]);
      setActiveEmail(null);
      if (!silent) setError('Phiên mailbox đã hết hạn, vui lòng tạo mailbox mới.');
      return null;
    })().finally(() => {
      recoveringRef.current = null;
    });

    recoveringRef.current = run;
    return run;
  };

  const refreshInbox = async (token = sidToken, { silent = false } = {}) => {
    if (!token) return;
    if (!silent) {
      setLoadingList(true);
      resetNotice();
    }

    try {
      const { data } = await api.post('/tempmail/list', {
        sid_token: token,
        offset: 0,
      });
      const list = Array.isArray(data?.list) ? data.list : [];
      setEmails(list);
    } catch (err) {
      const status = Number(err?.response?.status || 0);
      if (status === 401) {
        const recovered = await recoverSessionIfExpired({ silent });
        if (recovered?.sid_token && recovered.sid_token !== token) {
          try {
            const { data } = await api.post('/tempmail/list', {
              sid_token: recovered.sid_token,
              offset: 0,
            });
            setEmails(Array.isArray(data?.list) ? data.list : []);
            return;
          } catch {
            // fallback below
          }
        }
        if (!silent) {
          setError('Phiên mailbox đã hết hạn, vui lòng tạo mailbox mới.');
        }
      } else if (!silent) {
        setError(String(err?.response?.data?.message || 'Không tải được inbox.'));
      }
    } finally {
      if (!silent) setLoadingList(false);
    }
  };

  const applySessionFromPayload = (data, noticeText) => {
    const nextSession = extractSession(data);
    if (!nextSession) throw new Error('Dữ liệu mailbox trả về không hợp lệ.');
    setSessionAndPersist(nextSession);
    if (nextSession.email_domain) setSelectedDomain(nextSession.email_domain);
    if (noticeText) setMessage(noticeText);
    return nextSession;
  };

  const createMailbox = async () => {
    setLoading(true);
    resetNotice();
    try {
      const { data } = await api.post('/tempmail/address', {
        email_domain: selectedDomain || undefined,
        lang: 'vi',
      });
      const next = applySessionFromPayload(data, 'Đã tạo email tạm mới.');
      setActiveEmail(null);
      await refreshInbox(next.sid_token, { silent: true });
    } catch (err) {
      setError(String(err?.response?.data?.message || 'Không thể tạo mailbox.'));
    } finally {
      setLoading(false);
    }
  };

  const updateMailboxAddress = async () => {
    const username = String(customUser || '').trim().toLowerCase();
    if (!sidToken) return setError('Bạn cần tạo mailbox trước.');
    if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
      return setError('Username hợp lệ: 3-32 ký tự gồm a-z, 0-9, ., _, -');
    }

    setLoading(true);
    resetNotice();
    try {
      const { data } = await api.post('/tempmail/set-user', {
        sid_token: sidToken,
        email_user: username,
        email_domain: selectedDomain || session?.email_domain,
        force_takeover: true,
        lang: 'vi',
      });
      const next = applySessionFromPayload(data, 'Đã cập nhật địa chỉ mailbox.');
      setCustomUser('');
      await refreshInbox(next.sid_token, { silent: true });
    } catch (err) {
      setError(String(err?.response?.data?.message || 'Không đổi được username mailbox.'));
    } finally {
      setLoading(false);
    }
  };

  const openExistingMailbox = async () => {
    const emailAddr = String(mailboxToOpen || '').trim().toLowerCase();
    if (!emailAddr) return setError('Nhập email cần mở lại mailbox.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailAddr)) {
      return setError('Địa chỉ email chưa hợp lệ.');
    }

    setLoading(true);
    resetNotice();
    try {
      const { data } = await api.post('/tempmail/open', {
        email_addr: emailAddr,
        sid_token: sidToken || undefined,
        force_takeover: true,
        lang: 'vi',
      });
      const next = applySessionFromPayload(data, 'Đã mở mailbox cũ.');
      setMailboxToOpen('');
      setActiveEmail(null);
      await refreshInbox(next.sid_token, { silent: true });
    } catch (err) {
      setError(String(err?.response?.data?.message || 'Không mở được mailbox đã nhập.'));
    } finally {
      setLoading(false);
    }
  };

  const fetchEmailDetail = async (mailId) => {
    if (!sidToken || !mailId) return;
    setLoadingList(true);
    resetNotice();

    try {
      const { data } = await api.post('/tempmail/email', {
        sid_token: sidToken,
        email_id: mailId,
      });
      setActiveEmail(data || null);
    } catch (err) {
      const status = Number(err?.response?.status || 0);
      if (status === 401) {
        const recovered = await recoverSessionIfExpired({ silent: false });
        if (recovered?.sid_token) {
          try {
            const { data } = await api.post('/tempmail/email', {
              sid_token: recovered.sid_token,
              email_id: mailId,
            });
            setActiveEmail(data || null);
            return;
          } catch {
            // fallback below
          }
        }
      }
      setError(String(err?.response?.data?.message || 'Không đọc được email.'));
    } finally {
      setLoadingList(false);
    }
  };

  const deleteEmail = async (mailId) => {
    if (!sidToken || !mailId) return;
    setLoadingList(true);
    resetNotice();
    try {
      await api.post('/tempmail/delete', {
        sid_token: sidToken,
        email_id: mailId,
      });
      if (String(activeEmail?.mail_id || '') === String(mailId)) setActiveEmail(null);
      setMessage('Đã xóa email.');
      await refreshInbox(sidToken, { silent: true });
    } catch (err) {
      setError(String(err?.response?.data?.message || 'Không xóa được email.'));
    } finally {
      setLoadingList(false);
    }
  };

  const downloadAttachment = async (fileName) => {
    if (!sidToken || !activeEmail?.mail_id || !fileName) return;
    setLoadingList(true);
    resetNotice();
    try {
      const response = await api.post(
        '/tempmail/attachment',
        {
          sid_token: sidToken,
          email_id: activeEmail.mail_id,
          file_name: fileName,
        },
        { responseType: 'blob' },
      );
      const blob = new Blob([response.data], {
        type: response.headers?.['content-type'] || 'application/octet-stream',
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = String(fileName);
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      setMessage(`Đã tải tệp ${fileName}.`);
    } catch (err) {
      setError(String(err?.response?.data?.message || 'Không tải được tệp đính kèm.'));
    } finally {
      setLoadingList(false);
    }
  };

  const clearMailboxSession = () => {
    setSessionAndPersist(null);
    setEmails([]);
    setActiveEmail(null);
    setMessage('Đã xóa phiên mailbox trên trình duyệt.');
    setError('');
  };

  const copyMailbox = async () => {
    if (!session?.email_addr) return;
    try {
      await navigator.clipboard.writeText(session.email_addr);
      setMessage('Đã copy địa chỉ email tạm.');
      setError('');
    } catch {
      setError('Không thể copy tự động, vui lòng copy thủ công.');
    }
  };

  useEffect(() => {
    let mounted = true;
    const bootstrap = async () => {
      try {
        await fetchDomains();
        const stored = readStoredSession();
        if (mounted && stored?.sid_token) {
          setSessionAndPersist(stored);
          await refreshInbox(stored.sid_token, { silent: true });
        }
      } catch (err) {
        if (!mounted) return;
        setError(String(err?.response?.data?.message || 'Không kết nối được dịch vụ mailbox.'));
      }
    };
    bootstrap();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!sidToken) return undefined;
    const timer = window.setInterval(() => {
      refreshInbox(sidToken, { silent: true });
    }, 5000);
    return () => window.clearInterval(timer);
    // refreshInbox reads the latest session state; this interval should restart only when sidToken changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sidToken]);

  return (
    <div className="glass rounded-[24px] md:rounded-[32px] p-5 md:p-7 border border-white/10 h-[620px] md:h-[700px] overflow-hidden flex flex-col gap-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h3 className="text-2xl font-bold flex items-center gap-2">
            Mail ảo Playground
            <MailPlus className="w-5 h-5 text-primary" />
          </h3>
          <p className="text-white/40 text-sm">
            Tạo mailbox tạm, nhận thư real-time và đọc trực tiếp ngay trong web.
          </p>
        </div>
        <button
          type="button"
          onClick={() => refreshInbox(sidToken)}
          disabled={!sidToken || loadingList}
          className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm font-semibold text-white/70 hover:text-white hover:bg-white/10 transition disabled:opacity-40"
        >
          <span className="inline-flex items-center gap-2">
            <RefreshCw className={`w-4 h-4 ${loadingList ? 'animate-spin' : ''}`} />
            Làm mới inbox
          </span>
        </button>
      </div>

      {message && (
        <div className="px-3 py-2 rounded-xl bg-green-500/10 border border-green-500/20 text-green-300 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          {message}
        </div>
      )}
      {error && (
        <div className="px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)] gap-5 flex-1 min-h-0">
        <div className="space-y-3 overflow-y-auto custom-scrollbar pr-1">
          <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-4 space-y-3">
            <label className="text-xs uppercase tracking-wider text-white/40 font-bold">Domain mailbox</label>
            <select
              value={selectedDomain}
              onChange={(e) => setSelectedDomain(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary"
            >
              {domains.length === 0 && <option value="">Đang tải domain...</option>}
              {domains.map((domain) => (
                <option key={domain} value={domain}>
                  {domain}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={createMailbox}
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-primary text-white font-bold hover:scale-[1.01] transition disabled:opacity-60"
            >
              {loading ? 'Đang xử lý...' : 'Tạo email tạm mới'}
            </button>
          </div>

          <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-4 space-y-3">
            <label className="text-xs uppercase tracking-wider text-white/40 font-bold">Đổi username mailbox</label>
            <input
              value={customUser}
              onChange={(e) => setCustomUser(e.target.value)}
              placeholder="vd: sondev2807"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary"
            />
            <button
              type="button"
              onClick={updateMailboxAddress}
              disabled={loading || !sidToken}
              className="w-full py-2.5 rounded-xl border border-white/10 text-white/80 hover:bg-white/10 transition disabled:opacity-40"
            >
              Cập nhật địa chỉ
            </button>
          </div>

          <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-4 space-y-3">
            <label className="text-xs uppercase tracking-wider text-white/40 font-bold">Mở mailbox cũ</label>
            <input
              value={mailboxToOpen}
              onChange={(e) => setMailboxToOpen(e.target.value)}
              placeholder="oldbox@domain.com"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary"
            />
            <button
              type="button"
              onClick={openExistingMailbox}
              disabled={loading}
              className="w-full py-2.5 rounded-xl border border-white/10 text-white/80 hover:bg-white/10 transition disabled:opacity-40"
            >
              Mở mailbox
            </button>
          </div>

          <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-4 space-y-3">
            <p className="text-xs uppercase tracking-wider text-white/40 font-bold">Phiên hiện tại</p>
            <p className="text-sm break-all">{session?.email_addr || 'Chưa có mailbox'}</p>
            <p className="text-[11px] text-white/40">Hết hạn: {formatSessionExpire(session?.session_expires_at)}</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={copyMailbox}
                disabled={!session?.email_addr}
                className="py-2 rounded-xl bg-white/5 border border-white/10 text-white/80 hover:bg-white/10 transition disabled:opacity-40"
              >
                <span className="inline-flex items-center gap-2 text-sm">
                  <Copy className="w-4 h-4" />
                  Copy
                </span>
              </button>
              <button
                type="button"
                onClick={clearMailboxSession}
                className="py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 hover:bg-red-500/20 transition"
              >
                <span className="inline-flex items-center gap-2 text-sm">
                  <Trash2 className="w-4 h-4" />
                  Clear
                </span>
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[300px_minmax(0,1fr)] gap-4 min-h-0">
          <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-3 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-bold text-white/70 flex items-center gap-2">
                <Inbox className="w-4 h-4 text-secondary" />
                Inbox ({emails.length})
              </p>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-1">
              {emails.length === 0 && (
                <p className="text-xs text-white/40 py-6 text-center">Chưa có email nào.</p>
              )}
              {emails.map((item) => (
                <button
                  type="button"
                  key={item.mail_id}
                  onClick={() => fetchEmailDetail(item.mail_id)}
                  className={`w-full text-left p-3 rounded-xl border transition ${
                    String(activeEmail?.mail_id || '') === String(item.mail_id)
                      ? 'border-primary bg-primary/12 shadow-[0_0_0_1px_rgba(157,0,255,0.3)]'
                      : 'border-white/10 bg-black/25 hover:bg-white/5'
                  }`}
                >
                  <p className="text-xs text-white/50 truncate">{item.mail_from || '(Không rõ người gửi)'}</p>
                  <p className="text-sm font-semibold mt-1 line-clamp-2">{item.mail_subject || '(Không tiêu đề)'}</p>
                  <p className="text-[11px] text-white/40 mt-1">{formatMailTime(item.mail_timestamp)}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-4 flex flex-col min-h-0">
            {!activeEmail ? (
              <div className="flex-1 flex items-center justify-center text-center text-white/40 text-sm">
                Chọn một email trong inbox để xem nội dung.
              </div>
            ) : (
              <>
                <div className="pb-3 border-b border-white/10">
                  <p className="text-xs text-white/40">Từ: {activeEmail.mail_from || '--'}</p>
                  <h4 className="text-lg font-bold mt-1">{activeEmail.mail_subject || '(Không tiêu đề)'}</h4>
                  <p className="text-xs text-white/40 mt-1">{formatMailTime(activeEmail.mail_timestamp)}</p>
                </div>

                <div className="flex-1 min-h-0 overflow-hidden py-4 space-y-3">
                  {activeEmail.mail_body ? (
                    <iframe
                      title={`mail-html-${activeEmail.mail_id || 'preview'}`}
                      sandbox=""
                      srcDoc={String(activeEmail.mail_body || '')}
                      className="w-full h-full min-h-[360px] bg-white rounded-xl border border-white/15"
                    />
                  ) : (
                    <div className="h-full min-h-[220px] rounded-xl border border-white/10 bg-black/20 flex items-center justify-center text-sm text-white/50">
                      Email này không có nội dung HTML.
                    </div>
                  )}

                  {Array.isArray(activeEmail.mail_attachments) && activeEmail.mail_attachments.length > 0 && (
                    <div className="bg-black/20 border border-white/10 rounded-xl p-3 max-h-32 overflow-y-auto custom-scrollbar">
                      <p className="text-xs uppercase tracking-wider text-white/40 mb-2">
                        Tệp đính kèm ({activeEmail.mail_attachments.length})
                      </p>
                      <div className="space-y-2">
                        {activeEmail.mail_attachments.map((file) => {
                          const name = String(file?.name || '').trim();
                          const size = Number(file?.size || 0);
                          return (
                            <button
                              key={`${activeEmail.mail_id}-${name}`}
                              type="button"
                              onClick={() => downloadAttachment(name)}
                              className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition"
                            >
                              <span className="text-sm text-white/80 truncate pr-3">{name || 'attachment.bin'}</span>
                              <span className="inline-flex items-center gap-2 text-xs text-white/50 shrink-0">
                                {size > 0 ? `${Math.round(size / 1024)} KB` : '--'}
                                <Download className="w-3.5 h-3.5" />
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-white/10 flex justify-end">
                  <button
                    type="button"
                    onClick={() => deleteEmail(activeEmail.mail_id)}
                    className="px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 hover:bg-red-500/20 transition"
                  >
                    Xóa email này
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {loadingList && (
        <div className="absolute bottom-4 right-4 text-xs text-white/50 inline-flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Đang đồng bộ inbox...
        </div>
      )}
    </div>
  );
};

export default TempMailDemo;
