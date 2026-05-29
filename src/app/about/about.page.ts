import { Component } from '@angular/core';
import { IonContent } from '@ionic/angular/standalone';
import { EnvironmentService } from '../services/environment.service';

@Component({
  standalone: true,
  selector: 'app-about',
  templateUrl: 'about.page.html',
  styleUrls: ['about.page.scss'],
  imports: [IonContent],
})
export class AboutPage {
  constructor(readonly env: EnvironmentService) {}
}
