import { supabase } from './supabase';

/**
 * Plays the BharatConnect MOGO sound whenever a Bill / BillAvenue bill is paid
 * and the receipt is displayed/opened.
 */
export const playMogoSound = async () => {
  try {
    const { data } = await supabase
      .from('qr_settings')
      .select('bill_sound_url, is_bill_sound_enabled')
      .eq('id', 1)
      .maybeSingle();

    if (data && data.is_bill_sound_enabled === false) {
      return;
    }

    const soundUrl = data?.bill_sound_url || '/bharat_connect_mogo.wav';
    const audio = new Audio(soundUrl);
    audio.play().catch(err => {
      console.warn('[AUDIO] MOGO sound playback failed or blocked:', err);
    });
  } catch (err) {
    console.error('[AUDIO] Error playing MOGO sound:', err);
  }
};
