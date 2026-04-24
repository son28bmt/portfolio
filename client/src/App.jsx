import React from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import AppRoutes from './routes/AppRoutes';
import MainLayout from './components/layout/MainLayout';
import { AuthProvider } from './context/AuthContext';
import './styles/global.css';

function App() {
  return (
    <AuthProvider>
      <Router>
        <MainLayout>
          <AppRoutes />
        </MainLayout>
      </Router>
    </AuthProvider>
  );
}

export default App;
