import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { getSocket } from '@/services/socketService';
import { useRideStore } from '@/store/useRideStore';

export const SocketDiagnostics = () => {
  const [status, setStatus] = useState<string>('DISCONNECTED');
  const [socketId, setSocketId] = useState<string>('none');
  const [transport, setTransport] = useState<string>('none');
  const rideId = useRideStore((s) => s.rideId);

  useEffect(() => {
    // Only mount in DEV
    if (process.env.NODE_ENV !== 'development') return;

    const interval = setInterval(() => {
      const socket = getSocket();
      if (!socket) {
        setStatus('NOT_INITIALIZED');
        setSocketId('none');
        setTransport('none');
        return;
      }

      setStatus(socket.connected ? 'CONNECTED' : 'DISCONNECTED');
      setSocketId(socket.id || 'none');
      
      const engine = (socket as any).io?.engine;
      setTransport(engine?.transport?.name || 'none');
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <View style={styles.container} pointerEvents="none">
      <Text style={styles.text}>Status: {status}</Text>
      <Text style={styles.text}>ID: {socketId}</Text>
      <Text style={styles.text}>Transport: {transport}</Text>
      <Text style={styles.text}>Ride: {rideId || 'None'}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 50,
    left: 10,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 8,
    borderRadius: 8,
    zIndex: 9999,
  },
  text: {
    color: '#00FF00',
    fontSize: 10,
    fontFamily: 'Courier',
    fontWeight: 'bold',
  },
});
