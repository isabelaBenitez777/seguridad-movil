import React from 'react';
import { Pressable, Text } from 'react-native';
import { colors } from '../theme';

type Props = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'danger' | 'ghost';
};

export default function Button({ title, onPress, disabled, variant = 'primary' }: Props) {
  const bg = variant === 'primary' ? colors.accent : variant === 'danger' ? colors.danger : 'transparent';
  const color = variant === 'ghost' ? colors.accent : '#fff';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        backgroundColor: bg,
        paddingVertical: 14,
        paddingHorizontal: 20,
        borderRadius: 10,
        alignItems: 'center',
        opacity: disabled ? 0.5 : pressed ? 0.8 : 1,
      })}
    >
      <Text style={{ color, fontSize: 16, fontWeight: '600' }}>{title}</Text>
    </Pressable>
  );
}
