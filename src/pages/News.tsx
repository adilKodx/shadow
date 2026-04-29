import { useState } from 'react';
import { Newspaper, Plus, X, Pin, Eye, Clock, Search } from 'lucide-react';
import { useNews, NEWS_CATEGORIES, type NewsPost } from '../hooks/useNews';
import { useAuth } from '../context/AuthContext';
import { useBranding } from '../context/BrandingContext';
import { format } from 'date-fns';

export default function NewsPage() {
  const { member } = useAuth();
  const { primaryColor } = useBranding();
  const { posts, loading, createPost, updatePost, deletePost, incrementViewCount } = useNews();
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<NewsPost | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [form, setForm] = useState<Partial<NewsPost>>({
    category: 'general', priority: 'normal', is_published: true,
  });

  const isAdmin = member?.role === 'owner' || member?.role === 'admin';

  const filtered = posts.filter(p => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q || p.title.toLowerCase().includes(q) || p.content.toLowerCase().includes(q);
    const matchesCat = !filterCategory || p.category === filterCategory;
    return matchesSearch && matchesCat;
  });

  const handleSave = async () => {
    if (!form.title || !form.content) return;
    if (selected) {
      await updatePost(selected.id, form);
    } else {
      await createPost(form);
    }
    setShowForm(false);
    setSelected(null);
    setForm({ category: 'general', priority: 'normal', is_published: true });
  };

  const openPost = (post: NewsPost) => {
    setSelected(post);
    incrementViewCount(post.id);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">News & Updates</h2>
        {isAdmin && (
          <button onClick={() => { setSelected(null); setForm({ category: 'general', priority: 'normal', is_published: true }); setShowForm(true); }} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
            <Plus className="w-4 h-4" /> New Post
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search..." className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="flex gap-1 flex-wrap">
          <button onClick={() => setFilterCategory('')} className={`px-2.5 py-1 rounded text-xs ${!filterCategory ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}>All</button>
          {NEWS_CATEGORIES.map(c => (
            <button key={c.value} onClick={() => setFilterCategory(c.value)} className={`px-2.5 py-1 rounded text-xs ${filterCategory === c.value ? 'bg-gray-900 text-white' : c.color}`}>
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Post form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">{selected ? 'Edit Post' : 'New Post'}</h3>
            <button onClick={() => setShowForm(false)}><X className="w-4 h-4" /></button>
          </div>
          <input type="text" value={form.title || ''} onChange={(e) => setForm({...form, title: e.target.value})} placeholder="Post title" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
          <textarea value={form.content || ''} onChange={(e) => setForm({...form, content: e.target.value})} rows={6} placeholder="Post content..." className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
          <div className="grid grid-cols-3 gap-4">
            <select value={form.category || 'general'} onChange={(e) => setForm({...form, category: e.target.value})} className="px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none">
              {NEWS_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <select value={form.priority || 'normal'} onChange={(e) => setForm({...form, priority: e.target.value as any})} className="px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none">
              <option value="normal">Normal</option><option value="important">Important</option><option value="urgent">Urgent</option>
            </select>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.is_pinned || false} onChange={(e) => setForm({...form, is_pinned: e.target.checked})} className="rounded" /> Pin to top
            </label>
          </div>
          <div className="flex gap-3">
            <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
              {selected ? 'Update' : 'Publish'}
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200">Cancel</button>
          </div>
        </div>
      )}

      {/* Posts grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map(post => {
          const cat = NEWS_CATEGORIES.find(c => c.value === post.category);
          return (
            <div key={post.id} className={`bg-white rounded-xl border ${post.is_pinned ? 'border-amber-300' : 'border-gray-200'} overflow-hidden hover:shadow-md transition-shadow cursor-pointer`}
              onClick={() => openPost(post)}>
              {post.cover_image_url && <img src={post.cover_image_url} alt="" className="w-full h-40 object-cover" />}
              <div className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  {post.is_pinned && <Pin className="w-3 h-3 text-amber-500" />}
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${cat?.color}`}>{cat?.label}</span>
                  {post.priority === 'urgent' && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-800">Urgent</span>}
                </div>
                <h3 className="font-semibold text-gray-900 line-clamp-2">{post.title}</h3>
                <p className="text-sm text-gray-500 mt-1 line-clamp-2">{post.content}</p>
                <div className="flex items-center justify-between mt-3 text-xs text-gray-400">
                  <span>{post.author_name}</span>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{post.view_count}</span>
                    <span>{format(new Date(post.publish_at), 'MMM d')}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <Newspaper className="w-10 h-10 mx-auto mb-2 opacity-50" />
          <p>No posts yet</p>
        </div>
      )}

      {/* Read modal */}
      {selected && !showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {selected.cover_image_url && <img src={selected.cover_image_url} alt="" className="w-full h-48 object-cover rounded-t-2xl" />}
            <div className="p-6">
              <div className="flex items-center gap-2 mb-3">
                <span className={`text-xs px-2 py-0.5 rounded ${NEWS_CATEGORIES.find(c => c.value === selected.category)?.color}`}>
                  {NEWS_CATEGORIES.find(c => c.value === selected.category)?.label}
                </span>
                <span className="text-xs text-gray-400">{format(new Date(selected.publish_at), 'MMMM d, yyyy')}</span>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">{selected.title}</h2>
              <p className="text-sm text-gray-500 mb-4">By {selected.author_name}</p>
              <div className="prose prose-sm text-gray-700 whitespace-pre-wrap">{selected.content}</div>
              <div className="flex gap-3 mt-6 pt-4 border-t border-gray-100">
                {isAdmin && (
                  <>
                    <button onClick={() => { setForm(selected); setShowForm(true); }} className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-medium hover:bg-blue-100">Edit</button>
                    <button onClick={() => { deletePost(selected.id); setSelected(null); }} className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-medium hover:bg-red-100">Delete</button>
                  </>
                )}
                <button onClick={() => setSelected(null)} className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs ml-auto">Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
