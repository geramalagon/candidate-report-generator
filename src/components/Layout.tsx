import React from 'react';
import Navigation from './Navigation';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen flex flex-col">
      <Navigation />
      <main className="flex-grow">
        {children}
      </main>
      <footer className="bg-gray-100 p-4 text-center text-gray-600 text-sm">
        &copy; {new Date().getFullYear()} Candidate Report Generator
      </footer>
    </div>
  );
};

export default Layout; 