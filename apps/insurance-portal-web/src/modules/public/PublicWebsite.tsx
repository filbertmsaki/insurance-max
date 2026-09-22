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
      <Link to="/insurance" aria-label={`Explore ${category.name}`}>
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
  const isMotorCategory = Boolean(
    selectedCategory &&
    (selectedCategory.business_line === 'MOTOR' ||
      selectedCategory.name.toLowerCase().includes('motor')),
  );

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
    navigate('/customer/buy-cover');
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
                          <Link to="/login">
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

export { HomePage, AboutPage, ContactPage, InsurancePage, BuyCoverPage };
