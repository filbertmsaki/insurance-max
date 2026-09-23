import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  CarFront,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  ClipboardCheck,
  FileCheck2,
  Headphones,
  HeartPulse,
  Home as HomeIcon,
  Mail,
  MapPin,
  Menu,
  Phone,
  Plane,
  ShieldCheck,
  Ship,
  Smartphone,
  UserRound,
  WalletCards,
  X,
} from 'lucide-react';

import { apiClient } from '@/modules/shared/api/client';
import './public.css';

type PublicCatalogueProduct = {
  id: string;
  name: string;
  description: string | null;
  product_code: string;
  business_line: string;
  supports_fleet: boolean;
  company: {
    id: string;
    name: string;
    slug: string;
    logo_url: string | null;
  };
};

type PublicCatalogueCategory = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  business_line: string;
  product_count: number;
  products: PublicCatalogueProduct[];
};

type PublicMotorOptions = {
  companies: Array<{
    id: string;
    name: string;
    slug: string;
    logo_url: string | null;
    tira_ready: boolean;
    default_branch: {
      id: string;
      name: string;
      sale_point_name: string | null;
    } | null;
    products: Array<{
      id: string;
      name: string;
      description: string | null;
      product_code: string;
      category_id: string;
      category_name: string | null;
      risks: Array<{
        id: string;
        name: string;
        description: string | null;
        risk_code: string;
        sub_class_id: string | null;
      }>;
    }>;
  }>;
};

type PublicMotorVehicle = {
  motor_category: 1 | 2;
  motor_type: number;
  registration_number: string;
  chassis_number: string;
  make: string;
  model: string;
  model_number?: string | null;
  body_type: string;
  color: string;
  engine_number: string;
  engine_capacity: string;
  fuel_used: string;
  number_of_axles: number;
  axle_distance: number;
  sitting_capacity: number;
  year_of_manufacture: number;
  tare_weight: number;
  gross_weight: number;
  motor_usage: number;
  owner_name: string;
  owner_category: number;
  owner_address: string;
};

type PublicMotorHolder = {
  policy_holder_type: number;
  policy_holder_name: string;
  policy_holder_birth_date: string;
  policy_holder_id_type: number;
  policy_holder_id_number: string;
  gender?: 'M' | 'F' | null;
  country_code: string;
  region: string;
  district: string;
  street?: string | null;
  policy_holder_phone_number: string;
  policy_holder_fax?: string | null;
  postal_address?: string | null;
  email_address?: string | null;
  tin?: string | null;
};

type PublicMotorQuote = {
  company: { id: string; name: string; slug: string; logo_url: string | null };
  product: { id: string; name: string; product_code: string };
  risk: { id: string; name: string; risk_code: string };
  default_branch: {
    id: string;
    name: string;
    sale_point_name: string | null;
  };
  vehicle: PublicMotorVehicle;
  policy_holder: PublicMotorHolder;
  cover_period: { start_date: string; end_date: string };
  premium: {
    pricing_quote_id: string;
    basic_premium: number;
    discount_amount: number;
    premium_after_discount: number;
    charges_amount: number;
    taxes: Array<{
      tax_code: string;
      tax_name: string;
      tax_rate: number;
      tax_amount: number;
    }>;
    vat_amount: number;
    total_amount_payable: number;
    currency: string;
  };
};

type CategoryDisplay = PublicCatalogueCategory & {
  icon: typeof CarFront;
};

type PublicPageKey =
  | 'home'
  | 'insurance'
  | 'about'
  | 'contact'
  | 'claims'
  | 'faq'
  | 'privacy'
  | 'terms';

const publicPages: Record<
  PublicPageKey,
  { label: string; path: string; enabled: boolean }
> = {
  home: { label: 'Home', path: '/', enabled: true },
  insurance: { label: 'Insurance Products', path: '/insurance', enabled: true },
  about: { label: 'About Us', path: '/about', enabled: true },
  contact: { label: 'Contact Us', path: '/contact', enabled: true },
  claims: { label: 'Claims', path: '/claims', enabled: false },
  faq: { label: 'FAQ', path: '/faq', enabled: false },
  privacy: { label: 'Privacy Policy', path: '/privacy', enabled: false },
  terms: { label: 'Terms & Conditions', path: '/terms', enabled: false },
};

const mainNav = [
  publicPages.home,
  publicPages.insurance,
  publicPages.about,
  publicPages.contact,
].filter((page) => page.enabled);

const categoryIconChoices = [
  {
    name: 'Motor Insurance',
    icon: CarFront,
  },
  {
    name: 'Health Insurance',
    icon: HeartPulse,
  },
  {
    name: 'Travel Insurance',
    icon: Plane,
  },
  {
    name: 'Home / Property Insurance',
    icon: HomeIcon,
  },
  {
    name: 'Business Insurance',
    icon: BriefcaseBusiness,
  },
  {
    name: 'Personal Accident',
    icon: UserRound,
  },
  {
    name: 'Marine / Transit Insurance',
    icon: Ship,
  },
  {
    name: 'Other General Insurance',
    icon: Building2,
  },
];

const heroSlides = [
  {
    title: 'Insurance made simple.',
    body: 'Discover and buy cover through a clear digital experience designed for people who want practical protection without the runaround.',
    action: 'Explore Insurance',
    image:
      'https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=1400&q=80',
    alt: 'Customer reviewing insurance documents at a desk',
  },
  {
    title: 'Protect what matters most.',
    body: 'Explore motor, health, travel, property and business insurance options from one straightforward place.',
    action: 'View Products',
    image:
      'https://images.unsplash.com/photo-1521791136064-7986c2920216?auto=format&fit=crop&w=1400&q=80',
    alt: 'Advisor and customer having a professional insurance conversation',
  },
  {
    title: 'Buy insurance with confidence.',
    body: 'Move from discovery to your next step with secure account access, clear choices and digital self-service.',
    action: 'Get Started',
    image:
      'https://images.unsplash.com/photo-1556745757-8d76bdb6984b?auto=format&fit=crop&w=1400&q=80',
    alt: 'Person securely completing a digital service on a laptop',
  },
];

const quickActions = [
  {
    title: 'Buy Insurance',
    body: 'Find the right cover.',
    path: '/buy-cover',
    icon: FileCheck2,
  },
  {
    title: 'My Policies',
    body: 'Access policies after login.',
    path: '/customer/policies',
    icon: ShieldCheck,
  },
  {
    title: 'Make a Claim',
    body: 'Access claim services.',
    path: '/customer/claims',
    icon: ClipboardCheck,
  },
  {
    title: 'Get Support',
    body: 'Contact our support team.',
    path: '/contact',
    icon: Headphones,
  },
];

const trustItems = [
  {
    title: 'Simple Insurance Purchase',
    body: 'Plain language and clear steps help you move with confidence.',
    icon: Check,
  },
  {
    title: 'Secure Transactions',
    body: 'Account access and customer information are handled through the existing secure portal.',
    icon: ShieldCheck,
  },
  {
    title: 'Multiple Insurance Products',
    body: 'Start with motor, health, travel, property, business and other general cover.',
    icon: WalletCards,
  },
  {
    title: 'Convenient Self-Service',
    body: 'Return to your account when you need policies, claims or documents.',
    icon: Smartphone,
  },
];

const howItWorks = [
  ['1', 'Choose Insurance', 'Select the cover that matches your needs.'],
  [
    '2',
    'Provide Your Details',
    'Share the information required for the selected product.',
  ],
  [
    '3',
    'Review & Pay',
    'Confirm your details and complete the next step securely.',
  ],
  ['4', 'Get Covered', 'Access your insurance documents digitally.'],
];

const contactSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter your full name.'),
  email: z.string().trim().email('Enter a valid email address.'),
  phone: z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || /^\+?[\d\s().-]{7,30}$/.test(value), {
      message: 'Enter a valid phone number.',
    }),
  subject: z.string().trim().min(3, 'Enter a subject.'),
  message: z.string().trim().min(12, 'Tell us a little more.'),
});

type ContactFormValues = z.infer<typeof contactSchema>;

const motorIntakeSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, 'Enter the full name on the vehicle registration card.'),
  registrationNumber: z
    .string()
    .trim()
    .min(3, 'Enter a vehicle registration number.'),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[\d\s().-]{7,30}$/, 'Enter a valid phone number.'),
});

type MotorIntakeValues = z.infer<typeof motorIntakeSchema>;

function usePageMeta(title: string, description: string) {
  useEffect(() => {
    document.title = title;

    const meta =
      document.querySelector<HTMLMetaElement>('meta[name="description"]') ??
      document.createElement('meta');
    meta.setAttribute('name', 'description');
    meta.setAttribute('content', description);
    document.head.appendChild(meta);

    const ogTitle =
      document.querySelector<HTMLMetaElement>('meta[property="og:title"]') ??
      document.createElement('meta');
    ogTitle.setAttribute('property', 'og:title');
    ogTitle.setAttribute('content', title);
    document.head.appendChild(ogTitle);

    const ogDescription =
      document.querySelector<HTMLMetaElement>(
        'meta[property="og:description"]',
      ) ?? document.createElement('meta');
    ogDescription.setAttribute('property', 'og:description');
    ogDescription.setAttribute('content', description);
    document.head.appendChild(ogDescription);

    const canonical =
      document.querySelector<HTMLLinkElement>('link[rel="canonical"]') ??
      document.createElement('link');
    canonical.setAttribute('rel', 'canonical');
    canonical.setAttribute('href', window.location.href.split('?')[0]);
    document.head.appendChild(canonical);
  }, [description, title]);
}

function usePublicCatalogue() {
  return useQuery({
    queryKey: ['public', 'catalogue'],
    queryFn: async () => {
      const response = await apiClient.get<PublicCatalogueCategory[]>(
        '/public/catalogue',
        {
          skipAuthRefresh: true,
          suppressErrorToast: true,
        },
      );

      return response.data;
    },
    retry: false,
    staleTime: 60_000,
  });
}

function usePublicMotorOptions() {
  return useQuery({
    queryKey: ['public', 'motor-purchase', 'options'],
    queryFn: async () => {
      const response = await apiClient.get<PublicMotorOptions>(
        '/public/motor-purchase/options',
        {
          skipAuthRefresh: true,
          suppressErrorToast: true,
        },
      );

      return response.data;
    },
    retry: false,
    staleTime: 60_000,
  });
}

function isMotorCatalogueCategory(
  category?: {
    business_line?: string;
    name?: string;
    code?: string;
    products?: Array<{
      business_line?: string;
      name?: string;
      product_code?: string;
    }>;
  } | null,
) {
  const productValue =
    category?.products
      ?.map(
        (product) =>
          `${product.business_line ?? ''} ${product.name ?? ''} ${
            product.product_code ?? ''
          }`,
      )
      .join(' ') ?? '';
  const value = `${category?.business_line ?? ''} ${category?.name ?? ''} ${
    category?.code ?? ''
  } ${productValue}`.toLowerCase();

  return value.includes('motor') || value.includes('vehicle');
}

