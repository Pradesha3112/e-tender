import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

declare global {
  interface Navigator {
    usb: any;
  }
}

@Injectable({
  providedIn: 'root'
})
export class PendriveAuthService {
  private pendriveDetectedSubject = new BehaviorSubject<boolean>(false);
  pendriveDetected$ = this.pendriveDetectedSubject.asObservable();

  private isChecking = false;
  private detectedDevices: any[] = [];

  constructor() {
    console.log('🔐 Pendrive Auth Service initialized');
    // ✅ ALWAYS start with false - no simulation
    this.pendriveDetectedSubject.next(false);
  }

  async checkPendrive(): Promise<boolean> {
    if (this.isChecking) {
      console.log('⏳ Already checking...');
      return false;
    }
    
    this.isChecking = true;
    console.log('🔍 Checking for USB devices...');

    try {
      const detected = await this.detectPendriveUSB();
      this.pendriveDetectedSubject.next(detected);
      return detected;
    } catch (error) {
      console.error('❌ Pendrive check error:', error);
      this.pendriveDetectedSubject.next(false);
      return false;
    } finally {
      this.isChecking = false;
    }
  }

  async detectPendriveUSB(): Promise<boolean> {
    try {
      if (!navigator.usb) {
        console.warn('❌ WebUSB not supported');
        return false;
      }

      console.log('✅ WebUSB is supported');

      // Check paired devices
      try {
        const devices = await navigator.usb.getDevices();
        console.log('📱 Paired devices count:', devices.length);
        
        for (const device of devices) {
          console.log('📱 Device found:', {
            vendorId: device.vendorId,
            productId: device.productId,
            manufacturerName: device.manufacturerName || 'Unknown',
            productName: device.productName || 'Unknown'
          });
          
          if (device.vendorId && device.productId) {
            console.log('✅ Found connected USB device!');
            this.detectedDevices.push(device);
            return true;
          }
        }
      } catch (e) {
        console.log('⚠️ Could not get paired devices:', e);
      }

      // Request device permission
      console.log('🔑 Requesting USB device...');
      
      try {
        const device = await navigator.usb.requestDevice({
          filters: []
        });
        
        if (device) {
          console.log('📱 User selected device');
          this.detectedDevices.push(device);
          
          try {
            await device.open();
            console.log('✅ Device opened successfully');
          } catch (openError) {
            console.log('⚠️ Could not open device');
          }
          
          return true;
        }
      } catch (requestError: any) {
        if (requestError.name === 'NotFoundError' || requestError.message?.includes('cancel')) {
          console.log('⏹️ User cancelled');
        } else {
          console.warn('⚠️ Request error:', requestError);
        }
      }
      
      return false;
    } catch (error) {
      console.error('❌ Detection error:', error);
      return false;
    }
  }

  // ✅ SIMPLE SIMULATION - Just set the subject directly
  enableSimulation() {
    console.log('🔄 Simulation mode enabled');
    this.pendriveDetectedSubject.next(true);
  }

  disableSimulation() {
    console.log('❌ Simulation mode disabled');
    this.pendriveDetectedSubject.next(false);
    this.detectedDevices = [];
  }

  getDeviceCount(): number {
    return this.detectedDevices.length;
  }

  getDeviceInfo(): any[] {
    return this.detectedDevices.map(d => ({
      vendorId: d.vendorId || 'Unknown',
      productId: d.productId || 'Unknown',
      manufacturerName: d.manufacturerName || 'Unknown',
      productName: d.productName || 'Unknown'
    }));
  }

  isWebUSBSupported(): boolean {
    return !!navigator.usb;
  }

  getBrowserInfo(): string {
    return navigator.userAgent;
  }
}