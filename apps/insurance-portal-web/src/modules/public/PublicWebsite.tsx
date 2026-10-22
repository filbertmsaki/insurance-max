import {
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
  ChevronDown,
  ChevronRight,
  CircleHelp,
  FileText,
  HeartPulse,
  Home as HomeIcon,
  LogIn,
  Mail,
  MapPin,
  Phone,
  Plane,
  ShieldCheck,
  Ship,
  UserRound,
} from 'lucide-react';

import { apiClient } from '@/modules/shared/api/client';
import { VehicleDataAttribution } from '@/components/shared/VehicleDataAttribution';
import { PublicLayout } from './PublicShell';
import { BUY_INSURANCE_PATH } from './public-routes';
import { usePageMeta } from './usePageMeta';
import { CUSTOMER_ID_TYPE_OPTIONS } from '@/modules/tenant/customers/types';
import { motorFields } from '@/modules/tenant/quotations/wizard/utils/motorFields';

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
  if (
    category?.business_line?.toUpperCase().replace(/[ -]/g, '_') === 'NON_MOTOR'
  )
    return false;
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
  onRetry,
}: {
  isLoading: boolean;
  isError: boolean;
  onRetry?: () => void;
}) {
  return (
    <div className="catalogue-empty" role={isError ? 'alert' : 'status'}>
      <CircleHelp size={24} aria-hidden="true" />
      <div>
        <h3>
          {isLoading
            ? 'Loading products…'
            : isError
              ? 'Products could not be loaded.'
              : 'No products are available yet.'}
        </h3>
        {!isLoading && (
          <p>
            {isError
              ? 'Please try again, or contact us if this continues.'
              : 'Contact us to discuss your insurance needs.'}
          </p>
        )}
        {isError && onRetry ? (
          <button className="text-link" type="button" onClick={onRetry}>
            Try again
          </button>
        ) : (
          !isLoading && (
            <Link className="text-link" to="/contact">
              Contact us
            </Link>
          )
        )}
      </div>
    </div>
  );
}

function SectionHeader({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="section-header">
      <div>
        <h2>{title}</h2>
        {body && <p>{body}</p>}
      </div>
      {action}
    </div>
  );
}

function CategoryCard({ category }: { category: CategoryDisplay }) {
  const Icon = category.icon;
  const count = category.products.length;

  return (
    <Link
      className="category-card"
      to={`/insurance?category=${encodeURIComponent(category.id)}`}
    >
      <span className="category-icon">
        <Icon size={22} aria-hidden="true" />
      </span>
      <div>
        <h3>{category.name}</h3>
        {category.description && <p>{category.description}</p>}
        <span className="category-count">
          {count} {count === 1 ? 'product' : 'products'}
        </span>
      </div>
    </Link>
  );
}

function HomeHero() {
  return (
    <section className="home-hero" aria-labelledby="home-title">
      <div className="public-container hero-grid">
        <div className="hero-copy">
          <h1 id="home-title">Insure your vehicle online</h1>
          <p>
            Check your vehicle, choose from available insurers and see your
            premium in TZS before you submit a request.
          </p>
          <div className="hero-actions">
            <Link className="button" to={BUY_INSURANCE_PATH}>
              Buy insurance <ArrowRight size={18} aria-hidden="true" />
            </Link>
            <Link className="button button-outline" to="/insurance">
              View products
            </Link>
          </div>
          <p className="hero-note">
            Have your vehicle registration card and ID ready.
          </p>
        </div>
        <figure className="hero-photo">
          <img
            src="/images/tanzania-road.webp"
            alt="A car beside an open road in Morogoro, Tanzania"
            width="1000"
            height="750"
            fetchPriority="high"
          />
        </figure>
      </div>
    </section>
  );
}

const purchaseSteps = [
  ['Check your vehicle', 'We look up the registration and any active cover.'],
  ['Choose cover', 'Pick an insurer and cover, then confirm your details.'],
  ['Review the premium', 'See charges, taxes and the total before you send.'],
  [
    'Submit and pay',
    'Keep your reference. Your insurer confirms payment and issues cover.',
  ],
] as const;

