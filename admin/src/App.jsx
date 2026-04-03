import React, { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ProjectList from './pages/Projects/ProjectList';
import AddProject from './pages/Projects/AddProject';
import EditProject from './pages/Projects/EditProject';
import BlogList from './pages/Blog/BlogList';
import AddBlog from './pages/Blog/AddBlog';
import EditBlog from './pages/Blog/EditBlog';
import AISettings from './pages/AI/AISettings';
import Messages from './pages/Contact/Messages';
import LiveChat from './pages/LiveChat';
import DonateList from './pages/Donate/DonateList';
import MarketplaceManager from './pages/Marketplace/MarketplaceManager';
import { Menu } from 'lucide-react';

// Simple Protected Route Component
const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('adminToken');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  if (!token) return <Navigate to="/login" replace />;

  return (
    <div className="flex min-h-screen bg-background text-white relative">
      {/* Overlay Backdrop cho Mobile */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <Sidebar isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />
      
      <div className="flex-grow flex flex-col h-screen overflow-hidden w-full lg:min-w-0">
        <header className="h-16 border-b border-white/5 flex items-center px-4 lg:px-8 bg-surface/50 backdrop-blur-md shrink-0">
           <button 
             className="lg:hidden p-2 -ml-2 mr-3 text-white/70 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
             onClick={() => setIsMobileMenuOpen(true)}
           >
             <Menu className="w-6 h-6" />
           </button>
           <div className="ml-auto flex items-center gap-4">
              <span className="text-xs text-white/40">Admin</span>
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold">A</div>
           </div>
        </header>
        <main className="flex-grow p-4 lg:p-8 overflow-y-auto w-full">
          {children}
        </main>
      </div>
    </div>
  );
};

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/projects" element={<ProtectedRoute><ProjectList /></ProtectedRoute>} />
      <Route path="/projects/add" element={<ProtectedRoute><AddProject /></ProtectedRoute>} />
      <Route path="/projects/edit/:id" element={<ProtectedRoute><EditProject /></ProtectedRoute>} />
      <Route path="/blog" element={<ProtectedRoute><BlogList /></ProtectedRoute>} />
      <Route path="/blog/add" element={<ProtectedRoute><AddBlog /></ProtectedRoute>} />
      <Route path="/blog/edit/:id" element={<ProtectedRoute><EditBlog /></ProtectedRoute>} />
      <Route path="/ai-settings" element={<ProtectedRoute><AISettings /></ProtectedRoute>} />
      <Route path="/messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
      <Route path="/live-chat" element={<ProtectedRoute><LiveChat /></ProtectedRoute>} />
      <Route path="/donate" element={<ProtectedRoute><DonateList /></ProtectedRoute>} />
      <Route path="/marketplace" element={<ProtectedRoute><MarketplaceManager /></ProtectedRoute>} />
      
      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
