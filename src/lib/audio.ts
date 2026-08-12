import { supabase } from './supabase';

let preloadedAudio: HTMLAudioElement | null = null;
let audioContext: AudioContext | null = null;

// Cache settings in memory
let cachedSoundUrl: string = '/bharat_connect_mogo.wav';

// Pre-fetch custom sound URL from settings asynchronously
const fetchAudioSettings = async () => {
  try {
    const { data } = await supabase
      .from('qr_settings')
      .select('bill_sound_url')
      .eq('id', 1)
      .maybeSingle();

    if (data && data.bill_sound_url && data.bill_sound_url.trim() !== '') {
      cachedSoundUrl = data.bill_sound_url;
    }
  } catch (err) {
    console.warn('[AUDIO] Failed to load audio settings:', err);
  }
};

fetchAudioSettings();

/**
 * Pre-unlocks audio context and pre-loads sound on user click/interaction
 */
export const prepareMogoSound = () => {
  try {
    const soundUrl = cachedSoundUrl || '/bharat_connect_mogo.wav';
    if (!preloadedAudio) {
      preloadedAudio = new Audio(soundUrl);
    }
    preloadedAudio.volume = 1.0;
    preloadedAudio.load();

    // Unlock AudioContext if supported by browser
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioCtx) {
      if (!audioContext) {
        audioContext = new AudioCtx();
      }
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }
    }
  } catch (e) {
    console.warn('[AUDIO] prepareMogoSound error:', e);
  }
};

/**
 * Paytm-style speech notification ("Bharat Connect par X rupees payment successful")
 */
export const speakPaytmNotification = (amount?: number | string) => {
  if (!('speechSynthesis' in window)) return;

  try {
    window.speechSynthesis.cancel();

    let text = 'Bharat Connect bill payment successful!';
    if (amount) {
      const numAmt = typeof amount === 'string' ? parseFloat(amount) : amount;
      if (!isNaN(numAmt) && numAmt > 0) {
        text = `Bharat Connect par ${numAmt} rupees payment successful!`;
      }
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.pitch = 1.0;

    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => v.lang.includes('hi') || v.lang.includes('HI')) ||
                           voices.find(v => v.lang.includes('en-IN') || v.lang.includes('en_IN')) ||
                           voices.find(v => v.lang.includes('en'));
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.warn('[AUDIO] Speech synthesis error:', err);
  }
};

/**
 * Plays the BharatConnect MOGO sound whenever a Bill / BillAvenue bill is paid.
 */
export const playMogoSound = async (amount?: number | string) => {
  console.log('[AUDIO] playMogoSound triggered with amount:', amount);
  let audioPlayed = false;

  // Attempt 1: Direct HTML5 Audio playback using /bharat_connect_mogo.wav
  try {
    const audio1 = new Audio('/bharat_connect_mogo.wav');
    audio1.volume = 1.0;
    await audio1.play();
    audioPlayed = true;
    console.log('[AUDIO] Played /bharat_connect_mogo.wav successfully!');
  } catch (err1) {
    console.warn('[AUDIO] Attempt 1 (/bharat_connect_mogo.wav) failed:', err1);
  }

  // Attempt 2: Direct HTML5 Audio playback using /mogo.wav
  if (!audioPlayed) {
    try {
      const audio2 = new Audio('/mogo.wav');
      audio2.volume = 1.0;
      await audio2.play();
      audioPlayed = true;
      console.log('[AUDIO] Played /mogo.wav successfully!');
    } catch (err2) {
      console.warn('[AUDIO] Attempt 2 (/mogo.wav) failed:', err2);
    }
  }

  // Attempt 3: Custom cached URL if configured
  if (!audioPlayed && cachedSoundUrl && cachedSoundUrl !== '/bharat_connect_mogo.wav') {
    try {
      const audio3 = new Audio(cachedSoundUrl);
      audio3.volume = 1.0;
      await audio3.play();
      audioPlayed = true;
      console.log('[AUDIO] Played custom cachedSoundUrl successfully!');
    } catch (err3) {
      console.warn('[AUDIO] Attempt 3 (cachedSoundUrl) failed:', err3);
    }
  }

  // Attempt 4: Preloaded audio element fallback
  if (!audioPlayed && preloadedAudio) {
    try {
      preloadedAudio.currentTime = 0;
      preloadedAudio.volume = 1.0;
      await preloadedAudio.play();
      audioPlayed = true;
      console.log('[AUDIO] Played preloadedAudio successfully!');
    } catch (err4) {
      console.warn('[AUDIO] Attempt 4 (preloadedAudio) failed:', err4);
    }
  }

  // Fallback: Speech synthesis if all audio file play attempts failed
  if (!audioPlayed) {
    console.log('[AUDIO] Audio files failed to play, falling back to speech synthesis');
    speakPaytmNotification(amount);
  }
};

// Attach to window object for easy debugging in browser console
if (typeof window !== 'undefined') {
  (window as any).playMogoSound = playMogoSound;
  (window as any).prepareMogoSound = prepareMogoSound;
}
