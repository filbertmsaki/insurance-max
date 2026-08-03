import { Injectable } from '@nestjs/common';

import { MailService } from '../../../shared/mail/mail.service';

@Injectable()
export class ReportMailHealthService {
  constructor(private readonly mailService: MailService) {}

  async test(recipient: string) {
    await this.mailService.sendMail({
      to: recipient,
      subject: 'Insurance Max report mail test',
      text: 'Report mail delivery test completed successfully.',
      html: '<p>Report mail delivery test completed successfully.</p>',
    });

    return {
      recipient,
      sent: true,
    };
  }
}
