import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AlertController } from '@ionic/angular/standalone';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { EnvironmentService } from './environment.service';

interface ConfigResponse {
  update_required: 'force' | 'flexible' | 'none';
  ios_min_version: string;
  ios_current_version: string;
}

const APP_STORE_SCHEME_URL = 'pomoblock://openAppStore';
const APP_STORE_EXTERNAL_URL = 'itms-apps://itunes.apple.com/app/id1617078070';

@Injectable({ providedIn: 'root' })
export class VersionCheckService {
  private http = inject(HttpClient);
  private alertCtrl = inject(AlertController);
  private env = inject(EnvironmentService);

  private isAlertShowing = false;

  async check(): Promise<void> {
    if (!this.env.isIos) return;
    await this.runCheck();
  }

  async runCheck(): Promise<void> {
    if (this.isAlertShowing) return;

    let config: ConfigResponse;
    try {
      config = await firstValueFrom(
        this.http.get<ConfigResponse>(
          `${environment.apiUrl}/api/config?version=${this.env.appVersion}`,
          { headers: { 'ngrok-skip-browser-warning': 'true' } }
        )
      );
      console.log('Config response: ', config.update_required);
    } catch (err) {
      console.error('[VersionCheck] config fetch failed:', err);
      return;
    }

    if (config.update_required === 'force') {
      await this.showForceUpdateAlert();
    } else if (config.update_required === 'flexible') {
      await this.showFlexibleUpdateAlert();
    }
  }

  private async showForceUpdateAlert(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Update Required',
      message: 'A required update is available. Please update Pomoblock to continue.',
      backdropDismiss: false,
      buttons: [
        {
          text: 'Update in App',
          handler: () => {
            window.open(APP_STORE_SCHEME_URL, '_system');
            return false; // keep alert open so user must update
          },
        },
        {
          text: 'Open App Store',
          handler: () => {
            window.open(APP_STORE_EXTERNAL_URL, '_system');
            return false; // keep alert open so user must update
          },
        },
      ],
    });
    this.isAlertShowing = true;
    await alert.present();
    // intentionally never dismissed — blocks the app until user updates
  }

  private async showFlexibleUpdateAlert(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Update Available',
      message: 'A new version of Pomoblock is available.',
      buttons: [
        { text: 'Later', role: 'cancel' },
        {
          text: 'Update in App',
          handler: () => {
            window.open(APP_STORE_SCHEME_URL, '_system');
          },
        },
        {
          text: 'Open App Store',
          handler: () => {
            window.open(APP_STORE_EXTERNAL_URL, '_system');
          },
        },
      ],
    });
    alert.onDidDismiss().then(() => { this.isAlertShowing = false; });
    this.isAlertShowing = true;
    await alert.present();
  }
}
