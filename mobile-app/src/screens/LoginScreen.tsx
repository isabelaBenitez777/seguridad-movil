import React, { useState } from 'react';
import { Text, View } from 'react-native';
import Button from '../components/Button';
import { loginWithOAuth } from '../auth/oauth';
import { common } from '../theme';

export default function LoginScreen({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const start = async () => {
    setBusy(true);
    setError('');
    try {
      await loginWithOAuth();
      onLoggedIn();
    } catch (e: any) {
      setError(e?.message ?? 'Error desconocido');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={common.wrap}>
      <Text style={common.title}>Iniciar sesión</Text>
      <Text style={common.sub}>Se abrirá el navegador seguro del sistema (OAuth 2.0 + PKCE).</Text>
      <Button title={busy ? 'Abriendo…' : 'Iniciar sesión'} onPress={start} disabled={busy} />
      {!!error && <Text style={common.error}>{error}</Text>}
    </View>
  );
}
