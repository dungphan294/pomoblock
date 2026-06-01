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

@Injectable({ providedIn: 'root' })
export class VersionCheckService {
  private http = inject(HttpClient);
  private alertCtrl = inject(AlertController);
  private env = inject(EnvironmentService);

  async check(): Promise<void> {
    if (!this.env.isMobile) return;

    let config: ConfigResponse;
    try {
      config = await firstValueFrom(
        this.http.get<ConfigResponse>(
          `${environment.apiUrl}/api/config?version=${this.env.appVersion}`
        )
      );
    } catch {
      // Network failure — allow app to continue rather than hard-blocking
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
          text: 'Update Now',
          handler: () => {
            window.open(
              'https://apps.apple.com/app/id6744036083',
              '_system'
            );
            return false; // keep alert open so user must update
          },
        },
      ],
    });
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
          text: 'Update Now',
          handler: () => {
            window.open(
              'https://apps.apple.com/app/id6744036083',
              '_system'
            );
          },
        },
      ],
    });
    await alert.present();
  }
}
