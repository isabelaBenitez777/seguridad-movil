import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import LoginScreen from './src/screens/LoginScreen';
import AuthenticatorScreen from './src/screens/AuthenticatorScreen';
import VaultScreen from './src/screens/VaultScreen';
import Button from './src/components/Button';
import { refreshAccessToken, setAccessToken, setSessionExpiredHandler } from './src/api/client';
import { clearSession, getRefreshToken } from './src/storage/session';
import { colors, common } from './src/theme';

type Screen = 'loading' | 'login' | 'home' | 'auth' | 'vault';

export default function App() {
  const [screen, setScreen] = useState<Screen>('loading');

  useEffect(() => {
    setSessionExpiredHandler(() => setScreen('login'));
    (async () => {
      const rt = await getRefreshToken();
      if (!rt) { setScreen('login'); return; }
      setScreen((await refreshAccessToken()) ? 'home' : 'login');
    })();
  }, []);

  const logout = async () => {
    await clearSession();
    setAccessToken(null);
    setScreen('login');
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <StatusBar style="light" />
        {screen === 'loading' && <ActivityIndicator style={{ marginTop: 80 }} size="large" color={colors.accent} />}
        {screen === 'login' && <LoginScreen onLoggedIn={() => setScreen('home')} />}
        {screen === 'home' && (
          <View style={common.wrap}>
            <Text style={common.title}>UniSabana Auth Lab</Text>
            <Button title="Authenticator (TOTP)" onPress={() => setScreen('auth')} />
            <Button title="Bóveda Crítica (Step-Up)" onPress={() => setScreen('vault')} />
            <Button title="Cerrar sesión" variant="danger" onPress={logout} />
          </View>
        )}
        {screen === 'auth' && <AuthenticatorScreen onBack={() => setScreen('home')} />}
        {screen === 'vault' && <VaultScreen onBack={() => setScreen('home')} />}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
