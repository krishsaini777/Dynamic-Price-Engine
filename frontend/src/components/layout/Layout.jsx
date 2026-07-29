import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

export default function Layout() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <main
        style={{
          marginLeft: 'var(--sidebar-width)',
          flex: 1,
          padding: '1.75rem 2rem',
          minHeight: '100vh',
          background: 'var(--bg-primary)',
        }}
      >
        <Outlet />
      </main>
    </div>
  );
}
