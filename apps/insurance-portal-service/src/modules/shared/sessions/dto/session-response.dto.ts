import { UserSession } from '../entities/user-session.entity';

export class SessionResponseDto {
  id: string;
  device_id: string | null;
  family_id: string;
  ip_address: string | null;
  user_agent: string | null;
  device_info: Record<string, unknown> | null;

  expires_at: Date;
  absolute_expires_at: Date | null;
  idle_expires_at: Date | null;
  last_used_at: Date;
  last_activity_at: Date;
  last_ip_address: string | null;
  authentication_strength: string;
  risk_level: string;
  created_at: Date;
  is_current: boolean;

  constructor(session: UserSession, currentSessionId?: string) {
    this.id = session.id;
    this.device_id = session.device_id;
    this.family_id = session.family_id;
    this.ip_address = session.ip_address;
    this.user_agent = session.user_agent;
    this.device_info = session.device_info;
    this.expires_at = session.expires_at;
    this.absolute_expires_at = session.absolute_expires_at;
    this.idle_expires_at = session.idle_expires_at;
    this.last_used_at = session.last_used_at;
    this.last_activity_at = session.last_activity_at;
    this.last_ip_address = session.last_ip_address;
    this.authentication_strength = session.authentication_strength;
    this.risk_level = session.risk_level;
    this.created_at = session.created_at;

    this.is_current = session.id === currentSessionId;
  }
}
