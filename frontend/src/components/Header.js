/**
 * Header.js  –  Member 5 (Frontend / Real-time)
 * Navigation bar for SwiftTrack portal.
 * Shows different links depending on whether the user is a client or driver.
 */

import React from 'react';
import { Link, useNavigate } from 'react-router-dom';

const Header = () => {
  const navigate = useNavigate();
  const role  = localStorage.getItem('swifttrack_role');
  const token = localStorage.getItem('swifttrack_token');

  const logout = () => {
    localStorage.removeItem('swifttrack_token');
    localStorage.removeItem('swifttrack_role');
    navigate('/login');
  };

  return (
    <header style={styles.header}>
      <div style={styles.brand}>
        <span style={styles.logo}>📦</span>
        <span style={styles.brandName}>SwiftTrack</span>
        <span style={styles.tagline}>by SwiftLogistics</span>
      </div>

      <nav style={styles.nav}>
        {!token && (
          <>
            <Link style={styles.link} to="/login">Login</Link>
            <Link style={styles.link} to="/register">Register</Link>
          </>
        )}

        {token && role === 'client' && (
          <>
            <Link style={styles.link} to="/portal">My Orders</Link>
            <Link style={styles.link} to="/portal/submit">New Order</Link>
            <Link style={styles.link} to="/portal/track">Live Tracking</Link>
          </>
        )}

        {token && role === 'driver' && (
          <>
            <Link style={styles.link} to="/driver">My Manifest</Link>
            <Link style={styles.link} to="/driver/map">Live Map</Link>
          </>
        )}

        <Link style={styles.link} to="/admin">System</Link>

        {token && (
          <button style={styles.logoutBtn} onClick={logout}>Logout</button>
        )}
      </nav>
    </header>
  );
};

const styles = {
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: 'linear-gradient(135deg, #1a1a2e, #16213e)',
    color: '#fff',
    padding: '0.75rem 2rem',
    boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
    position: 'sticky',
    top: 0,
    zIndex: 100,
  },
  brand: { display: 'flex', alignItems: 'center', gap: '0.5rem' },
  logo: { fontSize: '1.6rem' },
  brandName: { fontSize: '1.4rem', fontWeight: 700, color: '#e94560' },
  tagline: { fontSize: '0.75rem', color: '#aaa', marginLeft: '0.25rem' },
  nav: { display: 'flex', alignItems: 'center', gap: '1.2rem' },
  link: { color: '#cdd', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 500 },
  logoutBtn: {
    background: '#e94560', color: '#fff', border: 'none',
    padding: '0.35rem 1rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem',
  },
};

export default Header;
