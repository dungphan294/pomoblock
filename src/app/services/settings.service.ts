import { Injectable } from '@angular/core';

export type TickingSoundType = 'tick' | 'click' | 'soft';
export type SessionEndSoundType = 'beep' | 'bell' | 'chime';

export interface AppSettings {
  workDuration: number;
  shortBreakDuration: number;
  longBreakDuration: number;
  longBreakAfter: number;
  autoStartNextSession: boolean;
  autoStartBreaks: boolean;
  enableBlocking: boolean;
  strictMode: boolean;
  sessionEndAlert: boolean;
  sessionEndSoundType: SessionEndSoundType;
  tickingSound: boolean;
  tickingSoundType: TickingSoundType;
}

const DEFAULTS: AppSettings = {
  workDuration: 25,
  shortBreakDuration: 5,
  longBreakDuration: 15,
  longBreakAfter: 4,
  autoStartNextSession: false,
  autoStartBreaks: false,
  enableBlocking: true,
  strictMode: false,
  sessionEndAlert: true,
  sessionEndSoundType: 'beep',
  tickingSound: false,
  tickingSoundType: 'tick',
};

const KEY = 'pomo_settings';

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private data: AppSettings;

  constructor() {
    try {
      const raw = localStorage.getItem(KEY);
      this.data = raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
    } catch {
      this.data = { ...DEFAULTS };
    }
  }

  get(): AppSettings {
    return { ...this.data };
  }

  save(partial: Partial<AppSettings>): void {
    this.data = { ...this.data, ...partial };
    localStorage.setItem(KEY, JSON.stringify(this.data));
  }
}
