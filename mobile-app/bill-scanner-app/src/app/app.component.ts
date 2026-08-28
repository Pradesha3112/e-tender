import { Component } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
// Import ALL icons at once
import * as ionIcons from 'ionicons/icons';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: true,
  imports: [IonApp, IonRouterOutlet]
})
export class AppComponent {
  constructor() {
    console.log('🚀 App started!');
    
    // Register ALL Ionic icons at once
    addIcons(ionIcons);
    console.log('✅ All icons registered!');
  }
}