import { UserSession } from '../entities/user-session.entity';

export class SessionResponseDto {
  id: string;
  device_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  device_info: Record<string, unknown> | null;

  expires_at: Date;
  last_used_at: Date;
  created_at: Date;
  is_current: boolean;

  constructor(session: UserSession, currentSessionId?: string) {
    this.id = session.id;
    this.device_id = session.device_id;
    this.ip_address = session.ip_address;
    this.user_agent = session.user_agent;
    this.device_info = session.device_info;
    this.expires_at = session.expires_at;
    this.last_used_at = session.last_used_at;
    this.created_at = session.created_at;

    this.is_current = session.id === currentSessionId;
  }
}
