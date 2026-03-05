import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class LocaleService {
  private messages: Record<string, string> = {};
  private loadedLocale: string | null = null;
  private loadingPromise: Promise<void> | null = null;

  async load(locale: string = 'en') {
    if (this.loadedLocale === locale && Object.keys(this.messages).length > 0) {
      return;
    }
    if (this.loadingPromise) {
      return this.loadingPromise;
    }
    this.loadingPromise = fetch(`assets/locale.${locale}.json`)
      .then((response) => response.json())
      .then((json) => {
        this.messages = json;
        this.loadedLocale = locale;
      })
      .finally(() => {
        this.loadingPromise = null;
      });
    return this.loadingPromise;
  }

  translate(key: string): string {
    return this.messages[key] || key;
  }
}