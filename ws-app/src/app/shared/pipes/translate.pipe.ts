import { Pipe, PipeTransform } from '@angular/core';
import { inject } from '@angular/core';
import { LocaleService } from '../../core/services/locale.service';

@Pipe({ name: 'translate', standalone: true })
export class TranslatePipe implements PipeTransform {
  private locale = inject(LocaleService);
  transform(key: string): string {
    return this.locale.translate(key);
  }
}
