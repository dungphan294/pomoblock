import { Component } from '@angular/core';
import { IonHeader, IonToolbar, IonTitle, IonContent } from '@ionic/angular/standalone';

@Component({
  standalone: true,
  selector: 'app-about',
  templateUrl: 'about.page.html',
  styleUrls: ['about.page.scss'],
  imports: [IonHeader, IonToolbar, IonTitle, IonContent],
})
export class AboutPage {}
