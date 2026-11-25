import React, { createContext, useContext, useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';

const NetworkContext = createContext({
  isConnected: true,
  isInternetReachable: true,
  connectionType: 'unknown',
});

export function NetworkProvider({ children }) {
  const [state, setState] = useState({
    isConnected: true,
    isInternetReachable: true,
    connectionType: 'unknown',
  });

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((netState) => {
      setState({
        isConnected: Boolean(netState.isConnected),
        isInternetReachable:
          netState.isInternetReachable === null ? Boolean(netState.isConnected) : Boolean(netState.isInternetReachable),
        connectionType: netState.type || 'unknown',
      });
    });
    return () => unsubscribe();
  }, []);

  return <NetworkContext.Provider value={state}>{children}</NetworkContext.Provider>;
}

export function useNetwork() {
  return useContext(NetworkContext);
}