function PurchaseSteps() {
  return (
    <section className="public-section public-section-tinted">
      <div className="public-container">
        <SectionHeader title="How buying works" />
        <ol className="steps-grid">
          {purchaseSteps.map(([title, body], index) => (
            <li className="step" key={title}>
              <span className="step-number" aria-hidden="true">
                {index + 1}
              </span>
              <div>
                <h3>{title}</h3>
                <p>{body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

const questions = [
  [
    'What do I need for a motor quote?',
    'Your vehicle registration card, a contact phone number and the policyholder’s identification. After the vehicle check you choose the insurer and cover, then confirm the details before a premium is calculated.',
  ],
  [
    'What if my vehicle already has insurance?',
    'The vehicle check shows active cover when a record is found, and a new purchase cannot continue for that vehicle. Check the dates shown and contact your insurer if the record looks wrong.',
  ],
  [
    'Does submitting a request mean I am insured?',
    'No. Submitting creates an insurance request. Keep your reference and confirm payment and policy issuance with your insurer before relying on the cover.',
  ],
  [
    'Can I arrange business, fleet or other insurance?',
    'Online purchase is currently for individual motor vehicles. For fleet and other cover, see the products page and contact us.',
  ],
  [
    'How do I verify a document or get claims help?',
    'Use the verification link printed on the document. For claims, sign in to your account or use the claims contact on your policy.',
  ],
] as const;

function Questions({ all = false }: { all?: boolean }) {
  return (
    <div className="faq-list">
      {questions.slice(0, all ? undefined : 3).map(([question, answer]) => (
        <details key={question}>
          <summary>
            {question}
            <ChevronDown size={20} aria-hidden="true" />
          </summary>
          <p>{answer}</p>
        </details>
      ))}
    </div>
  );
}

function SupportLinks() {
  return (
    <div className="md-card support-card">
      <h3>Already insured?</h3>
      <nav className="support-links" aria-label="Support">
        <Link to="/login">
          <LogIn size={20} aria-hidden="true" />
          <span>
            <strong>Sign in</strong>
            <small>View your policies and requests</small>
          </span>
          <ChevronRight size={18} aria-hidden="true" />
        </Link>
        <Link to="/claim-help">
          <FileText size={20} aria-hidden="true" />
          <span>
            <strong>Make a claim</strong>
            <small>What to prepare and who to contact</small>
          </span>
          <ChevronRight size={18} aria-hidden="true" />
        </Link>
        <Link to="/contact">
          <Mail size={20} aria-hidden="true" />
          <span>
            <strong>Contact us</strong>
            <small>Questions about cover or a request</small>
          </span>
          <ChevronRight size={18} aria-hidden="true" />
        </Link>
      </nav>
    </div>
  );
}

function HomePage() {
  usePageMeta(
    'Insurance Max | Motor insurance online in Tanzania',
    'Check your vehicle, compare available motor cover and request insurance online with Insurance Max.',
  );

  const catalogue = useDisplayedCatalogue(6);
  const totalCategories = catalogue.data?.length ?? 0;

  return (
    <PublicLayout>
      <main>
        <HomeHero />

        <section
          className="public-section"
          aria-labelledby="home-products-title"
        >
          <div className="public-container">
            <div className="section-header">
              <div>
                <h2 id="home-products-title">Available insurance</h2>
              </div>
              {totalCategories > 0 && (
                <Link className="text-link" to="/insurance">
                  All products <ArrowRight size={16} aria-hidden="true" />
                </Link>
              )}
            </div>
            {catalogue.categories.length ? (
              <div className="category-grid">
                {catalogue.categories.map((category) => (
                  <CategoryCard
                    category={category}
                    key={`${category.business_line}-${category.name}`}
                  />
                ))}
              </div>
            ) : (
              <EmptyCatalogueState
                isLoading={catalogue.isLoading}
                isError={catalogue.isError}
                onRetry={() => void catalogue.refetch()}
              />
            )}
          </div>
        </section>

        <PurchaseSteps />

        <section className="public-section" aria-labelledby="home-help-title">
          <div className="public-container help-grid">
            <div>
              <SectionHeader
                title="Common questions"
                action={
                  <Link className="text-link" to="/faq">
                    All questions <ArrowRight size={16} aria-hidden="true" />
                  </Link>
                }
              />
              <Questions />
            </div>
            <SupportLinks />
          </div>
        </section>
      </main>
    </PublicLayout>
  );
}

function PageIntro({ title, body }: { title: string; body?: string }) {
  return (
    <section className="page-intro">
      <div className="public-container">
        <h1>{title}</h1>
        {body && <p>{body}</p>}
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
          title="About Insurance Max"
          body="Insurance Max brings product information, online motor cover requests and customer account access into one place."
        />
        <section className="public-section">
          <div className="public-container reading-width">
            <h2>What you can do here</h2>
            <ul className="prose-list">
              <li>
                <Link className="inline-link" to={BUY_INSURANCE_PATH}>
                  Buy motor insurance
                </Link>{' '}
                — check your vehicle, choose cover and review the premium.
              </li>
              <li>
                <Link className="inline-link" to="/insurance">
                  Browse products
                </Link>{' '}
                — see published products and the insurer providing each one.
              </li>
              <li>
                <Link className="inline-link" to="/login">
                  Sign in
                </Link>{' '}
                — follow up on your policies and requests.
              </li>
            </ul>
            <div className="attribution">
              <VehicleDataAttribution />
            </div>
          </div>
        </section>
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
          title="Contact us"
          body="Ask about products, an existing request or your account. For a claim, use the insurer’s contact details on your policy."
        />
        <ContactContent />
      </main>
    </PublicLayout>
  );
}

function ContactContent() {
  const [sent, setSent] = useState(false);
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

  function handleContactSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void form.handleSubmit((values) => {
      if (!supportEmail) return;
      const body = `${values.message}\n\nFrom: ${values.fullName}\nEmail: ${values.email}\nPhone: ${values.phone || 'Not provided'}`;
      window.location.href = `mailto:${supportEmail}?subject=${encodeURIComponent(values.subject)}&body=${encodeURIComponent(body)}`;
      setSent(true);
    })(event);
  }

  return (
    <section className="public-section">
      <div className="public-container contact-grid">
        <div className="md-card contact-details">
          <h2 className="visually-hidden">Contact details</h2>

          <ContactDetail
            icon={Mail}
            title="Email"
            content={
              supportEmail ? (
                <a href={`mailto:${supportEmail}`}>{supportEmail}</a>
              ) : (
                <span>
                  For an existing policy, use the contact details on your policy
                  document. You can also sign in to your customer account for
                  support.
                </span>
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
              title="Working hours"
              content={<span>{workingHours}</span>}
            />
          )}
        </div>

        <form
          className="md-card contact-form"
          aria-label="Contact form"
          onSubmit={handleContactSubmit}
          noValidate
        >
          {!supportEmail ? (
            <div className="contact-account">
              <h2>Need help with an existing policy?</h2>
              <p>
                Your customer account brings your insurance information and
                requests together. Keep your policy or quotation reference
                ready.
              </p>
              <Link className="button" to="/login">
                Sign in to your account{' '}
                <ArrowRight size={17} aria-hidden="true" />
              </Link>
              <Link className="text-link" to="/faq">
                Read common questions
              </Link>
            </div>
          ) : sent ? (
            <div className="form-success" role="status">
              <Check size={24} aria-hidden="true" />
              <h2>Your email draft is ready</h2>
              <p>
                Your email app has been opened. Send the message there to
                contact the team. If no app opened, email the address shown on
                this page.
              </p>
              <button
                className="button"
                type="button"
                onClick={() => setSent(false)}
              >
                Prepare another email
              </button>
            </div>
          ) : (
            <>
              <div className="form-row">
                <PublicField
                  id="fullName"
                  label="Full name"
                  error={form.formState.errors.fullName?.message}
                >
                  <input
                    id="fullName"
                    autoComplete="name"
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
                  label="Phone number (optional)"
                  error={form.formState.errors.phone?.message}
                >
                  <input
                    id="phone"
                    type="tel"
                    autoComplete="tel"
                    placeholder="+255 7XX XXX XXX"
                    {...form.register('phone')}
                  />
                </PublicField>
                <PublicField
                  id="subject"
                  label="Subject"
                  error={form.formState.errors.subject?.message}
                >
                  <input id="subject" {...form.register('subject')} />
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
                  placeholder="How can we help?"
                  {...form.register('message')}
                />
              </PublicField>

              {form.formState.errors.root?.message && (
                <p className="form-error" role="alert">
                  {form.formState.errors.root.message}
                </p>
              )}

              <button className="button" type="submit">
                Open email draft
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

function isBlank(value: string | null | undefined) {
  return !value || !value.trim();
}

function validateTiraMotorPurchaseDetails(
  vehicle: PublicMotorVehicle,
  holder: PublicMotorHolder,
) {
  const missing: string[] = [];
  const requiredVehicleFields: Array<[keyof PublicMotorVehicle, string]> = [
    ['chassis_number', 'chassis number'],
    ['make', 'vehicle make'],
    ['model', 'vehicle model'],
    ['body_type', 'body type'],
    ['color', 'color'],
    ['engine_number', 'engine number'],
    ['engine_capacity', 'engine capacity'],
    ['fuel_used', 'fuel used'],
    ['owner_name', 'owner name'],
  ];

  if (vehicle.motor_type === 1 && isBlank(vehicle.registration_number)) {
    missing.push('vehicle registration number');
  }

  requiredVehicleFields.forEach(([key, label]) => {
    const value = vehicle[key];
    if (typeof value === 'string' && isBlank(value)) missing.push(label);
  });

  if (
    vehicle.chassis_number &&
    !/^[A-Za-z0-9-]{6,100}$/.test(vehicle.chassis_number.trim())
  ) {
    missing.push('valid chassis number');
  }
  if (
    vehicle.engine_number &&
    !/^[A-Za-z0-9-]{3,100}$/.test(vehicle.engine_number.trim())
  ) {
    missing.push('valid engine number');
  }
  if (Number(vehicle.engine_capacity) <= 0)
    missing.push('positive engine capacity');
  if (vehicle.tare_weight <= 0) missing.push('tare weight greater than zero');
  if (vehicle.gross_weight <= 0) missing.push('gross weight greater than zero');
  if (
    vehicle.gross_weight > 0 &&
    vehicle.tare_weight > 0 &&
    vehicle.gross_weight < vehicle.tare_weight
  ) {
    missing.push('gross weight not less than tare weight');
  }

  const requiredHolderFields: Array<[keyof PublicMotorHolder, string]> = [
    ['policy_holder_name', 'policy holder name'],
    ['policy_holder_birth_date', 'date of birth'],
    ['policy_holder_id_number', 'ID number'],
    ['country_code', 'country code'],
    ['region', 'region'],
    ['district', 'district'],
    ['policy_holder_phone_number', 'phone number'],
  ];

  requiredHolderFields.forEach(([key, label]) => {
    const value = holder[key];
    if (typeof value === 'string' && isBlank(value)) missing.push(label);
  });

  if (holder.policy_holder_type === 1 && !holder.gender) {
    missing.push('gender');
  }
  if (!/^[A-Z]{3}$/.test(holder.country_code.trim().toUpperCase())) {
    missing.push('three-letter country code');
  }
  if (!/^\+?[0-9]{9,15}$/.test(holder.policy_holder_phone_number.trim())) {
    missing.push('valid phone number');
  }

  return missing;
}

const PURCHASE_PROGRESS = [
  'Check vehicle',
  'Details & cover',
  'Review premium',
  'Request sent',
] as const;

type IntakeErrors = Partial<Record<keyof MotorIntakeValues, string>>;

function MotorInsurancePurchasePage() {
  usePageMeta(
    'Get Insurance | Insurance Max',
    'Get insurance through a simple public self-service flow.',
  );

  const navigate = useNavigate();
  const optionsQuery = usePublicMotorOptions();
  const [intake, setIntake] = useState<MotorIntakeValues>({
    fullName: '',
    registrationNumber: '',
    phone: '',
  });
  const [intakeErrors, setIntakeErrors] = useState<IntakeErrors>({});
  const [companyId, setCompanyId] = useState('');
  const [productId, setProductId] = useState('');
  const [riskId, setRiskId] = useState('');
  const [vehicle, setVehicle] = useState<PublicMotorVehicle>(
    createDefaultMotorVehicle(),
  );
  const [holder, setHolder] = useState<PublicMotorHolder>(
    createDefaultPolicyHolder(),
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
  const purchasePanel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const target = purchasePanel.current?.querySelector<HTMLElement>(
      error
        ? '[data-purchase-error]'
        : '.motor-result-panel h2, .motor-panel h2',
    );
    if (target && (error || verified || quote || submitted || activeCover)) {
      target.setAttribute('tabindex', '-1');
      target.focus();
    }
  }, [error, verified, quote, submitted, activeCover]);

  const companies = optionsQuery.data?.companies ?? [];
  const selectedCompany =
    companies.find((company) => company.id === companyId) ?? companies[0];
  const selectedProduct =
    selectedCompany?.products.find((product) => product.id === productId) ??
    selectedCompany?.products[0];
  const selectedRisk =
    selectedProduct?.risks.find((risk) => risk.id === riskId) ??
    selectedProduct?.risks[0];

  useEffect(() => {
    window.sessionStorage.removeItem('insurance-max.buy-cover-intake');
  }, []);

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
      const fieldErrors: IntakeErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof MotorIntakeValues;
        fieldErrors[key] ??= issue.message;
      }
      setIntakeErrors(fieldErrors);
      setError(parsed.error.issues[0]?.message ?? 'Check the vehicle details.');
      return;
    }
    setIntakeErrors({});

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

    const missingDetails = validateTiraMotorPurchaseDetails(vehicle, holder);
    if (missingDetails.length) {
      setError(
        `Complete the required TIRA details: ${missingDetails
          .slice(0, 6)
          .join(', ')}${missingDetails.length > 6 ? '...' : ''}.`,
      );
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

  function updateIntake(key: keyof MotorIntakeValues, value: string) {
    setIntake((current) => ({ ...current, [key]: value }));
    setIntakeErrors((current) => ({ ...current, [key]: undefined }));
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

  const currentStep = submitted ? 3 : quote ? 2 : verified ? 1 : 0;

  return (
    <PublicLayout>
      <main>
        <PageIntro
          title="Buy motor insurance"
          body="Have your vehicle registration card and ID ready. Premiums are shown in TZS."
        />
        <section className="public-section">
          <div
            ref={purchasePanel}
            className="public-container motor-purchase-layout"
            aria-busy={busy !== null}
          >
            <ol className="motor-progress" aria-label="Purchase progress">
              {PURCHASE_PROGRESS.map((label, index) => (
                <li
                  key={label}
                  className={
                    index < currentStep
                      ? 'is-complete'
                      : index === currentStep
                        ? 'is-current'
                        : ''
                  }
                  aria-current={index === currentStep ? 'step' : undefined}
                >
                  <strong>
                    {index < currentStep ? (
                      <Check size={16} aria-label="Completed" />
                    ) : (
                      index + 1
                    )}
                  </strong>
                  <span>{label}</span>
                </li>
              ))}
            </ol>
            <p className="motor-progress-mobile" aria-hidden="true">
              Step {currentStep + 1} of {PURCHASE_PROGRESS.length}:{' '}
              <strong>{PURCHASE_PROGRESS[currentStep]}</strong>
            </p>
            <p className="purchase-note">
              Payment and cover issuance are confirmed separately by your
              insurer.
            </p>
            {optionsQuery.isError && (
              <div className="motor-alert motor-alert-error" role="alert">
                We could not load available insurers.{' '}
                <button
                  className="text-link"
                  type="button"
                  onClick={() => void optionsQuery.refetch()}
                >
                  Try again
                </button>{' '}
                or <Link to="/contact">contact support</Link>.
              </div>
            )}
            {!optionsQuery.isLoading &&
              !optionsQuery.isError &&
              companies.length === 0 && (
                <div className="motor-alert" role="status">
                  Motor quotations are currently unavailable.{' '}
                  <Link to="/contact">Contact the team for help.</Link>
                </div>
              )}

            {error && (
              <div
                data-purchase-error
                className="motor-alert motor-alert-error"
                role="alert"
              >
                {error}
              </div>
            )}

            {submitted ? (
              <div className="motor-result-panel">
                <Check size={28} aria-hidden="true" />
                <h2>Insurance request submitted</h2>
                <p>
                  Your reference:{' '}
                  <strong>
                    {String(
                      submitted.quotation_no ??
                        submitted.quotation_id ??
                        'Submitted',
                    )}
                  </strong>
                </p>
                <p>
                  Keep this reference. Your insurer will confirm payment
                  instructions and issue your cover. This request confirmation
                  is not proof of insurance.
                </p>
                <div className="motor-actions">
                  <button
                    className="button"
                    type="button"
                    onClick={() => navigate('/')}
                  >
                    Back to home
                  </button>
                  <Link className="text-link" to="/contact">
                    Get help with your request
                  </Link>
                </div>
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
                    label="Start date"
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
                    label="End date"
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
                    className="button"
                    type="button"
                    onClick={() => {
                      setActiveCover(null);
                      setVerified(false);
                    }}
                  >
                    Check another vehicle
                  </button>
                  <button
                    className="button button-outline"
                    type="button"
                    onClick={() => navigate('/')}
                  >
                    Back to home
                  </button>
                </div>
              </div>
            ) : (
              <>
                {!verified ? (
                  <form
                    className="motor-panel"
                    onSubmit={verifyVehicle}
                    noValidate
                  >
                    <SectionHeader
                      title="Check your vehicle"
                      body="We look up the registration and any active insurance before you continue."
                    />
                    <div className="form-row">
                      <PublicField
                        id="publicMotorFullName"
                        label="Full name"
                        error={intakeErrors.fullName}
                      >
                        <input
                          id="publicMotorFullName"
                          autoComplete="name"
                          value={intake.fullName}
                          onChange={(event) =>
                            updateIntake('fullName', event.target.value)
                          }
                        />
                      </PublicField>
                      <PublicField
                        id="publicMotorRegistration"
                        label="Vehicle registration number"
                        error={intakeErrors.registrationNumber}
                      >
                        <input
                          id="publicMotorRegistration"
                          placeholder="e.g. T123ABC"
                          autoCapitalize="characters"
                          autoComplete="off"
                          value={intake.registrationNumber}
                          onChange={(event) =>
                            updateIntake(
                              'registrationNumber',
                              event.target.value,
                            )
                          }
                        />
                      </PublicField>
                    </div>
                    <div className="form-row">
                      <PublicField
                        id="publicMotorPhone"
                        label="Phone number"
                        error={intakeErrors.phone}
                      >
                        <input
                          id="publicMotorPhone"
                          type="tel"
                          placeholder="+255 7XX XXX XXX"
                          autoComplete="tel"
                          inputMode="tel"
                          value={intake.phone}
                          onChange={(event) =>
                            updateIntake('phone', event.target.value)
                          }
                        />
                      </PublicField>
                    </div>
                    <button
                      className="button"
                      type="submit"
                      disabled={
                        busy === 'verify' ||
                        optionsQuery.isLoading ||
                        !selectedCompany
                      }
                    >
                      {busy === 'verify'
                        ? 'Checking…'
                        : optionsQuery.isLoading
                          ? 'Loading insurers…'
                          : 'Check vehicle'}
                    </button>
                  </form>
                ) : quote ? null : (
                  <form
                    className="motor-panel"
                    onSubmit={calculateQuote}
                    noValidate
                  >
                    <SectionHeader title="Confirm details and choose cover" />

                    <div className="form-row">
                      <PublicField
                        id="publicMotorCompany"
                        label="Insurance company"
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
                        label="Vehicle value (TZS)"
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

                    <fieldset className="motor-fieldset">
                      <legend>Motor details</legend>
                      <div className="motor-subgrid">
                        <MotorInput
                          label="Chassis number"
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
                          label="Model number"
                          value={vehicle.model_number ?? ''}
                          onChange={(value) =>
                            updateVehicle('model_number', value)
                          }
                        />
                        <MotorInput
                          label="Body type"
                          value={vehicle.body_type}
                          onChange={(value) =>
                            updateVehicle('body_type', value)
                          }
                        />
                        <MotorInput
                          label="Color"
                          value={vehicle.color}
                          onChange={(value) => updateVehicle('color', value)}
                        />
                        <MotorInput
                          label="Engine number"
                          value={vehicle.engine_number}
                          onChange={(value) =>
                            updateVehicle('engine_number', value)
                          }
                        />
                        <MotorInput
                          label="Engine capacity"
                          inputMode="numeric"
                          value={vehicle.engine_capacity}
                          onChange={(value) =>
                            updateVehicle('engine_capacity', value)
                          }
                        />
                        <MotorInput
                          label="Fuel used"
                          value={vehicle.fuel_used}
                          onChange={(value) =>
                            updateVehicle('fuel_used', value)
                          }
                        />
                        <MotorNumberInput
                          label="Number of axles"
                          value={vehicle.number_of_axles}
                          onChange={(value) =>
                            updateVehicle('number_of_axles', value)
                          }
                        />
                        <MotorNumberInput
                          label="Axle distance"
                          value={vehicle.axle_distance}
                          onChange={(value) =>
                            updateVehicle('axle_distance', value)
                          }
                        />
                        <MotorNumberInput
                          label="Seats"
                          value={vehicle.sitting_capacity}
                          onChange={(value) =>
                            updateVehicle('sitting_capacity', value)
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
                          label="Tare weight"
                          value={vehicle.tare_weight}
                          onChange={(value) =>
                            updateVehicle('tare_weight', value)
                          }
                        />
                        <MotorNumberInput
                          label="Gross weight"
                          value={vehicle.gross_weight}
                          onChange={(value) =>
                            updateVehicle('gross_weight', value)
                          }
                        />
                        <MotorNumberInput
                          label="Motor usage"
                          value={vehicle.motor_usage}
                          onChange={(value) =>
                            updateVehicle('motor_usage', value)
                          }
                        />
                      </div>
                    </fieldset>

                    <fieldset className="motor-fieldset">
                      <legend>Owner details</legend>
                      <div className="motor-subgrid">
                        <MotorInput
                          label="Owner name"
                          value={vehicle.owner_name}
                          onChange={(value) =>
                            updateVehicle('owner_name', value)
                          }
                        />
                        <MotorNumberInput
                          label="Owner category"
                          value={vehicle.owner_category}
                          onChange={(value) =>
                            updateVehicle('owner_category', value)
                          }
                        />
                        <MotorInput
                          label="Owner address"
                          value={vehicle.owner_address}
                          onChange={(value) =>
                            updateVehicle('owner_address', value)
                          }
                        />
                      </div>
                    </fieldset>

                    <fieldset className="motor-fieldset">
                      <legend>Policy holder details</legend>
                      <div className="motor-subgrid">
                        <MotorInput
                          label="Policy holder name"
                          value={holder.policy_holder_name}
                          onChange={(value) =>
                            updateHolder('policy_holder_name', value)
                          }
                        />
                        <MotorNumberInput
                          label="Policy holder type"
                          value={holder.policy_holder_type}
                          onChange={(value) =>
                            updateHolder('policy_holder_type', value)
                          }
                        />
                        <MotorInput
                          label="Date of birth"
                          type="date"
                          value={holder.policy_holder_birth_date}
                          onChange={(value) =>
                            updateHolder('policy_holder_birth_date', value)
                          }
                        />
                        <MotorNumberInput
                          label="ID type"
                          value={holder.policy_holder_id_type}
                          onChange={(value) =>
                            updateHolder('policy_holder_id_type', value)
                          }
                        />
                        <MotorInput
                          label="ID number"
                          value={holder.policy_holder_id_number}
                          onChange={(value) =>
                            updateHolder('policy_holder_id_number', value)
                          }
                        />
                        <label htmlFor="motor-policy-holder-gender">
                          <span>Gender</span>
                          <select
                            id="motor-policy-holder-gender"
                            value={holder.gender ?? ''}
                            onChange={(event) =>
                              updateHolder(
                                'gender',
                                (event.target.value || null) as
                                  | 'M'
                                  | 'F'
                                  | null,
                              )
                            }
                          >
                            <option value="">Select gender</option>
                            <option value="M">Male</option>
                            <option value="F">Female</option>
                          </select>
                        </label>
                        <MotorInput
                          label="Country code"
                          value={holder.country_code}
                          onChange={(value) =>
                            updateHolder('country_code', value.toUpperCase())
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
                        <MotorInput
                          label="Phone number"
                          inputMode="tel"
                          value={holder.policy_holder_phone_number}
                          onChange={(value) =>
                            updateHolder('policy_holder_phone_number', value)
                          }
                        />
                        <MotorInput
                          label="Postal address"
                          value={holder.postal_address ?? ''}
                          onChange={(value) =>
                            updateHolder('postal_address', value)
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
                          label="Fax"
                          inputMode="tel"
                          value={holder.policy_holder_fax ?? ''}
                          onChange={(value) =>
                            updateHolder('policy_holder_fax', value)
                          }
                        />
                      </div>
                    </fieldset>

                    <button
                      className="button"
                      type="submit"
                      disabled={busy === 'quote'}
                    >
                      {busy === 'quote' ? 'Calculating…' : 'Calculate quote'}
                    </button>
                  </form>
                )}

                {quote && (
                  <div className="motor-panel">
                    <button
                      className="text-link"
                      type="button"
                      onClick={() => {
                        setQuote(null);
                        setConfirmed(false);
                      }}
                      disabled={busy !== null}
                    >
                      Edit details and cover
                    </button>
                    <SectionHeader
                      title="Review your quotation"
                      body="Submitting a request does not confirm payment or activate cover."
                    />
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
                        label="Cover period"
                        value={`${quote.cover_period.start_date} to ${quote.cover_period.end_date}`}
                      />
                      <SummaryItem
                        label="Quotation reference"
                        value={quote.premium.pricing_quote_id}
                      />
                      <SummaryItem
                        label="Basic premium"
                        value={money(quote.premium.basic_premium)}
                      />
                      <SummaryItem
                        label="Discounts"
                        value={money(quote.premium.discount_amount)}
                      />
                      <SummaryItem
                        label="Levies and charges"
                        value={money(quote.premium.charges_amount)}
                      />
                      <SummaryItem
                        label="VAT"
                        value={money(quote.premium.vat_amount)}
                      />
                    </div>
                    <div className="premium-total">
                      <span>Total payable</span>
                      <strong>
                        {money(quote.premium.total_amount_payable)}
                      </strong>
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
                      {busy === 'submit'
                        ? 'Submitting…'
                        : 'Submit insurance request'}
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
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
}) {
  const id = useId();

  return (
    <label htmlFor={id}>
      <span>{label}</span>
      <input
        id={id}
        type={type}
        inputMode={inputMode}
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
  const id = useId();
  const codedField =
    label === 'Motor usage'
      ? 'motor_usage'
      : label === 'Owner category' || label === 'Policy holder type'
        ? 'owner_category'
        : null;
  const options =
    label === 'ID type'
      ? CUSTOMER_ID_TYPE_OPTIONS.map((option) => ({
          value: String(option.value),
          label: option.label,
        }))
      : motorFields.find((field) => field.fleetKey === codedField)?.options;
  if (options) {
    return (
      <label htmlFor={id}>
        <span>{label}</span>
        <select
          id={id}
          value={String(value)}
          onChange={(event) => onChange(Number(event.target.value))}
        >
          {!options.some((option) => option.value === String(value)) && (
            <option value={String(value)}>Code {value}</option>
          )}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    );
  }
  return (
    <MotorInput
      label={label}
      value={String(value)}
      inputMode="decimal"
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
    <div className="public-field">
      <label htmlFor={id}>{label}</label>
      {isValidElement<React.HTMLAttributes<HTMLElement>>(children)
        ? cloneElement(children, {
            'aria-invalid': Boolean(error),
            'aria-describedby': error ? `${id}-error` : undefined,
          })
        : children}
      {error && (
        <span id={`${id}-error`} className="form-error">
          {error}
        </span>
      )}
    </div>
  );
}

function BuyCoverPage() {
  return <MotorInsurancePurchasePage />;
}

function InsurancePage() {
  usePageMeta(
    'Insurance Products | Insurance Max',
    'Explore insurance categories available through Insurance Max.',
  );

  const catalogue = useDisplayedCatalogue();
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(() =>
    new URLSearchParams(window.location.search).get('category'),
  );
  const activeCategory =
    catalogue.categories.find((category) => category.id === activeCategoryId) ??
    catalogue.categories[0];

  return (
    <PublicLayout>
      <main>
        <PageIntro
          title="Insurance products"
          body="Products currently published by insurers on Insurance Max. Motor insurance can be bought online."
        />
        <section className="public-section">
          <div className="public-container">
            {catalogue.categories.length ? (
              <>
                <div
                  className="catalogue-tabs"
                  role="group"
                  aria-label="Insurance categories"
                >
                  {catalogue.categories.map((category) => {
                    const Icon = category.icon;
                    const active = category.id === activeCategory?.id;

                    return (
                      <button
                        aria-controls={`catalogue-panel-${category.id}`}
                        aria-pressed={active}
                        className={active ? 'is-active' : ''}
                        id={`catalogue-tab-${category.id}`}
                        key={`${category.business_line}-${category.name}`}
                        onClick={() => setActiveCategoryId(category.id)}
                        type="button"
                      >
                        <Icon size={18} aria-hidden="true" />
                        {category.name}
                        <small>({category.products.length})</small>
                      </button>
                    );
                  })}
                </div>

                {activeCategory && (
                  <section
                    aria-labelledby={`catalogue-heading-${activeCategory.id}`}
                    className="catalogue-panel"
                    id={`catalogue-panel-${activeCategory.id}`}
                  >
                    <div className="catalogue-panel-header">
                      <h2 id={`catalogue-heading-${activeCategory.id}`}>
                        {activeCategory.name}
                      </h2>
                      <span>
                        {activeCategory.products.length}{' '}
                        {activeCategory.products.length === 1
                          ? 'product'
                          : 'products'}
                      </span>
                    </div>

                    <div className="product-grid">
                      {activeCategory.products.map((product) => {
                        const motor = isMotorCatalogueCategory(product);
                        return (
                          <article
                            className="md-card product-card"
                            key={product.id}
                          >
                            <h3>{product.name}</h3>
                            <span className="product-meta">
                              Insurer: {product.company.name}
                            </span>
                            {product.description && (
                              <p>{product.description}</p>
                            )}
                            <Link
                              className={
                                motor ? 'button button-small' : 'text-link'
                              }
                              to={motor ? BUY_INSURANCE_PATH : '/contact'}
                            >
                              {motor ? 'Buy insurance' : 'Enquire about cover'}
                            </Link>
                          </article>
                        );
                      })}
                    </div>
                  </section>
                )}
                <p className="catalogue-note">
                  Ask the insurer about benefits, limits and exclusions before
                  choosing cover. Need help?{' '}
                  <Link className="inline-link" to="/contact">
                    Contact us
                  </Link>
                  .
                </p>
              </>
            ) : (
              <EmptyCatalogueState
                isLoading={catalogue.isLoading}
                isError={catalogue.isError}
                onRetry={() => void catalogue.refetch()}
              />
            )}
          </div>
        </section>
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
  ClaimsPage,
  FaqPage,
};

function FaqPage() {
  usePageMeta(
    'Frequently asked questions | Insurance Max',
    'Help with motor quotes, active cover checks and insurance requests.',
  );
  return (
    <PublicLayout>
      <main>
        <PageIntro title="Help & FAQs" />
        <section className="public-section">
          <div className="public-container reading-width">
            <Questions all />
            <p className="catalogue-note">
              Need help with a particular policy? Keep your reference ready and
              use the contact details on your policy document, or contact us.
            </p>
            <div className="page-actions">
              <Link className="button" to="/contact">
                Contact us
              </Link>
            </div>
          </div>
        </section>
      </main>
    </PublicLayout>
  );
}

function ClaimsPage() {
  usePageMeta(
    'Claims & support | Insurance Max',
    'Find your next step for claims, policy questions and customer account support.',
  );
  return (
    <PublicLayout>
      <main>
        <PageIntro
          title="Make a claim"
          body="Claims are handled by your insurer. Contact them using the claims details on your policy and they will explain the documents and next steps."
        />
        <section className="public-section">
          <div className="public-container two-column">
            <div>
              <h2>Before you contact your insurer</h2>
              <ol className="prose-list">
                <li>Have your policy or cover note number ready.</li>
                <li>
                  Note when and where the incident happened. Keep photos,
                  receipts and other supporting documents.
                </li>
                <li>
                  Notify your insurer using the claims contact on your policy
                  and follow their instructions.
                </li>
              </ol>
              <p className="catalogue-note">
                Your policy terms explain what is covered, reporting
                requirements and any excess.
              </p>
            </div>
            <div className="md-card side-card">
              <h2>Have an account?</h2>
              <p>
                Sign in to see your policy information and available claims
                services.
              </p>
              <div className="page-actions">
                <Link className="button" to="/login">
                  Sign in
                </Link>
                <Link className="text-link" to="/contact">
                  Contact us
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
    </PublicLayout>
  );
}
