import { supabase } from './supabase';

let preloadedAudio: HTMLAudioElement | null = null;
let audioContext: AudioContext | null = null;

// Cache settings in memory to avoid delaying playback
let cachedSoundUrl: string = '/bharat_connect_mogo.wav';
let cachedIsEnabled: boolean = true;

// Pre-fetch settings once asynchronously
const fetchAudioSettings = async () => {
  try {
    const { data } = await supabase
      .from('qr_settings')
      .select('bill_sound_url, is_bill_sound_enabled')
      .eq('id', 1)
      .maybeSingle();

    if (data) {
      if (data.is_bill_sound_enabled === false) {
        cachedIsEnabled = false;
      }
      if (data.bill_sound_url && data.bill_sound_url.trim() !== '') {
        cachedSoundUrl = data.bill_sound_url;
      }
    }
  } catch (err) {
    console.warn('[AUDIO] Failed to load audio settings:', err);
  }
};

// Fire settings fetch on module load
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

    // Call play() inside user gesture to grant media autoplay permission, then pause immediately
    const unlockPromise = preloadedAudio.play();
    if (unlockPromise !== undefined) {
      unlockPromise.then(() => {
        if (preloadedAudio) {
          preloadedAudio.pause();
          preloadedAudio.currentTime = 0;
        }
      }).catch((e) => {
        console.warn('[AUDIO] Pre-unlock gesture warning:', e);
      });
    }

    // Create & resume AudioContext if supported by browser
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
    window.speechSynthesis.cancel(); // cancel previous speech

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

    // Try to find Hindi or English voice for authentic soundbox feel
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
  if (!cachedIsEnabled) {
    console.warn('[AUDIO] Audio disabled in settings');
    return;
  }

  let audioPlayed = false;

  // Play HTML5 MOGO Chime Audio immediately
  try {
    const soundUrl = cachedSoundUrl || '/bharat_connect_mogo.wav';
    const audio = preloadedAudio || new Audio(soundUrl);
    audio.volume = 1.0;
    audio.currentTime = 0;

    const playPromise = audio.play();
    if (playPromise !== undefined) {
      await playPromise;
      audioPlayed = true;
      console.log('[AUDIO] Primary MOGO sound played successfully!');
    }
  } catch (err) {
    console.warn('[AUDIO] Primary MOGO sound play failed, attempting fallbacks:', err);

    // Fallback 1: Direct new Audio('/bharat_connect_mogo.wav')
    try {
      const fallbackAudio = new Audio('/bharat_connect_mogo.wav');
      fallbackAudio.volume = 1.0;
      await fallbackAudio.play();
      audioPlayed = true;
      console.log('[AUDIO] Fallback 1 played successfully!');
    } catch (fallbackErr) {
      console.warn('[AUDIO] Fallback 1 failed:', fallbackErr);

      // Fallback 2: /mogo.wav
      try {
        const fallbackAudio2 = new Audio('/mogo.wav');
        fallbackAudio2.volume = 1.0;
        await fallbackAudio2.play();
        audioPlayed = true;
        console.log('[AUDIO] Fallback 2 played successfully!');
      } catch (fallbackErr2) {
        console.warn('[AUDIO] Fallback 2 failed:', fallbackErr2);
      }
    }
  }

  // Fallback 3: If WAV audio playback was blocked or failed, fallback to text-to-speech
  if (!audioPlayed) {
    console.log('[AUDIO] Falling back to text-to-speech notification');
    speakPaytmNotification(amount);
  }
};