function money(value: number | string | null | undefined) {
  const amount = Number(value ?? 0);

  return new Intl.NumberFormat('en-TZ', {
    style: 'currency',
    currency: 'TZS',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function coverValue(
  cover: Record<string, unknown>,
  keys: string[],
  fallback = 'Not provided',
) {
  for (const key of keys) {
    const value = cover[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number') return String(value);
  }

  return fallback;
}

function getCategoryIcon(category: PublicCatalogueCategory, index: number) {
  const name = category.name.toLowerCase();
  const code = category.code.toLowerCase();
  const value = `${name} ${code}`;

  if (value.includes('motor') || value.includes('vehicle')) return CarFront;
  if (value.includes('health') || value.includes('medical')) return HeartPulse;
  if (value.includes('travel')) return Plane;
  if (
    value.includes('home') ||
    value.includes('property') ||
    value.includes('fire')
  ) {
    return HomeIcon;
  }
  if (
    value.includes('business') ||
    value.includes('commercial') ||
    value.includes('liability')
  ) {
    return BriefcaseBusiness;
  }
  if (value.includes('accident') || value.includes('personal')) {
    return UserRound;
  }
  if (
    value.includes('marine') ||
    value.includes('transit') ||
    value.includes('cargo')
  ) {
    return Ship;
  }

  return categoryIconChoices[index % categoryIconChoices.length].icon;
}

function toCategoryDisplay(
  categories?: PublicCatalogueCategory[],
  limit?: number,
) {
  return (limit ? categories?.slice(0, limit) : categories)?.map(
    (category, index) => ({
      ...category,
      icon: getCategoryIcon(category, index),
    }),
  );
}

function useDisplayedCatalogue(limit?: number) {
  const catalogueQuery = usePublicCatalogue();
  const categories = useMemo(
    () => toCategoryDisplay(catalogueQuery.data, limit) ?? [],
    [catalogueQuery.data, limit],
  );

  return {
    ...catalogueQuery,
    categories,
  };
}

function EmptyCatalogueState({
  isLoading,
  isError,
}: {
  isLoading: boolean;
  isError: boolean;
}) {
  return (
    <div className="catalogue-empty" role={isError ? 'alert' : 'status'}>
      <CircleHelp size={24} aria-hidden="true" />
      <h3>
        {isLoading
          ? 'Loading available products...'
          : isError
            ? 'Product catalogue could not be loaded.'
            : 'No active products are available yet.'}
      </h3>
      <p>
        {isLoading
          ? 'We are checking the active Insurance Max catalogue.'
          : isError
            ? 'Please try again shortly or contact support if this continues.'
            : 'Active categories and products will appear here once they are published on the platform.'}
      </p>
    </div>
  );
}

function PublicFooter() {
  const supportEmail = import.meta.env.VITE_SUPPORT_EMAIL as string | undefined;
  const supportPhone = import.meta.env.VITE_SUPPORT_PHONE as string | undefined;
  const contactAddress = import.meta.env.VITE_SUPPORT_ADDRESS as
    | string
    | undefined;
  const { categories } = useDisplayedCatalogue(5);

  const insuranceLinks = categories.length
    ? categories.map((category) => ({
        label: category.name,
        path: '/insurance',
        enabled: true,
      }))
    : [
        {
          label: 'Insurance Products',
          path: '/insurance',
          enabled: true,
        },
      ];

  return (
    <footer className="public-footer">
      <div className="public-container footer-grid">
        <div className="footer-intro">
          <Link to="/" className="brand brand-footer">
            <span className="brand-mark">IM</span>
            <span>
              Insurance <span className="brand-light">Max</span>
            </span>
          </Link>
          <p>
            A digital insurance experience for discovering, buying and managing
            cover with less complexity.
          </p>
        </div>

        <FooterColumn
          title="Quick Links"
          links={[
            publicPages.home,
            publicPages.about,
            publicPages.contact,
            { label: 'Login', path: '/login', enabled: true },
          ]}
        />
        <FooterColumn title="Insurance" links={insuranceLinks} />
        <FooterColumn
          title="Support"
          links={[
            publicPages.faq,
            publicPages.claims,
            { label: 'Help', path: '/contact', enabled: true },
            publicPages.contact,
          ]}
        />
        <FooterColumn
          title="Legal"
          links={[publicPages.privacy, publicPages.terms]}
        />

        {(supportEmail || supportPhone || contactAddress) && (
          <div className="footer-contact">
            <h2>Contact</h2>
            {supportEmail && (
              <a href={`mailto:${supportEmail}`}>
                <Mail size={15} /> {supportEmail}
              </a>
            )}
            {supportPhone && (
              <a href={`tel:${supportPhone}`}>
                <Phone size={15} /> {supportPhone}
              </a>
            )}
            {contactAddress && (
              <span>
                <MapPin size={15} /> {contactAddress}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="public-container footer-bottom">
        <span>
          (c) {new Date().getFullYear()} Insurance Max. All rights reserved.
        </span>
        <span>Simple digital insurance.</span>
      </div>
    </footer>
  );
}

function PublicNavbar() {
  const [open, setOpen] = useState(false);
  const [isSticky, setIsSticky] = useState(false);

  useEffect(() => {
    const updateSticky = () => setIsSticky(window.scrollY > 8);
    updateSticky();
    window.addEventListener('scroll', updateSticky, { passive: true });
    return () => window.removeEventListener('scroll', updateSticky);
  }, []);

  return (
    <header className={`public-nav ${isSticky ? 'is-sticky' : ''}`}>
      <div className="public-container nav-inner">
        <Link
          to="/"
          className="brand"
          onClick={() => setOpen(false)}
          aria-label="Insurance Max home"
        >
          <span className="brand-mark">IM</span>
          <span>
            Insurance <span className="brand-light">Max</span>
          </span>
        </Link>

        <nav className="desktop-links" aria-label="Main navigation">
          {mainNav.map((page) => (
            <NavLink key={page.path} to={page.path} end={page.path === '/'}>
              {page.label}
            </NavLink>
          ))}
        </nav>

        <div className="nav-actions">
          <Link className="nav-login" to="/login">
            <UserRound size={16} /> Login
          </Link>
          <Link className="button button-small" to="/buy-cover">
            Get Insurance <ArrowRight size={16} />
          </Link>
        </div>

        <button
          className="menu-button"
          type="button"
          aria-expanded={open}
          aria-controls="mobile-navigation"
          aria-label={open ? 'Close navigation' : 'Open navigation'}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X /> : <Menu />}
        </button>
      </div>

      <nav
        id="mobile-navigation"
        className={`mobile-links ${open ? 'is-open' : ''}`}
        aria-label="Mobile navigation"
      >
        {mainNav.map((page) => (
          <NavLink
            key={page.path}
            to={page.path}
            end={page.path === '/'}
            onClick={() => setOpen(false)}
          >
            {page.label}
          </NavLink>
        ))}
        <div className="mobile-action-row">
          <Link
            className="nav-login mobile-login"
            to="/login"
            onClick={() => setOpen(false)}
          >
            <UserRound size={17} /> Login
          </Link>
          <Link
            className="button"
            to="/buy-cover"
            onClick={() => setOpen(false)}
          >
            Get Insurance <ArrowRight size={16} />
          </Link>
        </div>
      </nav>
    </header>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: Array<{ label: string; path: string; enabled: boolean }>;
}) {
  return (
    <div>
      <h2>{title}</h2>
      {links.map((link) =>
        link.enabled ? (
          <Link to={link.path} key={`${title}-${link.label}`}>
            {link.label}
          </Link>
        ) : (
          <span className="footer-muted" key={`${title}-${link.label}`}>
            {link.label}
          </span>
        ),
      )}
    </div>
  );
}

function PublicLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    document.documentElement.classList.add('public-html');
    document.body.classList.add('public-body');
    return () => {
      document.documentElement.classList.remove('public-html');
      document.body.classList.remove('public-body');
    };
  }, []);

  return (
    <div className="public-site">
      <PublicNavbar />
      {children}
      <PublicFooter />
    </div>
  );
}

function SectionHeader({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string;
  title: string;
  body?: string;
}) {
  return (
    <div className="section-header">
      <span className="eyebrow">{eyebrow}</span>
      <h2>{title}</h2>
      {body && <p>{body}</p>}
    </div>
  );
}

function CategoryCard({
  category,
  index,
}: {
  category: CategoryDisplay;
  index: number;
}) {
  const Icon = category.icon;
  const path = isMotorCatalogueCategory(category)
    ? '/motor-insurance'
    : '/insurance';

  return (
    <article className="category-card">
      <div className={`category-icon category-icon-${index % 4}`}>
        <Icon size={22} aria-hidden="true" />
      </div>
      <h3>{category.name}</h3>
      <p>
        {category.product_count} active product
        {category.product_count === 1 ? '' : 's'}
      </p>
      {category.products.length > 0 && (
        <div
          className="category-products"
          aria-label={`${category.name} products`}
        >
          {category.products.slice(0, 2).map((product) => (
            <span key={product.id}>{product.name}</span>
          ))}
          {category.products.length > 2 && (
            <span>+{category.products.length - 2} more</span>
          )}
        </div>
      )}
      <Link to={path} aria-label={`Explore ${category.name}`}>
        Explore <ArrowRight size={16} aria-hidden="true" />
      </Link>
    </article>
  );
}

function HeroSlider() {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const slide = heroSlides[current];

  useEffect(() => {
    if (paused) return undefined;

    const timer = window.setInterval(
      () => setCurrent((value) => (value + 1) % heroSlides.length),
      7000,
    );

    return () => window.clearInterval(timer);
  }, [paused]);

  return (
    <section
      className="hero-panel"
      aria-roledescription="carousel"
      aria-label="Insurance Max highlights"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="hero-media" aria-hidden="true">
        {heroSlides.map((item, index) => (
          <img
            alt=""
            className={index === current ? 'is-active' : ''}
            decoding="async"
            fetchPriority={index === 0 ? 'high' : 'auto'}
            key={item.title}
            src={item.image}
          />
        ))}
      </div>
      <div className="hero-overlay" />

      <div className="public-container hero-inner">
        <div className="hero-copy" key={slide.title}>
          <span className="eyebrow">Insurance Max</span>
          <h1>{slide.title}</h1>
          <p>{slide.body}</p>
          <Link className="button button-hero" to="/buy-cover">
            {slide.action} <ArrowRight size={17} aria-hidden="true" />
          </Link>
        </div>

        <div
          className="hero-assurance"
          aria-label="Insurance Max service highlights"
        >
          <span>
            <ShieldCheck size={18} aria-hidden="true" /> Secure access
          </span>
          <span>
            <WalletCards size={18} aria-hidden="true" /> Digital purchase
          </span>
          <span>
            <Headphones size={18} aria-hidden="true" /> Support ready
          </span>
        </div>

        <div className="slider-controls">
          <button
            type="button"
            aria-label="Previous slide"
            onClick={() =>
              setCurrent((current - 1 + heroSlides.length) % heroSlides.length)
            }
          >
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          <div className="slider-dots" role="tablist" aria-label="Hero slides">
            {heroSlides.map((item, index) => (
              <button
                className={index === current ? 'is-active' : ''}
                key={item.title}
                type="button"
                aria-label={`Go to slide ${index + 1}: ${item.title}`}
                aria-current={index === current}
                onClick={() => setCurrent(index)}
              />
            ))}
          </div>
          <button
            type="button"
            aria-label="Next slide"
            onClick={() => setCurrent((current + 1) % heroSlides.length)}
          >
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  );
}

function HomePage() {
  usePageMeta(
    'Insurance Max | Simple Digital Insurance',
    'Discover and buy insurance through a clear, secure digital experience with Insurance Max.',
  );

  const catalogue = useDisplayedCatalogue(8);

  return (
    <PublicLayout>
      <main>
        <HeroSlider />

        <section className="public-section categories-section">
          <div className="public-container">
            <SectionHeader
              eyebrow="Explore Insurance"
              title="Current products on the platform."
            />
            {catalogue.categories.length ? (
              <div className="category-grid">
                {catalogue.categories.map((category, index) => (
                  <CategoryCard
                    category={category}
                    index={index}
                    key={`${category.business_line}-${category.name}`}
                  />
                ))}
              </div>
            ) : (
              <EmptyCatalogueState
                isLoading={catalogue.isLoading}
                isError={catalogue.isError}
              />
            )}
          </div>
        </section>

        <QuickActionSection />
        <WhyInsuranceMax />
        <HowItWorks />
        <CTASection />
      </main>
    </PublicLayout>
  );
}

function QuickActionSection() {
  return (
    <section className="quick-section">
      <div className="public-container quick-layout">
        <SectionHeader
          eyebrow="Quick Actions"
          title="What would you like to do?"
        />
        <div className="quick-actions">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link to={action.path} key={action.title}>
                <Icon aria-hidden="true" />
                <span>
                  <strong>{action.title}</strong>
                  <small>{action.body}</small>
                </span>
                <ArrowRight aria-hidden="true" />
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function WhyInsuranceMax() {
  return (
    <section className="public-section trust-section">
      <div className="public-container">
        <SectionHeader
          eyebrow="Why Insurance Max"
          title="Clearer insurance, from start to finish."
          body="Insurance Max focuses on useful paths, secure access and plain decisions, without burying customers in insurance terminology."
        />
        <div className="feature-grid">
          {trustItems.map((item) => {
            const Icon = item.icon;
            return (
              <article className="feature-card" key={item.title}>
                <Icon size={22} aria-hidden="true" />
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section className="steps-section">
      <div className="public-container">
        <SectionHeader
          eyebrow="How It Works"
          title="A straightforward path to getting covered."
        />
        <div className="steps-grid">
          {howItWorks.map(([number, title, body]) => (
            <article className="step" key={number}>
              <span>{number}</span>
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTASection() {
  return (
    <section className="cta-section">
      <div className="public-container cta-inner">
        <div>
          <span className="eyebrow">Ready to get covered?</span>
          <h2>Find the protection that suits your needs.</h2>
          <p>
            Explore available insurance products or contact us if you need help
            choosing the right next step.
          </p>
        </div>
        <div className="cta-actions">
          <Link className="button button-light" to="/buy-cover">
            Get Insurance <ArrowRight size={17} aria-hidden="true" />
          </Link>
          <Link className="text-link light-link" to="/contact">
            Contact Us
          </Link>
        </div>
      </div>
    </section>
  );
}

function PageIntro({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string;
  title: string;
  body: string;
}) {
  return (
    <section className="page-intro">
      <div className="public-container">
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{body}</p>
      </div>
    </section>
  );
}

function AboutPage() {
  usePageMeta(
    'About Us | Insurance Max',
    'Learn how Insurance Max is making insurance simpler and more accessible.',
  );

  return (
    <PublicLayout>
      <main>
        <PageIntro
          eyebrow="About Insurance Max"
          title="Making insurance simpler and more accessible."
          body="Insurance Max brings insurance discovery, purchasing and account access into a clearer digital experience."
        />

        <section className="public-section about-story">
          <div className="public-container about-grid">
            <div>
              <SectionHeader
                eyebrow="About Insurance Max"
                title="A better way to navigate insurance."
                body="The platform helps customers explore insurance categories, understand the next step and return to a secure portal for their policies, claims and documents."
              />
            </div>
            <div className="purpose-panel">
              <ShieldCheck size={28} aria-hidden="true" />
              <h3>Our purpose</h3>
              <p>
                Reduce friction in insurance discovery, purchase and management
                so customers can act with more confidence.
              </p>
            </div>
          </div>
        </section>

        <section className="public-section values-section">
          <div className="public-container">
            <SectionHeader
              eyebrow="Mission & Vision"
              title="Built around clarity, access and service."
              body="These statements are intentionally concise and can be replaced with formally approved company language when available."
            />
            <div className="value-grid">
              {[
                [
                  'Mission',
                  'To make insurance easier to discover, buy and manage through practical digital tools.',
                ],
                [
                  'Vision',
                  'A more accessible insurance experience for customers and businesses.',
                ],
                [
                  'What We Offer',
                  'Insurance discovery, customer self-service and clear routes into support.',
                ],
              ].map(([title, body], index) => (
                <article className="value-item" key={title}>
                  <span>0{index + 1}</span>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <WhyInsuranceMax />
        <CTASection />
      </main>
    </PublicLayout>
  );
}

function ContactPage() {
  usePageMeta(
    'Contact Us | Insurance Max',
    'Get in touch with Insurance Max for help with insurance, your account or our services.',
  );

  return (
    <PublicLayout>
      <main>
        <PageIntro
          eyebrow="Contact Us"
          title="We're here to help."
          body="Have a question about insurance, your account or our services? Get in touch with our team."
        />
        <ContactContent />
      </main>
    </PublicLayout>
  );
}

function ContactContent() {
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [lastSubmitAt, setLastSubmitAt] = useState(0);
  const timeoutRef = useRef<number | null>(null);
  const supportEmail = import.meta.env.VITE_SUPPORT_EMAIL as string | undefined;
  const supportPhone = import.meta.env.VITE_SUPPORT_PHONE as string | undefined;
  const contactAddress = import.meta.env.VITE_SUPPORT_ADDRESS as
    | string
    | undefined;
  const workingHours = import.meta.env.VITE_SUPPORT_HOURS as string | undefined;

  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      fullName: '',
      email: '',
      phone: '',
      subject: '',
      message: '',
    },
  });

  useEffect(
    () => () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    },
    [],
  );

  function handleContactSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    void form.handleSubmit((values) => {
      const now = Date.now();
      if (now - lastSubmitAt < 10_000) {
        form.setError('root', {
          message: 'Please wait a few seconds before sending another message.',
        });
        return;
      }

      setLastSubmitAt(now);
      setSending(true);
      form.clearErrors('root');

      timeoutRef.current = window.setTimeout(() => {
        setSending(false);
        setSent(true);
        form.reset(values);
      }, 700);
    })(event);
  }

  return (
    <section className="public-section contact-section">
      <div className="public-container contact-grid">
        <div className="contact-details">
          <SectionHeader
            eyebrow="Reach Out"
            title="Tell us what you need."
            body="Use the form for product questions, account support or service enquiries. Configured company contact details appear here when available."
          />

          <ContactDetail
            icon={Mail}
            title="Email"
            content={
              supportEmail ? (
                <a href={`mailto:${supportEmail}`}>{supportEmail}</a>
              ) : (
                <span>Support email is not configured yet.</span>
              )
            }
          />
          {supportPhone && (
            <ContactDetail
              icon={Phone}
              title="Telephone"
              content={<a href={`tel:${supportPhone}`}>{supportPhone}</a>}
            />
          )}
          {contactAddress && (
            <ContactDetail
              icon={MapPin}
              title="Address"
              content={<span>{contactAddress}</span>}
            />
          )}
          {workingHours && (
            <ContactDetail
              icon={CircleHelp}
              title="Working Hours"
              content={<span>{workingHours}</span>}
            />
          )}
        </div>

        <form
          className="contact-form"
          onSubmit={handleContactSubmit}
          noValidate
        >
          {sent ? (
            <div className="form-success" role="status">
              <Check size={24} aria-hidden="true" />
              <h2>Message received</h2>
              <p>Thank you for reaching out. We will be in touch soon.</p>
              <button
                className="button"
                type="button"
                onClick={() => setSent(false)}
              >
                Send another message
              </button>
            </div>
          ) : (
            <>
              <div className="form-row">
                <PublicField
                  id="fullName"
                  label="Full Name"
                  error={form.formState.errors.fullName?.message}
                >
                  <input
                    id="fullName"
                    autoComplete="name"
                    placeholder="Your name"
                    {...form.register('fullName')}
                  />
                </PublicField>
                <PublicField
                  id="email"
                  label="Email"
                  error={form.formState.errors.email?.message}
                >
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    {...form.register('email')}
                  />
                </PublicField>
              </div>

              <div className="form-row">
                <PublicField
                  id="phone"
                  label="Phone Number"
                  error={form.formState.errors.phone?.message}
                >
                  <input
                    id="phone"
                    type="tel"
                    autoComplete="tel"
                    placeholder="Optional"
                    {...form.register('phone')}
                  />
                </PublicField>
                <PublicField
                  id="subject"
                  label="Subject"
                  error={form.formState.errors.subject?.message}
                >
                  <input
                    id="subject"
                    placeholder="How can we help?"
                    {...form.register('subject')}
                  />
                </PublicField>
              </div>

              <PublicField
                id="message"
                label="Message"
                error={form.formState.errors.message?.message}
              >
                <textarea
                  id="message"
                  rows={6}
                  placeholder="Tell us a little more..."
                  {...form.register('message')}
                />
              </PublicField>

              {form.formState.errors.root?.message && (
                <p className="form-error" role="alert">
                  {form.formState.errors.root.message}
                </p>
              )}

              <button className="button" type="submit" disabled={sending}>
                {sending ? 'Sending...' : 'Send Message'}
                <ArrowRight size={17} aria-hidden="true" />
              </button>
              <p className="form-note">
                Please do not include passwords or sensitive payment
                information.
              </p>
            </>
          )}
        </form>
      </div>
    </section>
  );
}

function ContactDetail({
  icon: Icon,
  title,
  content,
}: {
  icon: typeof Mail;
  title: string;
  content: React.ReactNode;
}) {
  return (
    <div className="contact-detail">
      <Icon aria-hidden="true" />
      <div>
        <strong>{title}</strong>
        {content}
      </div>
    </div>
  );
}

function createDefaultMotorVehicle(
  intake?: MotorIntakeValues | null,
): PublicMotorVehicle {
  return {
    motor_category: 1,
    motor_type: 1,
    registration_number:
      intake?.registrationNumber.trim().toUpperCase().replace(/\s+/g, '') ?? '',
    chassis_number: '',
    make: '',
    model: '',
    model_number: '',
    body_type: '',
    color: '',
    engine_number: '',
    engine_capacity: '',
    fuel_used: '',
    number_of_axles: 2,
    axle_distance: 0,
    sitting_capacity: 1,
    year_of_manufacture: new Date().getFullYear(),
    tare_weight: 0,
    gross_weight: 0,
    motor_usage: 1,
    owner_name: intake?.fullName.trim() ?? '',
    owner_category: 1,
    owner_address: '',
  };
}

function createDefaultPolicyHolder(
  intake?: MotorIntakeValues | null,
): PublicMotorHolder {
  return {
    policy_holder_type: 1,
    policy_holder_name: intake?.fullName.trim() ?? '',
    policy_holder_birth_date: '',
    policy_holder_id_type: 1,
    policy_holder_id_number: '',
    gender: null,
    country_code: 'TZA',
    region: '',
    district: '',
    street: '',
    policy_holder_phone_number: intake?.phone.trim() ?? '',
    policy_holder_fax: '',
    postal_address: '',
    email_address: '',
    tin: '',
  };
}

function readStoredMotorIntake(): MotorIntakeValues {
  if (typeof window === 'undefined') {
    return {
      fullName: '',
      registrationNumber: '',
      phone: '',
    };
  }

  const raw = window.sessionStorage.getItem('insurance-max.buy-cover-intake');
  if (!raw) {
    return {
      fullName: '',
      registrationNumber: '',
      phone: '',
    };
  }

  try {
    const parsed = JSON.parse(raw) as {
      motor?: {
        full_name?: string;
        registration_number?: string;
        phone?: string;
      } | null;
    };
    const motor = parsed.motor;
    if (!motor) {
      return {
        fullName: '',
        registrationNumber: '',
        phone: '',
      };
    }

    return {
      fullName: motor.full_name ?? '',
      registrationNumber: motor.registration_number ?? '',
      phone: motor.phone ?? '',
    };
  } catch {
    return {
      fullName: '',
      registrationNumber: '',
      phone: '',
    };
  }
}

function MotorInsurancePurchasePage() {
  usePageMeta(
    'Motor Insurance | Insurance Max',
    'Buy motor insurance through a simple public self-service flow.',
  );

  const navigate = useNavigate();
  const optionsQuery = usePublicMotorOptions();
  const initialMotorIntake = useMemo(() => readStoredMotorIntake(), []);
  const [intake, setIntake] = useState<MotorIntakeValues>(initialMotorIntake);
  const [companyId, setCompanyId] = useState('');
  const [productId, setProductId] = useState('');
  const [riskId, setRiskId] = useState('');
  const [vehicle, setVehicle] = useState<PublicMotorVehicle>(
    createDefaultMotorVehicle(initialMotorIntake),
  );
  const [holder, setHolder] = useState<PublicMotorHolder>(
    createDefaultPolicyHolder(initialMotorIntake),
  );
  const [sumInsured, setSumInsured] = useState('');
  const [verified, setVerified] = useState(false);
  const [activeCover, setActiveCover] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [quote, setQuote] = useState<PublicMotorQuote | null>(null);
  const [submitted, setSubmitted] = useState<Record<string, unknown> | null>(
    null,
  );
  const [busy, setBusy] = useState<'verify' | 'quote' | 'submit' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const companies = optionsQuery.data?.companies ?? [];
  const selectedCompany =
    companies.find((company) => company.id === companyId) ?? companies[0];
  const selectedProduct =
    selectedCompany?.products.find((product) => product.id === productId) ??
    selectedCompany?.products[0];
  const selectedRisk =
    selectedProduct?.risks.find((risk) => risk.id === riskId) ??
    selectedProduct?.risks[0];

  function customerMessage(errorValue: unknown) {
    const value = errorValue as {
      response?: { data?: { message?: string | string[] } };
      message?: string;
    };
    const message = value.response?.data?.message ?? value.message;
    if (Array.isArray(message)) return message[0] ?? 'Please try again.';
    return message || 'Please try again.';
  }

  async function verifyVehicle(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setActiveCover(null);
    setQuote(null);
    setSubmitted(null);
    setConfirmed(false);

    const parsed = motorIntakeSchema.safeParse(intake);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the vehicle details.');
      return;
    }

    if (!selectedCompany) {
      setError('No motor insurer is currently available.');
      return;
    }

    setBusy('verify');
    try {
      const response = await apiClient.post<{
        status: 'ACTIVE_COVER' | 'NO_ACTIVE_COVER';
        active_cover?: Record<string, unknown>;
        vehicle?: Partial<PublicMotorVehicle>;
      }>(
        '/public/motor-purchase/verify',
        {
          company_id: selectedCompany.id,
          full_name: parsed.data.fullName,
          registration_number: parsed.data.registrationNumber,
          phone: parsed.data.phone,
          motor_category: 1,
        },
        {
          skipAuthRefresh: true,
          suppressErrorToast: true,
        },
      );

      if (response.data.status === 'ACTIVE_COVER') {
        setActiveCover(response.data.active_cover ?? {});
        setVerified(false);
        return;
      }

      const nextVehicle = {
        ...createDefaultMotorVehicle(parsed.data),
        ...response.data.vehicle,
        registration_number:
          response.data.vehicle?.registration_number ||
          parsed.data.registrationNumber.trim().toUpperCase(),
        owner_name:
          response.data.vehicle?.owner_name || parsed.data.fullName.trim(),
      };
      setVehicle(nextVehicle);
      setHolder(createDefaultPolicyHolder(parsed.data));
      setVerified(true);
    } catch (caught) {
      setError(customerMessage(caught));
    } finally {
      setBusy(null);
    }
  }

  async function calculateQuote(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setQuote(null);
    setConfirmed(false);

    if (!selectedCompany || !selectedProduct || !selectedRisk) {
      setError('Select an insurance company, product and cover.');
      return;
    }

    setBusy('quote');
    try {
      const payload = {
        company_id: selectedCompany.id,
        product_id: selectedProduct.id,
        risk_id: selectedRisk.id,
        vehicle,
        policy_holder: holder,
        sum_insured: Number(sumInsured || vehicle.gross_weight || 0),
      };
      const response = await apiClient.post<PublicMotorQuote>(
        '/public/motor-purchase/quote',
        payload,
        {
          skipAuthRefresh: true,
          suppressErrorToast: true,
        },
      );

      setQuote(response.data);
    } catch (caught) {
      setError(customerMessage(caught));
    } finally {
      setBusy(null);
    }
  }

  async function submitPurchase() {
    if (!quote || !confirmed) return;
    setError(null);
    setBusy('submit');

    try {
      const response = await apiClient.post<Record<string, unknown>>(
        '/public/motor-purchase/submit',
        {
          company_id: quote.company.id,
          product_id: quote.product.id,
          risk_id: quote.risk.id,
          vehicle,
          policy_holder: holder,
          sum_insured: Number(sumInsured || vehicle.gross_weight || 0),
          confirmed: true,
          idempotency_key: `${vehicle.registration_number}-${quote.premium.pricing_quote_id}`,
        },
        {
          skipAuthRefresh: true,
          suppressErrorToast: true,
        },
      );

      setSubmitted(response.data);
    } catch (caught) {
      setError(customerMessage(caught));
    } finally {
      setBusy(null);
    }
  }

  function updateVehicle<K extends keyof PublicMotorVehicle>(
    key: K,
    value: PublicMotorVehicle[K],
  ) {
    setVehicle((current) => ({ ...current, [key]: value }));
    setQuote(null);
    setConfirmed(false);
  }

  function updateHolder<K extends keyof PublicMotorHolder>(
    key: K,
    value: PublicMotorHolder[K],
  ) {
    setHolder((current) => ({ ...current, [key]: value }));
    setQuote(null);
    setConfirmed(false);
  }

  return (
    <PublicLayout>
      <main>
        <PageIntro
          eyebrow="Motor Insurance"
          title="Buy cover for one vehicle."
          body="Enter the registration details, confirm the vehicle and policy holder information, choose a configured motor cover, then review the quote before submission."
        />

        <section className="public-section motor-purchase-section">
          <div className="public-container motor-purchase-layout">
            <div className="motor-progress" aria-label="Purchase progress">
              {[
                ['1', 'Vehicle Information'],
                ['2', 'Verification'],
                ['3', 'Vehicle & Policy Holder Details'],
                ['4', 'Cover Selection'],
                ['5', 'Summary'],
                ['6', 'Submit'],
              ].map(([number, label]) => (
                <span key={label}>
                  <strong>{number}</strong>
                  {label}
                </span>
              ))}
            </div>

            {error && (
              <div className="motor-alert motor-alert-error" role="alert">
                {error}
              </div>
            )}

            {submitted ? (
              <div className="motor-result-panel">
                <Check size={28} aria-hidden="true" />
                <h2>Motor purchase submitted</h2>
                <p>
                  Your request has been sent for processing. Reference:{' '}
                  <strong>
                    {String(
                      submitted.quotation_no ??
                        submitted.quotation_id ??
                        'Submitted',
                    )}
                  </strong>
                </p>
                <button
                  className="button"
                  type="button"
                  onClick={() => navigate('/')}
                >
                  Back to Home
                </button>
              </div>
            ) : activeCover ? (
              <div className="motor-result-panel">
                <ShieldCheck size={28} aria-hidden="true" />
                <h2>Active insurance found</h2>
                <p>
                  This vehicle already has active insurance. A new purchase
                  cannot continue for the same vehicle.
                </p>
                <div className="motor-summary-grid">
                  <SummaryItem
                    label="Registration"
                    value={coverValue(
                      activeCover,
                      [
                        'vehicle_registration_number',
                        'motorRegistrationNumber',
                        'MotorRegistrationNumber',
                        'registrationNumber',
                        'RegistrationNumber',
                      ],
                      intake.registrationNumber,
                    )}
                  />
                  <SummaryItem
                    label="Cover"
                    value={coverValue(activeCover, [
                      'cover_type',
                      'coverType',
                      'CoverNoteTypeDesc',
                      'CoverNoteType',
                      'ProductName',
                    ])}
                  />
                  <SummaryItem
                    label="Company"
                    value={coverValue(activeCover, [
                      'insurance_company',
                      'insuranceCompany',
                      'insurerName',
                      'companyName',
                      'InsurerCompanyName',
                      'TransactionCompanyName',
                      'InsurerCompanyCode',
                    ])}
                  />
                  <SummaryItem
                    label="Start Date"
                    value={coverValue(activeCover, [
                      'cover_start_date',
                      'coverNoteStartDate',
                      'CoverNoteStartDate',
                      'coverStartDate',
                      'CoverStartDate',
                      'startDate',
                      'StartDate',
                      'CoverNoteIssueDate',
                    ])}
                  />
                  <SummaryItem
                    label="End Date"
                    value={coverValue(activeCover, [
                      'cover_end_date',
                      'coverNoteEndDate',
                      'CoverNoteEndDate',
                      'coverEndDate',
                      'CoverEndDate',
                      'expiryDate',
                      'ExpiryDate',
                      'endDate',
                      'EndDate',
                    ])}
                  />
                </div>
                <div className="motor-actions">
                  <button
                    className="button button-light"
                    type="button"
                    onClick={() => {
                      setActiveCover(null);
                      setVerified(false);
                    }}
                  >
                    Check Another Vehicle
                  </button>
                  <button
                    className="button"
                    type="button"
                    onClick={() => navigate('/')}
                  >
                    Back to Home
                  </button>
                </div>
              </div>
            ) : (
              <>
                <form className="motor-panel" onSubmit={verifyVehicle}>
                  <SectionHeader
                    eyebrow="Step 1"
                    title="Initial vehicle information"
                    body="Only these three details are needed to start. Vehicle information is retrieved where available."
                  />
                  <div className="form-row">
                    <PublicField id="publicMotorFullName" label="Full Name">
                      <input
                        id="publicMotorFullName"
                        autoComplete="name"
                        value={intake.fullName}
                        onChange={(event) =>
                          setIntake((current) => ({
                            ...current,
                            fullName: event.target.value,
                          }))
                        }
                      />
                    </PublicField>
                    <PublicField
                      id="publicMotorRegistration"
                      label="Vehicle Registration Number"
                    >
                      <input
                        id="publicMotorRegistration"
                        autoCapitalize="characters"
                        value={intake.registrationNumber}
                        onChange={(event) =>
                          setIntake((current) => ({
                            ...current,
                            registrationNumber: event.target.value,
                          }))
                        }
                      />
                    </PublicField>
                  </div>
                  <PublicField id="publicMotorPhone" label="Phone Number">
                    <input
                      id="publicMotorPhone"
                      autoComplete="tel"
                      inputMode="tel"
                      value={intake.phone}
                      onChange={(event) =>
                        setIntake((current) => ({
                          ...current,
                          phone: event.target.value,
                        }))
                      }
                    />
                  </PublicField>
                  <button
                    className="button"
                    type="submit"
                    disabled={busy === 'verify' || optionsQuery.isLoading}
                  >
                    {busy === 'verify' ? 'Checking...' : 'Proceed'}
                    <ArrowRight size={17} aria-hidden="true" />
                  </button>
                </form>

                {verified && (
                  <form className="motor-panel" onSubmit={calculateQuote}>
                    <SectionHeader
                      eyebrow="Steps 3 & 4"
                      title="Confirm details and select cover"
                    />

                    <div className="form-row">
                      <PublicField
                        id="publicMotorCompany"
                        label="Insurance Company"
                      >
                        <select
                          id="publicMotorCompany"
                          value={selectedCompany?.id ?? ''}
                          onChange={(event) => {
                            setCompanyId(event.target.value);
                            setProductId('');
                            setRiskId('');
                            setQuote(null);
                          }}
                        >
                          {companies.map((company) => (
                            <option key={company.id} value={company.id}>
                              {company.name}
                            </option>
                          ))}
                        </select>
                      </PublicField>
                      <PublicField id="publicMotorProduct" label="Product">
                        <select
                          id="publicMotorProduct"
                          value={selectedProduct?.id ?? ''}
                          onChange={(event) => {
                            setProductId(event.target.value);
                            setRiskId('');
                            setQuote(null);
                          }}
                        >
                          {selectedCompany?.products.map((product) => (
                            <option key={product.id} value={product.id}>
                              {product.name}
                            </option>
                          ))}
                        </select>
                      </PublicField>
                    </div>

                    <div className="form-row">
                      <PublicField id="publicMotorRisk" label="Cover">
                        <select
                          id="publicMotorRisk"
                          value={selectedRisk?.id ?? ''}
                          onChange={(event) => {
                            setRiskId(event.target.value);
                            setQuote(null);
                          }}
                        >
                          {selectedProduct?.risks.map((risk) => (
                            <option key={risk.id} value={risk.id}>
                              {risk.name}
                            </option>
                          ))}
                        </select>
                      </PublicField>
                      <PublicField
                        id="publicMotorSumInsured"
                        label="Vehicle Value"
                      >
                        <input
                          id="publicMotorSumInsured"
                          inputMode="decimal"
                          value={sumInsured}
                          onChange={(event) => {
                            setSumInsured(event.target.value);
                            setQuote(null);
                            setConfirmed(false);
                          }}
                        />
                      </PublicField>
                    </div>

                    <div className="motor-subgrid">
                      <MotorInput
                        label="Chassis Number"
                        value={vehicle.chassis_number}
                        onChange={(value) =>
                          updateVehicle('chassis_number', value)
                        }
                      />
                      <MotorInput
                        label="Make"
                        value={vehicle.make}
                        onChange={(value) => updateVehicle('make', value)}
                      />
                      <MotorInput
                        label="Model"
                        value={vehicle.model}
                        onChange={(value) => updateVehicle('model', value)}
                      />
                      <MotorInput
                        label="Body Type"
                        value={vehicle.body_type}
                        onChange={(value) => updateVehicle('body_type', value)}
                      />
                      <MotorInput
                        label="Engine Number"
                        value={vehicle.engine_number}
                        onChange={(value) =>
                          updateVehicle('engine_number', value)
                        }
                      />
                      <MotorInput
                        label="Engine Capacity"
                        value={vehicle.engine_capacity}
                        onChange={(value) =>
                          updateVehicle('engine_capacity', value)
                        }
                      />
                      <MotorNumberInput
                        label="Year"
                        value={vehicle.year_of_manufacture}
                        onChange={(value) =>
                          updateVehicle('year_of_manufacture', value)
                        }
                      />
                      <MotorNumberInput
                        label="Seats"
                        value={vehicle.sitting_capacity}
                        onChange={(value) =>
                          updateVehicle('sitting_capacity', value)
                        }
                      />
                    </div>

                    <div className="motor-subgrid">
                      <MotorInput
                        label="ID Number"
                        value={holder.policy_holder_id_number}
                        onChange={(value) =>
                          updateHolder('policy_holder_id_number', value)
                        }
                      />
                      <MotorInput
                        label="Date of Birth"
                        type="date"
                        value={holder.policy_holder_birth_date}
                        onChange={(value) =>
                          updateHolder('policy_holder_birth_date', value)
                        }
                      />
                      <MotorInput
                        label="Email"
                        type="email"
                        value={holder.email_address ?? ''}
                        onChange={(value) =>
                          updateHolder('email_address', value)
                        }
                      />
                      <MotorInput
                        label="Region"
                        value={holder.region}
                        onChange={(value) => updateHolder('region', value)}
                      />
                      <MotorInput
                        label="District"
                        value={holder.district}
                        onChange={(value) => updateHolder('district', value)}
                      />
                      <MotorInput
                        label="Street"
                        value={holder.street ?? ''}
                        onChange={(value) => updateHolder('street', value)}
                      />
                    </div>

                    <button
                      className="button"
                      type="submit"
                      disabled={busy === 'quote'}
                    >
                      {busy === 'quote' ? 'Calculating...' : 'Calculate Quote'}
                      <ArrowRight size={17} aria-hidden="true" />
                    </button>
                  </form>
                )}

                {quote && (
                  <div className="motor-panel">
                    <SectionHeader eyebrow="Step 5" title="Quote summary" />
                    <div className="motor-summary-grid">
                      <SummaryItem
                        label="Customer"
                        value={holder.policy_holder_name}
                      />
                      <SummaryItem
                        label="Vehicle"
                        value={`${vehicle.make} ${vehicle.model} ${vehicle.registration_number}`}
                      />
                      <SummaryItem label="Company" value={quote.company.name} />
                      <SummaryItem label="Cover" value={quote.risk.name} />
                      <SummaryItem
                        label="Branch"
                        value={quote.default_branch.name}
                      />
                      <SummaryItem
                        label="Cover Period"
                        value={`${quote.cover_period.start_date} to ${quote.cover_period.end_date}`}
                      />
                      <SummaryItem
                        label="Basic Premium"
                        value={money(quote.premium.basic_premium)}
                      />
                      <SummaryItem
                        label="Discounts"
                        value={money(quote.premium.discount_amount)}
                      />
                      <SummaryItem
                        label="Levies/Charges"
                        value={money(quote.premium.charges_amount)}
                      />
                      <SummaryItem
                        label="VAT"
                        value={money(quote.premium.vat_amount)}
                      />
                      <SummaryItem
                        label="Total Payable"
                        value={money(quote.premium.total_amount_payable)}
                      />
                    </div>
                    <label className="motor-confirm">
                      <input
                        type="checkbox"
                        checked={confirmed}
                        onChange={(event) => setConfirmed(event.target.checked)}
                      />
                      <span>The information above is correct.</span>
                    </label>
                    <button
                      className="button"
                      type="button"
                      disabled={!confirmed || busy === 'submit'}
                      onClick={() => void submitPurchase()}
                    >
                      {busy === 'submit' ? 'Submitting...' : 'Submit'}
                      <ArrowRight size={17} aria-hidden="true" />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </main>
    </PublicLayout>
  );
}

function MotorInput({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  const id = `motor-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

  return (
    <label htmlFor={id}>
      <span>{label}</span>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function MotorNumberInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <MotorInput
      label={label}
      value={String(value)}
      onChange={(next) => onChange(Number(next) || 0)}
    />
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value || 'Not provided'}</strong>
    </div>
  );
}

function PublicField({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label htmlFor={id}>
      <span>{label}</span>
      {children}
      {error && (
        <span className="form-error" role="alert">
          {error}
        </span>
      )}
    </label>
  );
}

function BuyCoverPage() {
  usePageMeta(
    'Buy Cover | Insurance Max',
    'Start buying insurance by selecting a category and entering only the basic details needed to begin.',
  );

  const navigate = useNavigate();
  const catalogue = useDisplayedCatalogue();
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    null,
  );
  const selectedCategory =
    catalogue.categories.find(
      (category) => category.id === selectedCategoryId,
    ) ?? null;
  const isMotorCategory = isMotorCatalogueCategory(selectedCategory);

  const form = useForm<MotorIntakeValues>({
    resolver: zodResolver(motorIntakeSchema),
    defaultValues: {
      fullName: '',
      registrationNumber: '',
      phone: '',
    },
  });

  function continueToPurchase(values?: MotorIntakeValues) {
    const payload = {
      category_id: selectedCategory?.id ?? null,
      category_name: selectedCategory?.name ?? null,
      business_line: selectedCategory?.business_line ?? null,
      motor:
        values && isMotorCategory
          ? {
              full_name: values.fullName.trim(),
              registration_number: values.registrationNumber
                .trim()
                .toUpperCase()
                .replace(/\s+/g, ''),
              phone: values.phone.trim(),
            }
          : null,
    };

    window.sessionStorage.setItem(
      'insurance-max.buy-cover-intake',
      JSON.stringify(payload),
    );

    if (isMotorCategory) {
      navigate('/motor-insurance');
      return;
    }

    navigate('/buy-cover');
  }

  function handleProceed(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCategory) return;

    if (isMotorCategory) {
      void form.handleSubmit((values) => continueToPurchase(values))(event);
      return;
    }

    continueToPurchase();
  }

  return (
    <PublicLayout>
      <main>
        <PageIntro
          eyebrow="Buy Cover"
          title="Start with the cover you need."
          body="Select a category, enter the minimum details required, then continue through the secure purchase flow."
        />

        <section className="public-section buy-cover-section">
          <div className="public-container buy-cover-layout">
            <div>
              <SectionHeader
                eyebrow="Step 1"
                title="Select insurance category"
              />
              {catalogue.categories.length ? (
                <div className="buy-category-grid">
                  {catalogue.categories.map((category, index) => {
                    const Icon = category.icon;
                    const active = category.id === selectedCategoryId;

                    return (
                      <button
                        className={active ? 'is-active' : ''}
                        key={`${category.business_line}-${category.name}`}
                        onClick={() => setSelectedCategoryId(category.id)}
                        type="button"
                      >
                        <span
                          className={`category-icon category-icon-${index % 4}`}
                        >
                          <Icon size={21} aria-hidden="true" />
                        </span>
                        <strong>{category.name}</strong>
                        <small>
                          {category.product_count} product
                          {category.product_count === 1 ? '' : 's'}
                        </small>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <EmptyCatalogueState
                  isLoading={catalogue.isLoading}
                  isError={catalogue.isError}
                />
              )}
            </div>

            <form className="buy-detail-panel" onSubmit={handleProceed}>
              <span className="eyebrow">Step 2</span>
              <h2>Enter basic details</h2>

              {!selectedCategory ? (
                <p>Select a category to see the required details.</p>
              ) : isMotorCategory ? (
                <>
                  <PublicField
                    id="motorFullName"
                    label="Full Name"
                    error={form.formState.errors.fullName?.message}
                  >
                    <input
                      id="motorFullName"
                      autoComplete="name"
                      placeholder="As shown on vehicle registration card"
                      {...form.register('fullName')}
                    />
                  </PublicField>
                  <PublicField
                    id="motorRegistrationNumber"
                    label="Vehicle Registration Number"
                    error={form.formState.errors.registrationNumber?.message}
                  >
                    <input
                      id="motorRegistrationNumber"
                      autoCapitalize="characters"
                      placeholder="T123ABC"
                      {...form.register('registrationNumber')}
                    />
                  </PublicField>
                  <PublicField
                    id="motorPhone"
                    label="Phone Number"
                    error={form.formState.errors.phone?.message}
                  >
                    <input
                      id="motorPhone"
                      autoComplete="tel"
                      inputMode="tel"
                      placeholder="+255..."
                      {...form.register('phone')}
                    />
                  </PublicField>
                  <p className="buy-note">
                    We will use the registration number to retrieve available
                    vehicle details in the secure purchase flow.
                  </p>
                </>
              ) : (
                <p>
                  Continue to the secure flow to complete the details needed for
                  {` ${selectedCategory.name}`}.
                </p>
              )}

              <button
                className="button"
                disabled={!selectedCategory}
                type="submit"
              >
                Proceed <ArrowRight size={17} aria-hidden="true" />
              </button>
            </form>
          </div>
        </section>
      </main>
    </PublicLayout>
  );
}

function InsurancePage() {
  usePageMeta(
    'Insurance Products | Insurance Max',
    'Explore insurance categories available through Insurance Max.',
  );

  const catalogue = useDisplayedCatalogue();
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const activeCategory =
    catalogue.categories.find((category) => category.id === activeCategoryId) ??
    catalogue.categories[0];

  return (
    <PublicLayout>
      <main>
        <PageIntro
          eyebrow="Insurance Products"
          title="Products available now."
          body="Browse active categories and products currently offered through Insurance Max."
        />
        <section className="public-section">
          <div className="public-container">
            {catalogue.categories.length ? (
              <div className="catalogue-tabs-layout">
                <div className="catalogue-tabs" role="tablist">
                  {catalogue.categories.map((category, index) => {
                    const Icon = category.icon;
                    const active = category.id === activeCategory?.id;

                    return (
                      <button
                        aria-controls={`catalogue-panel-${category.id}`}
                        aria-selected={active}
                        className={active ? 'is-active' : ''}
                        id={`catalogue-tab-${category.id}`}
                        key={`${category.business_line}-${category.name}`}
                        onClick={() => setActiveCategoryId(category.id)}
                        role="tab"
                        type="button"
                      >
                        <span
                          className={`category-icon category-icon-${index % 4}`}
                        >
                          <Icon size={19} aria-hidden="true" />
                        </span>
                        <span>
                          <strong>{category.name}</strong>
                          <small>
                            {category.product_count} product
                            {category.product_count === 1 ? '' : 's'}
                          </small>
                        </span>
                      </button>
                    );
                  })}
                </div>

                {activeCategory && (
                  <section
                    aria-labelledby={`catalogue-tab-${activeCategory.id}`}
                    className="catalogue-panel"
                    id={`catalogue-panel-${activeCategory.id}`}
                    role="tabpanel"
                  >
                    <div className="catalogue-panel-header">
                      <h2>{activeCategory.name}</h2>
                      <span>
                        {activeCategory.product_count} active product
                        {activeCategory.product_count === 1 ? '' : 's'}
                      </span>
                    </div>

                    <div className="product-grid">
                      {activeCategory.products.map((product) => (
                        <article className="product-card" key={product.id}>
                          <div>
                            <h3>{product.name}</h3>
                            <p>
                              {product.description ||
                                'Product details are available when you continue through the secure portal.'}
                            </p>
                          </div>
                          <div className="product-meta">
                            <span>{product.company.name}</span>
                            {product.supports_fleet && <span>Fleet ready</span>}
                          </div>
                          <Link
                            to={
                              isMotorCatalogueCategory(activeCategory)
                                ? '/motor-insurance'
                                : '/buy-cover'
                            }
                          >
                            Continue <ArrowRight size={16} aria-hidden="true" />
                          </Link>
                        </article>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            ) : (
              <EmptyCatalogueState
                isLoading={catalogue.isLoading}
                isError={catalogue.isError}
              />
            )}
          </div>
        </section>
        <CTASection />
      </main>
    </PublicLayout>
  );
}

export {
  HomePage,
  AboutPage,
  ContactPage,
  InsurancePage,
  BuyCoverPage,
  MotorInsurancePurchasePage,
};
