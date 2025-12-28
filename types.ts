
export enum Language {
  PORTUGUESE = 'Portuguese',
  ENGLISH = 'English',
  SPANISH = 'Spanish'
}

export interface VoiceOption {
  id: string;
  name: string;
  description: string;
  geminiVoice: string;
  styleInstruction: string;
}

export interface ScriptPart {
  index: number;
  text: string;
  audioBlob?: Blob;
  isGeneratingAudio?: boolean;
}

export interface ScriptResult {
  parts: ScriptPart[];
  titles: string[];
  description: string;
  tags: string[];
}

export interface AppState {
  language: Language;
  selectedVoice: string;
  newsText: string;
  isProcessing: boolean;
  result: ScriptResult | null;
  error: string | null;
}
