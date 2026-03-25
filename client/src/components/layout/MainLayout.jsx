import React from 'react';
import Navbar from './Navbar';
import Footer from './Footer';

const MainLayout = ({ children }) => {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-grow pt-16 md:pt-20">
        <div className="container mx-auto px-4 md:px-6 py-8">
          {children}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default MainLayout;
