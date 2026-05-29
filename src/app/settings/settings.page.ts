import { Component, OnInit } from '@angular/core';
import {
  IonContent,
  IonList,
  IonItem,
  IonLabel,
  IonToggle,
  IonListHeader,
  IonSelect,
  IonSelectOption,
} from '@ionic/angular/standalone';
import { AppSettings, SettingsService } from '../services/settings.service';
import { Capacitor } from '@capacitor/core';

@Component({
  standalone: true,
  selector: 'app-settings',
  templateUrl: 'settings.page.html',
  styleUrls: ['settings.page.scss'],
  imports: [
    IonContent,
    IonList,
    IonItem,
    IonLabel,
    IonToggle,
    IonListHeader,
    IonSelect,
    IonSelectOption,
  ],
})
export class SettingsPage implements OnInit {
  settings: AppSettings;
  devicePlatform = Capacitor.getPlatform();
  appVersion: string | null = null;
  appBuild: string | null = null;

  constructor(private readonly settingsService: SettingsService) {
    this.settings = settingsService.get();
  }

  ngOnInit(): void {
    this.loadDeviceInfo();
  }

  ionViewWillEnter(): void {
    this.settings = this.settingsService.get();
  }

  save<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void {
    this.settingsService.save({ [key]: value });
    this.settings = this.settingsService.get();
  }

  private async loadDeviceInfo(): Promise<void> {
    if (this.devicePlatform === 'web') return;
    try {
      const info = await App.getInfo();
      this.appVersion = info.version;
      this.appBuild = info.build;
    } catch {
      // silently skip on web or emulator without native context
    }
  }
}
