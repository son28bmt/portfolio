import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import api from '../services/api';

const USER_TOKEN_KEY = 'userToken';
const USER_ACCOUNT_KEY = 'userAccount';

const AuthContext = createContext(null);

const readStoredAccount = () => {
  try {
    const raw = window.localStorage.getItem(USER_ACCOUNT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => window.localStorage.getItem(USER_TOKEN_KEY) || '');
  const [account, setAccount] = useState(() => readStoredAccount());
  const [loading, setLoading] = useState(Boolean(window.localStorage.getItem(USER_TOKEN_KEY)));

  const persist = (nextToken, nextAccount) => {
    if (nextToken) {
      window.localStorage.setItem(USER_TOKEN_KEY, nextToken);
    } else {
      window.localStorage.removeItem(USER_TOKEN_KEY);
    }

    if (nextAccount) {
      window.localStorage.setItem(USER_ACCOUNT_KEY, JSON.stringify(nextAccount));
    } else {
      window.localStorage.removeItem(USER_ACCOUNT_KEY);
    }
  };

  const applyAuth = (nextToken, nextAccount) => {
    setToken(nextToken || '');
    setAccount(nextAccount || null);
    persist(nextToken || '', nextAccount || null);
  };

  const updateAccount = (nextAccount) => {
    setAccount(nextAccount || null);
    persist(window.localStorage.getItem(USER_TOKEN_KEY) || token, nextAccount || null);
  };

  const logout = () => {
    applyAuth('', null);
  };

  const refreshAccount = async (overrideToken = '') => {
    const activeToken = overrideToken || window.localStorage.getItem(USER_TOKEN_KEY) || token;
    if (!activeToken) return null;
    try {
      const { data } = await api.get('/account/me');
      updateAccount(data);
      return data;
    } catch (error) {
      if (error?.response?.status === 401) {
        logout();
      }
      throw error;
    }
  };

  useEffect(() => {
    let active = true;
    if (!token) {
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    refreshAccount(token)
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [token]);

  const login = async ({ username, password }) => {
    const { data } = await api.post('/auth/login', { username, password });
    applyAuth(data?.token || '', null);
    const freshAccount = await refreshAccount(data?.token || '');
    return freshAccount;
  };

  const register = async ({ username, password, email, fullName }) => {
    const { data } = await api.post('/auth/register', {
      username,
      password,
      email,
      fullName,
    });

    const nextAccount = data?.account || null;
    applyAuth(data?.token || '', nextAccount);
    if (!nextAccount) {
      await refreshAccount(data?.token || '');
    }
    return nextAccount;
  };

  const value = useMemo(
    () => ({
      token,
      account,
      isAuthenticated: Boolean(token),
      loading,
      login,
      register,
      logout,
      refreshAccount,
      updateAccount,
    }),
    [token, account, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return value;
};
