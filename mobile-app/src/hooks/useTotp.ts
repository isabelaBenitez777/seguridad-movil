import { useEffect, useState } from 'react';
import { generateTotp, secondsRemaining } from '../crypto/totp';

/** Devuelve el código TOTP actual y los segundos restantes; se regenera al cambiar de ventana de 30 s. */
export function useTotp(seed: string | null) {
  const [code, setCode] = useState('');
  const [remaining, setRemaining] = useState(30);

  useEffect(() => {
    if (!seed) return;
    let lastCounter = -1;
    let alive = true;

    const tick = async () => {
      const now = Date.now();
      const counter = Math.floor(now / 30000);
      if (alive) setRemaining(secondsRemaining(now));
      if (counter !== lastCounter) {
        lastCounter = counter;
        try {
          const c = await generateTotp(seed, now);
          if (alive) setCode(c);
        } catch {
          /* semilla inválida: la pantalla la maneja */
        }
      }
    };

    tick();
    const id = setInterval(tick, 250);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [seed]);

  return { code, remaining };
}
