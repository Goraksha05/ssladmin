import { createContext, useContext, useEffect, useState } from 'react';
import apiRequest from '../utils/apiRequest';

// WebSocketClient exports a getter *function* — not a socket instance.
// The original code did `import getSocket from '...'` then called
// `getSocket.emit(...)` which fails because getSocket is a function,
// not the socket object. We must call getSocket() to get the instance.
//
// Pattern used everywhere else in the codebase (IOsocket.js / onConnection.js):
//   const { getIO } = require('../sockets/IOsocket');
//   const io = getIO();
//   io.to(...).emit(...);
//
// Same pattern applies here on the client side.
import getSocketInstance from '../WebSocket/WebSocketClient';

const Ctx = createContext();

export const AdminKycProvider = ({ children }) => {
  const [records, setRecords] = useState([]);
  const [stats, setStats] = useState({
    submitted: 0,
    verified:  0,
    rejected:  0,
    total:     0,
  });

  const fetchKyc = async () => {
    try {
      const res = await apiRequest.get('/api/admin/kyc-review');
      setRecords(res.data.records || []);
    } catch (err) {
      console.error('[AdminKycContext] fetchKyc failed:', err.message);
    }
  };

  useEffect(() => {
    // FIX: Call getSocketInstance() as a function to get the actual socket object.
    // The import is a factory/getter — not the socket itself.
    let socket;
    try {
      socket = getSocketInstance();
    } catch (err) {
      console.warn('[AdminKycContext] Socket not ready yet:', err.message);
      return;
    }

    if (!socket || typeof socket.emit !== 'function') {
      console.warn('[AdminKycContext] Socket instance has no .emit — skipping real-time KYC updates.');
      return;
    }

    // Join the admin KYC room so the server sends kyc:* events to this client
    socket.emit('join_kyc_admin');

    const onAdminUpdate = (data) => {
      setRecords(prev =>
        prev.map(r =>
          r._id === data.kycId
            ? { ...r, status: data.type === 'approved' ? 'verified' : 'rejected' }
            : r
        )
      );
    };

    const onBulkUpdate = ({ ids, type }) => {
      setRecords(prev =>
        prev.map(r =>
          ids.includes(r._id)
            ? { ...r, status: type === 'bulk_approved' ? 'verified' : 'rejected' }
            : r
        )
      );
    };

    const onStatsUpdate = ({ type }) => {
      setStats(prev => {
        const s = { ...prev };
        if (type === 'submitted') { s.submitted++; s.total++; }
        if (type === 'approved')  { s.submitted--; s.verified++; }
        if (type === 'rejected')  { s.submitted--; s.rejected++; }
        return s;
      });
    };

    socket.on('kyc:admin_update', onAdminUpdate);
    socket.on('kyc:bulk_update',  onBulkUpdate);
    socket.on('kyc:stats_update', onStatsUpdate);

    return () => {
      // Clean up listeners to prevent memory leaks / duplicate handlers
      socket.off('kyc:admin_update', onAdminUpdate);
      socket.off('kyc:bulk_update',  onBulkUpdate);
      socket.off('kyc:stats_update', onStatsUpdate);
    };
  }, []);

  return (
    <Ctx.Provider value={{ records, stats, fetchKyc }}>
      {children}
    </Ctx.Provider>
  );
};

export const useAdminKyc = () => useContext(Ctx);