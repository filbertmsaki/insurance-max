import { Outlet } from 'react-router-dom';
import { BadgeCheck, FileText, Lock, ShieldCheck } from 'lucide-react';
import { APP_NAME } from '@/modules/shared/config';

const HIGHLIGHTS = [
  {
    icon: FileText,
    title: 'Policies & claims in one place',
    description:
      'Issue cover, track claims and manage customers from a single workspace.',
  },
  {
    icon: BadgeCheck,
    title: 'Compliance built in',
    description: 'Regulatory reporting and verification handled as you work.',
  },
  {
    icon: Lock,
    title: 'Secure by default',
    description:
      'Two-factor sign-in and role-based access keep your data protected.',
  },
];

export function AuthLayout() {
  return (
    <div className="vz-auth-split">
      <aside className="vz-auth-hero">
        <div className="flex items-center gap-3">
          <span className="vz-auth-logo">
            <ShieldCheck className="h-6 w-6" />
          </span>
          <span className="text-xl font-bold text-white">{APP_NAME}</span>
        </div>

        <div className="max-w-md">
          <h1 className="text-4xl font-semibold leading-tight text-white">
            Insurance operations, simplified.
          </h1>
          <p className="mt-4 text-base text-white/70">
            Everything your team needs to sell, service and report on insurance
            products, all in one place.
          </p>

          <ul className="mt-10 space-y-6">
            {HIGHLIGHTS.map(({ icon: Icon, title, description }) => (
              <li key={title} className="flex gap-4">
                <span className="vz-auth-hero-icon">
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-medium text-white">{title}</p>
                  <p className="mt-0.5 text-sm text-white/60">{description}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-sm text-white/50">
          © {new Date().getFullYear()} {APP_NAME}. All rights reserved.
        </p>
      </aside>

      <Outlet />
    </div>
  );
}
