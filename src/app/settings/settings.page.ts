import { Component } from '@angular/core';
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
export class SettingsPage {
  settings: AppSettings;

  constructor(private readonly settingsService: SettingsService) {
    this.settings = settingsService.get();
  }

  ionViewWillEnter(): void {
    this.settings = this.settingsService.get();
  }

  save<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void {
    this.settingsService.save({ [key]: value });
    this.settings = this.settingsService.get();
  }
}
