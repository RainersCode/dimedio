import { useEffect } from 'react';

// Global event emitter for undispensed medications refresh
class UndispensedMedicationsRefreshEmitter {
  private listeners: (() => void)[] = [];

  subscribe(callback: () => void) {
    this.listeners.push(callback);
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  trigger() {
    this.listeners.forEach(callback => callback());
  }
}

export const undispensedMedicationsRefresh = new UndispensedMedicationsRefreshEmitter();

// Hook for components that want to listen to refresh events
export function useUndispensedMedicationsRefresh(callback: () => void) {
  useEffect(() => {
    const unsubscribe = undispensedMedicationsRefresh.subscribe(callback);
    return unsubscribe;
  }, [callback]);
}

// Function to trigger a refresh from anywhere in the app
export function triggerUndispensedMedicationsRefresh() {
  undispensedMedicationsRefresh.trigger();
}