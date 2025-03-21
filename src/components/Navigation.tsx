import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const Navigation: React.FC = () => {
  const location = useLocation();
  
  return (
    <nav className="bg-gray-800 text-white p-4">
      <div className="container mx-auto flex justify-between items-center">
        <h1 className="text-xl font-bold">Candidate Report Generator</h1>
        
        <ul className="flex space-x-4">
          <li>
            <Link
              to="/"
              className={`${location.pathname === '/' ? 'text-blue-300 font-bold' : 'text-gray-300 hover:text-white'} px-3 py-2 rounded-md text-sm`}
            >
              Home
            </Link>
          </li>
          <li>
            <Link
              to="/encoding-test"
              className={`${location.pathname === '/encoding-test' ? 'text-blue-300 font-bold' : 'text-gray-300 hover:text-white'} px-3 py-2 rounded-md text-sm`}
            >
              Encoding Test
            </Link>
          </li>
        </ul>
      </div>
    </nav>
  );
};

export default Navigation; 