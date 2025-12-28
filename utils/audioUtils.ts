
export function decodeBase64(base64: string): Uint8Array {
  // Remove espaços em branco e caracteres de nova linha que podem quebrar o atob
  const cleanedBase64 = base64.replace(/[\n\r\s]/g, '');
  const binaryString = atob(cleanedBase64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export function encodeBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number = 24000,
  numChannels: number = 1,
): Promise<AudioBuffer> {
  const byteLength = data.byteLength;
  // Cada amostra PCM 16-bit ocupa 2 bytes
  const numSamples = Math.floor(byteLength / (2 * numChannels));
  const audioBuffer = ctx.createBuffer(numChannels, numSamples, sampleRate);
  
  // Usar DataView é mais seguro que Int16Array para evitar erros de alinhamento (RangeError)
  // caso o buffer tenha um tamanho ímpar inesperado.
  const dataView = new DataView(data.buffer, data.byteOffset, byteLength);
  
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = audioBuffer.getChannelData(channel);
    for (let i = 0; i < numSamples; i++) {
      const sampleIndex = (i * numChannels + channel) * 2;
      // Verifica se ainda existem 2 bytes disponíveis para leitura
      if (sampleIndex + 1 < byteLength) {
        // O áudio do Gemini é Little Endian PCM 16-bit
        const sample = dataView.getInt16(sampleIndex, true);
        // Normaliza de [-32768, 32767] para [-1.0, 1.0] para o AudioContext
        channelData[i] = sample / 32768.0;
      }
    }
  }
  return audioBuffer;
}

export function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numOfChan = buffer.numberOfChannels;
  const length = buffer.length * numOfChan * 2 + 44;
  const bufferData = new ArrayBuffer(length);
  const view = new DataView(bufferData);
  let pos = 0;

  const setUint16 = (data: number) => { view.setUint16(pos, data, true); pos += 2; };
  const setUint32 = (data: number) => { view.setUint32(pos, data, true); pos += 4; };

  setUint32(0x46464952); // "RIFF"
  setUint32(length - 8);
  setUint32(0x45564157); // "WAVE"
  setUint32(0x20746d66); // "fmt "
  setUint32(16);
  setUint16(1); // PCM
  setUint16(numOfChan);
  setUint32(buffer.sampleRate);
  setUint32(buffer.sampleRate * 2 * numOfChan);
  setUint16(numOfChan * 2);
  setUint16(16);
  setUint32(0x61746164); // "data"
  setUint32(length - pos - 4);

  const channels = [];
  for (let i = 0; i < numOfChan; i++) {
    channels.push(buffer.getChannelData(i));
  }

  let offset = 0;
  while (pos < length) {
    for (let i = 0; i < numOfChan; i++) {
      let sample = Math.max(-1, Math.min(1, channels[i][offset]));
      sample = (sample < 0 ? sample * 0x8000 : sample * 0x7FFF) | 0;
      view.setInt16(pos, sample, true);
      pos += 2;
    }
    offset++;
  }

  return new Blob([bufferData], { type: 'audio/wav' });
}
