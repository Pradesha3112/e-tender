import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { UsbService } from '../services/usb.service';
import { firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class UsbGuard implements CanActivate {

  constructor(
    private usbService: UsbService,
    private router: Router
  ) {}

  async canActivate(): Promise<boolean | UrlTree> {

    try {

      const response = await firstValueFrom(
        this.usbService.checkUSB()
      );

      if (response.usb_connected === true) {

        console.log('✅ USB Guard: Pendrive connected');

        return true;

      }

      console.warn(
        '❌ USB Guard: Pendrive not connected'
      );

      return this.router.createUrlTree([
        '/pendrive-check'
      ]);

    } catch (error) {

      console.error(
        '❌ USB Guard: USB check failed',
        error
      );

      return this.router.createUrlTree([
        '/pendrive-check'
      ]);
    }
  }
}