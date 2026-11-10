import React, { useEffect, useState } from 'react';
import { Alert, Platform, Text, TextInput, View } from 'react-native';
import Button from '../components/Button';
import { useTotp } from '../hooks/useTotp';
import { generateTotp } from '../crypto/totp';
import { deleteTotpSeed, getTotpSeed, saveTotpSeed } from '../storage/session';
import { colors, common } from '../theme';

const MONO = Platform.select({ ios: 'Menlo', default: 'monospace' });

export default function AuthenticatorScreen({ onBack }: { onBack: () => void }) {
  const [seed, setSeed] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [input, setInput] = useState('');
  const { code, remaining } = useTotp(seed);

  useEffect(() => {
    getTotpSeed().then((s) => {
      setSeed(s);
      setLoaded(true);
    });
  }, []);

  const save = async () => {
    try {
      const clean = input.replace(/\s/g, '').toUpperCase();
      await generateTotp(clean); // valida Base32 antes de guardar
      await saveTotpSeed(clean);
      setSeed(clean);
      setInput('');
    } catch (e: any) {
      Alert.alert('Semilla inválida', e.message);
    }
  };

  const remove = async () => {
    await deleteTotpSeed();
    setSeed(null);
  };

  if (!loaded) return null;

  return (
    <View style={common.wrap}>
      <Text style={common.title}>Authenticator TOTP</Text>

      {seed ? (
        <View style={common.card}>
          <Text style={{ color: colors.muted }}>Código actual (offline)</Text>
          <Text
            style={{
              color: colors.text,
              fontSize: 48,
              fontWeight: '700',
              letterSpacing: 6,
              fontFamily: MONO,
              textAlign: 'center',
            }}
          >
            {code.slice(0, 3)} {code.slice(3)}
          </Text>
          <View style={{ height: 8, backgroundColor: colors.bg, borderRadius: 4, overflow: 'hidden' }}>
            <View
              style={{
                height: 8,
                width: `${(remaining / 30) * 100}%`,
                backgroundColor: remaining <= 5 ? colors.danger : colors.accent,
              }}
            />
          </View>
          <Text style={{ color: colors.muted }}>Se renueva en {remaining} s</Text>
          <Button title="Eliminar semilla" variant="danger" onPress={remove} />
        </View>
      ) : (
        <View style={common.card}>
          <Text style={{ color: colors.muted }}>Ingresa la semilla Base32 (Opción B del lab)</Text>
          <TextInput
            value={input}
            onChangeText={setInput}
            autoCapitalize="characters"
            placeholder="JBSWY3DPEHPK3PXP"
            placeholderTextColor={colors.muted}
            style={common.input}
          />
          <Button title="Guardar semilla" onPress={save} disabled={input.trim().length === 0} />
        </View>
      )}

      <Button title="Volver" variant="ghost" onPress={onBack} />
    </View>
  );
}
