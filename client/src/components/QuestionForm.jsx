import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const draftKey = (postId) => `layout-post-question:${postId}`;

export default function QuestionForm({ postId, template, heading }) {
  const navigate = useNavigate();
  const [values, setValues] = useState({});
  const [status, setStatus] = useState('');
  useEffect(() => {
    try { const draft = JSON.parse(sessionStorage.getItem(draftKey(postId)) || 'null'); if (draft?.values) setValues(draft.values); } catch {}
    const clearDraft = () => sessionStorage.removeItem(draftKey(postId));
    window.addEventListener('chat-auth-logout', clearDraft);
    return () => window.removeEventListener('chat-auth-logout', clearDraft);
  }, [postId]);
  const submit = async (event) => {
    event.preventDefault(); setStatus('');
    const token = localStorage.getItem('userToken');
    if (!token) { sessionStorage.setItem(draftKey(postId), JSON.stringify({ values })); navigate('/dang-nhap', { state: { from: { pathname: `/bai-viet/${postId}` } } }); return; }
    try { await api.post('/chat/layout-post-question', { postId, values }); sessionStorage.removeItem(draftKey(postId)); setValues({}); setStatus('Đã gửi câu hỏi.'); }
    catch (error) { setStatus(error.response?.status === 429 ? 'Bạn đã gửi quá nhiều câu hỏi. Vui lòng thử lại sau.' : error.response?.status === 401 ? 'Phiên đăng nhập đã hết hạn.' : error.response?.data?.message || 'Không thể gửi câu hỏi.'); }
  };
  if (!template?.fields?.length) return null;
  return <form className="lpr-question-form" onSubmit={submit}><h3>{heading || template.name}</h3>{template.fields.map((field) => <label key={field.key}>{field.label}{field.required ? ' *' : ''}{field.type === 'textarea' ? <textarea required={field.required} maxLength={field.maxLength} value={values[field.key] || ''} onChange={(event) => setValues({ ...values, [field.key]: event.target.value })} /> : <input required={field.required} maxLength={field.maxLength} type={field.type === 'email' ? 'email' : field.type === 'tel' ? 'tel' : 'text'} value={values[field.key] || ''} onChange={(event) => setValues({ ...values, [field.key]: event.target.value })} />}</label>)}{status && <p role="status">{status}</p>}<button type="submit">Gửi câu hỏi</button></form>;
}