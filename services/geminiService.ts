
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { Language, ScriptResult } from '../types';
import { MAX_PART_CHARACTERS, VOICES } from '../constants';
import { decodeBase64, decodeAudioData, audioBufferToWavBlob } from '../utils/audioUtils';

export class GeminiService {
  private getClient() {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      throw new Error("API Key não encontrada. Certifique-se de que a chave está configurada.");
    }
    return new GoogleGenAI({ apiKey });
  }

  async generateScriptAndMetadata(text: string, lang: Language): Promise<ScriptResult> {
    const ai = this.getClient();
    const prompt = `
      Atue como um Especialista em Roteirização e Produção para Canais Dark de Futebol no YouTube.
      Transforme a notícia abaixo em um roteiro altamente envolvente.
      
      NOTÍCIA: ${text}
      
      REQUISITOS:
      1. Idioma: ${lang}.
      2. Tom: Viral, urgente e com ganchos fortes.
      3. Divida em blocos de no máximo ${MAX_PART_CHARACTERS} caracteres.
      4. Metadados: 10 títulos clickbait, descrição de 150 palavras e 15 tags.
      
      Retorne estritamente em JSON.
    `;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              scriptParts: { type: Type.ARRAY, items: { type: Type.STRING } },
              titles: { type: Type.ARRAY, items: { type: Type.STRING } },
              description: { type: Type.STRING },
              tags: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["scriptParts", "titles", "description", "tags"]
          }
        }
      });

      const data = JSON.parse(response.text);
      return {
        parts: data.scriptParts.map((text: string, index: number) => ({ index, text })),
        titles: data.titles,
        description: data.description,
        tags: data.tags
      };
    } catch (error) {
      console.error("Erro na geração do script:", error);
      throw error;
    }
  }

  async generateAudio(text: string, voiceName: string): Promise<Blob> {
    const ai = this.getClient();
    const selectedVoice = VOICES.find(v => v.geminiVoice === voiceName);
    const style = selectedVoice?.styleInstruction || "";
    
    // Formato de prompt mais estável para o modelo de TTS
    const inputPrompt = `Instruction: ${style}. Text to speak: ${text}`;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: inputPrompt }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) {
        throw new Error("A API não retornou dados de áudio. O texto pode ser muito longo ou conter caracteres inválidos.");
      }

      const audioBytes = decodeBase64(base64Audio);
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const buffer = await decodeAudioData(audioBytes, ctx, 24000, 1);
      return audioBufferToWavBlob(buffer);
    } catch (error) {
      console.error("Erro na geração do áudio:", error);
      throw error;
    }
  }

  async previewVoice(voiceName: string, lang: Language): Promise<Blob> {
    const sample = lang === Language.PORTUGUESE 
      ? "Fala torcedor! Se liga nessa bomba que acabou de sair!" 
      : "Hey football fan! Check out this breaking news!";
    return this.generateAudio(sample, voiceName);
  }
}
