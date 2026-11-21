import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import BlockPostRenderer from '@layout-post-renderer/BlockPostRenderer';
import api from '../services/api';
import QuestionForm from '../components/QuestionForm';

export default function LayoutPostDetail() {
  const id = window.location.pathname.split('/').filter(Boolean).pop();
  const [post, setPost] = useState(null); const [questions, setQuestions] = useState(null); const [error, setError] = useState('');
  useEffect(() => { api.get(`/public/layout-posts/${encodeURIComponent(id)}`).then(({ data }) => { setPost(data); return api.get(`/public/layout-posts/${encodeURIComponent(id)}/questions`); }).then(({ data }) => setQuestions(data)).catch((requestError) => setError(requestError.response?.status === 404 ? 'Không tìm thấy bài viết.' : 'Không thể tải bài viết.')); }, [id]);
  if (error) return <main className="mx-auto max-w-3xl px-5 py-20 text-center text-white/60">{error}</main>;
  if (!post) return <main className="mx-auto max-w-3xl px-5 py-20 text-center text-white/60">Đang tải bài viết...</main>;
  return <main className="mx-auto max-w-6xl px-5 py-10"><Helmet><title>{post.title}</title></Helmet><h1 className="mb-8 text-3xl font-bold">{post.title}</h1><BlockPostRenderer layout={post.layout} content={post.content} slots={{ question: ({ block }) => questions ? <QuestionForm postId={id} template={questions} heading={block.props?.heading} /> : null }} /></main>;
}