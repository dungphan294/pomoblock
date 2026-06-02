import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';

@Injectable({ providedIn: 'root' })
export class EnvironmentService {
  isMobile = Capacitor.isNativePlatform();
  isIos    = Capacitor.getPlatform() === 'ios';
  appVersion = 'unknown';
  buildVersion = 'unknown';

  async init(): Promise<void> {
    if (!this.isMobile) return;
    try {
      const info = await App.getInfo();
      this.appVersion = info.version;
      this.buildVersion = info.build;
    } catch {
      // silently skip on web or emulator without native context
    }
  }
}
