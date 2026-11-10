import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Text, TextInput, View } from 'react-native';
import Button from '../components/Button';
import { api, ApiError, setAccessToken } from '../api/client';
import { useTotp } from '../hooks/useTotp';
import { getTotpSeed } from '../storage/session';
import { colors, common } from '../theme';

export default function VaultScreen({ onBack }: { onBack: () => void }) {
  const [seed, setSeed] = useState<string | null>(null);
  const { code: currentCode, remaining } = useTotp(seed);
  const [vault, setVault] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [stepUpToken, setStepUpToken] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(false);

  const loadVault = async () => {
    setLoading(true);
    setError('');
    try {
      setVault(await api('/api/boveda-critica'));
    } catch (e) {
      if (e instanceof ApiError && e.status === 403 && e.body?.error === 'mfa_required') {
        setStepUpToken(e.body.step_up_token); // atrapa el 403 y abre el modal
      } else {
        setError('No se pudo abrir la bóveda');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getTotpSeed().then(setSeed);
    loadVault();
  }, []);

  const verify = async () => {
    setVerifying(true);
    setError('');
    try {
      const r = await api('/auth/mfa/verify', {
        method: 'POST',
        body: JSON.stringify({ step_up_token: stepUpToken, code: input }),
      });
      setAccessToken(r.elevated_token); // access elevado (mfa_verified: true)
      setStepUpToken(null);
      setInput('');
      await loadVault();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setError('Replay Attack Detected: ese código ya se usó. Espera el siguiente.');
      } else if (e instanceof ApiError && e.status === 401) {
        setError('Código inválido o token expirado');
      } else {
        setError('Error de verificación');
      }
    } finally {
      setVerifying(false);
    }
  };

  return (
    <View style={common.wrap}>
      <Text style={common.title}>Bóveda Crítica</Text>
      {loading && <ActivityIndicator color={colors.accent} />}
      {vault?.secretos?.map((s: any) => (
        <View key={s.nombre} style={common.card}>
          <Text style={{ color: colors.text, fontWeight: '600' }}>{s.nombre}</Text>
          <Text style={{ color: colors.muted }}>{s.valor}</Text>
        </View>
      ))}
      {!!error && !stepUpToken && <Text style={common.error}>{error}</Text>}
      <Button title="Volver" variant="ghost" onPress={onBack} />

      <Modal visible={!!stepUpToken} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 }}>
          <View style={common.card}>
            <Text style={common.title}>Verificación en dos pasos</Text>
            <Text style={{ color: colors.muted }}>Ingresa el código de 6 dígitos de tu Authenticator.</Text>
            <TextInput
              value={input}
              onChangeText={(t) => setInput(t.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              maxLength={6}
              placeholder="000000"
              placeholderTextColor={colors.muted}
              style={common.input}
            />
            {!!error && <Text style={common.error}>{error}</Text>}
            {seed && (
              <Button
                title={`Usar código de este dispositivo (${remaining}s)`}
                variant="ghost"
                onPress={() => setInput(currentCode)}
              />
            )}
            <Button
              title={verifying ? 'Verificando…' : 'Verificar'}
              onPress={verify}
              disabled={input.length !== 6 || verifying}
            />
            <Button
              title="Cancelar"
              variant="ghost"
              onPress={() => {
                setStepUpToken(null);
                onBack();
              }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}
