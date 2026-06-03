import { Injectable } from '@nestjs/common';

@Injectable()
export class TiramisRequestIdService {
  generate(prefix = 'AIC'): string {
    const now = new Date();

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hour = String(now.getHours()).padStart(2, '0');
    const minute = String(now.getMinutes()).padStart(2, '0');
    const second = String(now.getSeconds()).padStart(2, '0');

    const random = Math.floor(Math.random() * 999999)
      .toString()
      .padStart(6, '0');

    return `${prefix}${year}${month}${day}${hour}${minute}${second}${random}`;
  }
}
