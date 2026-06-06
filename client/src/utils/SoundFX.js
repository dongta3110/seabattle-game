const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

export const playSound = (type, data = null) => {
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }

  try {
    switch(type) {
      case 'shoot':
        playShootSound();
        break;
      case 'hit':
        playHitSound();
        break;
      case 'miss':
        playMissSound();
        break;
      case 'sunk':
        playSunkSound();
        break;
      case 'win':
        playWinSound();
        break;
      case 'lose':
        playLoseSound();
        break;
      case 'salvo_fire':
        playSalvoFire(data?.count || 3);
        break;
    }
  } catch (e) {
    console.error("Audio error", e);
  }
};

const playShootSound = () => {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(150, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
  gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.3);
};

const playHitSound = () => {
  const bufferSize = audioCtx.sampleRate * 0.6;
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
  const noise = audioCtx.createBufferSource();
  noise.buffer = buffer;
  const filter = audioCtx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 400;
  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(1, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.6);
  noise.connect(filter);
  filter.connect(gain);
  gain.connect(audioCtx.destination);
  noise.start();
};

const playMissSound = () => {
  const bufferSize = audioCtx.sampleRate * 0.3; 
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
  const noise = audioCtx.createBufferSource();
  noise.buffer = buffer;
  const filter = audioCtx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 2000;
  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
  noise.connect(filter);
  filter.connect(gain);
  gain.connect(audioCtx.destination);
  noise.start();
};

const playSunkSound = () => {
  playHitSound();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(300, audioCtx.currentTime);
  osc.frequency.linearRampToValueAtTime(600, audioCtx.currentTime + 0.5);
  osc.frequency.linearRampToValueAtTime(300, audioCtx.currentTime + 1);
  osc.frequency.linearRampToValueAtTime(600, audioCtx.currentTime + 1.5);
  osc.frequency.linearRampToValueAtTime(300, audioCtx.currentTime + 2);
  gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
  gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 2);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 2);
};

const playWinSound = () => {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(440, audioCtx.currentTime);
  osc.frequency.setValueAtTime(554.37, audioCtx.currentTime + 0.2); // C#
  osc.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.4); // E
  osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.6); // A
  gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
  gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 2);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 2);
};

const playLoseSound = () => {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(300, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(50, audioCtx.currentTime + 1.5);
  gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
  gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 2);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 2);
};

const playSalvoFire = (count) => {
  for (let i = 0; i < count; i++) {
    setTimeout(() => {
      playShootSound();
    }, i * 150); // Fire a shot every 150ms
  }
};
