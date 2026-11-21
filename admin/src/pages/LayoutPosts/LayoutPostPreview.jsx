import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import BlockPostRenderer from '@layout-post-renderer/BlockPostRenderer';
import api from '../../services/api';

export default function LayoutPostPreview() {
  const { id } = useParams();
  const [post, setPost] = useState(null); const [error, setError] = useState('');
  useEffect(() => { api.get(`/layout-posts/${encodeURIComponent(id)}`).then(({ data }) => setPost(data)).catch((requestError) => setError(requestError.response?.data?.message || requestError.message)); }, [id]);
  if (error) return <div className="p-8 text-red-200">{error}</div>;
  if (!post) return <div className="p-8 text-white/60">Đang tải bản xem trước...</div>;
  return <section className="rounded-xl border border-white/10 bg-white p-6 text-black"><h1 className="mb-6 text-3xl font-bold">{post.title}</h1><BlockPostRenderer layout={post.layout} content={post.content} /></section>;
}