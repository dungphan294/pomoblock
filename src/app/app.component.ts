import { Component, OnInit, inject } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { App } from '@capacitor/app';
import { VersionCheckService } from './services/version-check.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [IonApp, IonRouterOutlet],
})
export class AppComponent implements OnInit {
  private readonly versionCheck = inject(VersionCheckService);

  ngOnInit(): void {
    App.addListener('appStateChange', async ({ isActive }) => {
      if (isActive) await this.versionCheck.runCheck();
    });
  }
}
