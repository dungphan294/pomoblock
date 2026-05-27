import { Component, OnInit, OnDestroy } from '@angular/core';
import { IonContent } from '@ionic/angular/standalone';
import { SessionEndSoundType, SettingsService, TickingSoundType } from '../services/settings.service';
import {
  ActionPerformed,
  PushNotificationSchema,
  PushNotifications,
  Token,
} from '@capacitor/push-notifications';

const RING_C = 590.6;

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  imports: [IonContent],
})
export class HomePage implements OnInit, OnDestroy {
  mode: 'focus' | 'break' = 'focus';
  isRunning = false;
  remainingSeconds: number;
  totalSeconds: number;
  sessionInRound = 0;
  completedToday = 0;

  private intervalId: ReturnType<typeof setInterval> | null = null;
  private audioCtx: AudioContext | null = null;

  constructor(private readonly settingsService: SettingsService) {
    const s = settingsService.get();
    this.totalSeconds = s.workDuration * 60;
    this.remainingSeconds = this.totalSeconds;
  }

  ngOnInit() {
    console.log('Initializing HomePage');

    // Request permission to use push notifications
    // iOS will prompt user and return if they granted permission or not
    // Android will just grant without prompting
    PushNotifications.requestPermissions().then(result => {
      if (result.receive === 'granted') {
        // Register with Apple / Google to receive push via APNS/FCM
        PushNotifications.register();
      } else {
        // Show some error
      }
    });

    // On success, we should be able to receive notifications
    PushNotifications.addListener('registration',
      (token: Token) => {
        alert('Push registration success, token: ' + token.value);
      }
    );

    // Some issue with our setup and push will not work
    PushNotifications.addListener('registrationError',
      (error: any) => {
        alert('Error on registration: ' + JSON.stringify(error));
      }
    );

    // Show us the notification payload if the app is open on our device
    PushNotifications.addListener('pushNotificationReceived',
      (notification: PushNotificationSchema) => {
        alert('Push received: ' + JSON.stringify(notification));
      }
    );

    // Method called when tapping on a notification
    PushNotifications.addListener('pushNotificationActionPerformed',
      (notification: ActionPerformed) => {
        alert('Push action performed: ' + JSON.stringify(notification));
      }
    );
  }

  ionViewWillEnter(): void {
    if (
      !this.isRunning &&
      this.remainingSeconds === this.totalSeconds &&
      this.mode === 'focus'
    ) {
      const s = this.settingsService.get();
      this.totalSeconds = s.workDuration * 60;
      this.remainingSeconds = this.totalSeconds;
    }
  }

  get minutes(): string {
    return Math.floor(this.remainingSeconds / 60)
      .toString()
      .padStart(2, '0');
  }

  get seconds(): string {
    return (this.remainingSeconds % 60).toString().padStart(2, '0');
  }

  get ringOffset(): number {
    return (1 - this.remainingSeconds / this.totalSeconds) * RING_C;
  }

  get modeLabel(): string {
    return this.mode === 'focus' ? 'FOCUS' : 'BREAK';
  }

  get timerSubLabel(): string {
    if (this.isRunning)
      return this.mode === 'focus' ? 'stay focused' : 'take a break';
    if (this.remainingSeconds < this.totalSeconds) return 'paused';
    return 'ready to start';
  }

  get btnLabel(): string {
    if (this.isRunning) return 'PAUSE';
    return this.remainingSeconds < this.totalSeconds
      ? 'RESUME'
      : 'START SESSION';
  }

  get sessionDots(): boolean[] {
    const count = this.settingsService.get().longBreakAfter;
    return Array.from({ length: count }, (_, i) => i < this.sessionInRound);
  }

  get showReset(): boolean {
    return this.remainingSeconds < this.totalSeconds || this.sessionInRound > 0;
  }

  get workDurationMin(): number {
    return this.settingsService.get().workDuration;
  }

  get shortBreakMin(): number {
    return this.settingsService.get().shortBreakDuration;
  }

  get longBreakAfter(): number {
    return this.settingsService.get().longBreakAfter;
  }

  toggleTimer(): void {
    // iOS WKWebView requires AudioContext to be created and resumed inside a user gesture
    if (!this.audioCtx) {
      try { this.audioCtx = new AudioContext(); } catch { /* unsupported */ }
    }
    this.audioCtx?.resume();
    this.isRunning ? this.pause() : this.start();
  }

  reset(): void {
    this.pause();
    this.mode = 'focus';
    const s = this.settingsService.get();
    this.totalSeconds = s.workDuration * 60;
    this.remainingSeconds = this.totalSeconds;
    this.sessionInRound = 0;
    this.completedToday = 0;
  }

  ngOnDestroy(): void {
    this.pause();
    this.audioCtx?.close();
  }

  private start(): void {
    this.isRunning = true;
    this.intervalId = setInterval(() => this.tick(), 1000);
  }

  private pause(): void {
    this.isRunning = false;
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private tick(): void {
    this.remainingSeconds--;
    const s = this.settingsService.get();
    if (s.tickingSound) this.playTick(s.tickingSoundType);
    if (this.remainingSeconds <= 0) {
      this.remainingSeconds = 0;
      this.onComplete();
    }
  }

  private onComplete(): void {
    this.pause();
    const s = this.settingsService.get();
    if (s.sessionEndAlert) this.playSessionEnd(s.sessionEndSoundType);

    if (this.mode === 'focus') {
      this.completedToday++;
      this.sessionInRound = (this.sessionInRound + 1) % s.longBreakAfter;
      const isLongBreak = this.sessionInRound === 0;
      this.mode = 'break';
      const breakSec =
        (isLongBreak ? s.longBreakDuration : s.shortBreakDuration) * 60;
      this.remainingSeconds = breakSec;
      this.totalSeconds = breakSec;
      if (s.autoStartBreaks) this.start();
    } else {
      this.mode = 'focus';
      this.remainingSeconds = s.workDuration * 60;
      this.totalSeconds = s.workDuration * 60;
      if (s.autoStartNextSession) this.start();
    }
  }

  private getAudioCtx(): AudioContext | null {
    if (!this.audioCtx) {
      try {
        this.audioCtx = new AudioContext();
      } catch {
        return null;
      }
    }
    return this.audioCtx;
  }

  private playSessionEnd(type: SessionEndSoundType): void {
    const ctx = this.getAudioCtx();
    if (!ctx) return;

    if (type === 'beep') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
      osc.start();
      osc.stop(ctx.currentTime + 0.8);
    } else if (type === 'bell') {
      const freqs = [660, 1320, 1980];
      const gains = [0.3, 0.15, 0.07];
      freqs.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(gains[i], ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.5);
        osc.start();
        osc.stop(ctx.currentTime + 1.5);
      });
    } else {
      // chime: three ascending notes
      const notes = [523, 659, 784];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.value = freq;
        const t = ctx.currentTime + i * 0.25;
        gain.gain.setValueAtTime(0.25, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
        osc.start(t);
        osc.stop(t + 0.6);
      });
    }
  }

  private playTick(type: TickingSoundType): void {
    const ctx = this.getAudioCtx();
    if (!ctx) return;

    if (type === 'click') {
      const bufferSize = Math.floor(ctx.sampleRate * 0.015);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
      const source = ctx.createBufferSource();
      const gain = ctx.createGain();
      source.buffer = buffer;
      source.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.015);
      source.start();
    } else if (type === 'soft') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = 500;
      gain.gain.setValueAtTime(0.03, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } else {
      // tick (default)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = 1000;
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
      osc.start();
      osc.stop(ctx.currentTime + 0.05);
    }
  }
}
