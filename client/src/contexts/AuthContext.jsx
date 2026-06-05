import { createContext, useContext, useEffect, useState } from 'react';
import { auth, loginWithGoogle, logout } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);

  useEffect(() => {
    if (isGuest) {
      setCurrentUser({
        uid: 'guest_' + Math.random().toString(36).substr(2, 9),
        displayName: 'Guest_' + Math.floor(Math.random() * 1000),
        isGuest: true
      });
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoading(false);
    });
    return unsubscribe;
  }, [isGuest]);

  const loginAsGuest = () => {
    setIsGuest(true);
  };

  const value = {
    currentUser,
    loginWithGoogle,
    loginAsGuest,
    logout: async () => {
      if (isGuest) {
        setIsGuest(false);
        setCurrentUser(null);
      } else {
        await logout();
      }
    },
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
