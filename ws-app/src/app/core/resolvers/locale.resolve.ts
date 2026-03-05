import { inject } from '@angular/core';
import { LocaleService } from '../services/locale.service';
import { ResolveFn } from '@angular/router';

export const localeResolve: ResolveFn<Promise<void>> = () => {
  const locale = inject(LocaleService);
  return locale.load('en');
};
