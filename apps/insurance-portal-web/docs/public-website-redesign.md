# Insurance Max public website redesign

Implemented 19 October 2026. Scope: the existing React/Vite public frontend. No backend, database, pricing, regulatory validation, payment processing or internal dashboard changes.

## 1. Existing system audit and page-by-page plan

The application uses React 19, React Router, TanStack Query, React Hook Form, Zod, Tailwind and local CSS. The public site was concentrated in `src/modules/public/PublicWebsite.tsx`. Authentication used a separate split layout; document and signature links used standalone cards. The existing public identity is an IM mark, Insurance Max wordmark, indigo `#405189` and teal `#0ab39c`. No company logo image was configured for the public masthead. Configured support details come from `VITE_SUPPORT_EMAIL`, `VITE_SUPPORT_PHONE`, `VITE_SUPPORT_ADDRESS` and `VITE_SUPPORT_HOURS`.

| Route / page | Existing behavior and issues | Implemented design and behavior |
| --- | --- | --- |
| `/` | Autoplay carousel, three remote stock images, sample product copy, only three categories and a CTA | Static split hero with Tanzanian road photography, Get a quote and Buy insurance actions, service strip, six live catalogue categories, purchase explanation, account/support links and FAQ |
| `/insurance` | Limited to four categories and three products per category; sample descriptions; all purchase links entered motor flow | Full published catalogue, category navigation, actual descriptions/provider names, motor quote links and non-motor enquiry links; category links from home retain selection |
| `/about` | Preview-oriented service explanation | Plain description of platform capabilities and three information-led service columns; no invented company history, numbers or licences |
| `/contact` | Configurable contact details; validated form simulated success after a timer without delivering anything | Published contact details only; validated email draft handoff when an email is available; explicit instructions to send in the email app; account/FAQ options otherwise |
| `/buy-cover` | Three decorative progress labels; vehicle verification, active-cover blocking, regulatory details, server quote, submission | Four state-aware progress stages, preparation guidance, unavailable/retry states, clear errors and focus handling, readable coded-field choices, separate premium review with edit action, quote/reference visibility and honest request confirmation |
| `/motor-insurance` | Existing public motor route | Retains the same purchase component and API workflow as `/buy-cover` |
| `/login`, `/register` | Staff-oriented decorative gradient sidebar and separate auth branding | Shared public navigation/footer, customer-facing account introduction, restrained form surface; all existing authentication logic retained |
| `/forgot-password`, `/reset-password` | Existing recovery forms and token behavior | Same shared account design; recovery logic retained |
| `/verify-email`, `/phone-login` | Existing verification and phone login forms | Same shared account design; OTP and verification logic retained |
| `/passwordless`, `/passwordless/complete` | Existing passwordless initiation/completion | Same shared account design; token and redirect behavior retained |
| `/2fa` | Temporary-token verification screen | Same shared account design; access and verification controls retained |
| `/documents/verify/:code` | Standalone card; absence of data incorrectly appeared as not found while loading or on request failure | Shared public layout, explicit loading/error/retry/record states, semantic page heading and noindex metadata |
| `/signatures/respond/:token` | Standalone card; loading and failures looked like missing tokens; no visible mutation feedback | Shared public layout, loading/error/retry states, pending-response protection and success/error feedback; sign/decline API payloads retained; noindex metadata |
| `/claims` | Disabled footer label, no public route | New information page explaining how to prepare and contact the insurer, with existing account access; no invented public claims submission endpoint |
| `/faq` | Disabled footer label, no public route | New practical FAQ using native accessible disclosure controls, covering actual platform behavior |

### Boundaries identified during the audit

- Individual motor is the existing anonymous purchase journey. Fleet and non-motor workbenches and customer/account services exist behind authentication. Public catalogue discovery and enquiry paths expose those choices without creating duplicate purchase wizards or changing access controls.
- Public motor endpoints are `GET /public/motor-purchase/options`, `POST /public/motor-purchase/verify`, `POST /public/motor-purchase/quote` and `POST /public/motor-purchase/submit`. API client authentication-refresh suppression, error-toast suppression, request fields, calculation inputs and idempotency key remain unchanged.
- The public submit service creates and submits a quotation. It does not expose an anonymous payment initiation/status/confirmation endpoint. The interface therefore distinguishes request submission from payment and cover issuance. Existing authenticated payment/mobile-money integrations were not altered or advertised as a new public checkout.
- No independent anonymous cover-note lookup form exists. Existing active-cover verification remains in the motor flow; issued document verification remains at its existing link.
- `/privacy` and `/terms` were disabled labels without pages or approved legal text. They remain unimplemented and are not presented as dead links. Publishing proper legal notices requires company-supplied policy text; no legal policy or regulatory status was invented.
- `/forbidden` is an access-control utility shared with protected areas, and the wildcard uses the existing default landing behavior. These remain unchanged.
- The full-screen connectivity overlay previously obscured even static public information when the backend went offline. Public routes now receive an inline notice; protected routes retain the existing overlay.

## 2. Research and design decisions

Research reviewed official public website content/navigation and publicly indexed imagery. This was a structural benchmark, not a claim of exhaustive interaction or mobile testing of competitor sites.

| Official reference | Observed pattern | Insurance Max application |
| --- | --- | --- |
| [Jubilee Tanzania](https://jubileetanzania.co.tz/) | Customer-need product categories, visible buy/self-service actions and distinct contact options | Products are discoverable by need; quote, account and contact actions are visible in the shared shell |
| [Britam Tanzania](https://tz.britam.com/) | Separate insure/help navigation; named products; claims, FAQs and contact resources; organized footer | Separate product and support paths, useful claims/FAQ content and a compact service footer |
| [NIC Tanzania](https://www.nicinsurance.co.tz/) and [claims](https://nicinsurance.co.tz/claims) | Product-led discovery; claims instructions; customer portal and explicit service contacts | Explain the next step in a claim and direct customers to the actual insurer/account service |
| [SanlamAllianz](https://www.sanlamallianz.com/en) | Corporate typography, grouped expertise and country navigation, clear hierarchy | Restrained section structure, simple typography and business-appropriate spacing. The proposed Tanzania-specific domain could not be fetched; group-site observations are identified separately |
| [Allianz UK](https://www.allianz.co.uk/) | Clear product, policy-management and claims paths; help and login easy to find | Distinct discovery, purchase and existing-customer sections, with a visible account entry |

Competitor testimonials, pricing, regulatory statements, customer counts, awards, content, imagery and branding were not copied. No claim of Insurance Max licensing or regulatory approval is made. Operational trust information describes existing vehicle checks, published insurer names, TZS premiums and actual references.

### Visual direction

- Preserve indigo and teal; combine white, pale warm grey and readable slate text.
- Use the existing Hanken Grotesk font, restrained responsive headings and a 1,200px content container.
- Replace gradients, animated carousel transitions, floating panels and repeated rounded cards with a static photographic hero, thin rules, product rows, numbered steps and open editorial sections.
- Maintain 44px or larger main controls, native selects, 16px input text, visible focus indicators, a skip link, semantic headings and native FAQ disclosures.
- At mobile widths, use a collapsible keyboard-operable menu, stacked hero and support sections, wrapped product navigation and a two-by-two progress indicator. Product and step columns collapse further on narrow screens.
- Use English copy with Tanzanian terms, TZS amounts and +255 examples. A full Kiswahili switch is not added without a translation/content workflow.

## 3. Reusable design system and component architecture

| File | Responsibility |
| --- | --- |
| `src/modules/public/PublicShell.tsx` | `PublicLayout`, `PublicBrand`, shared navigation, footer, mobile menu, skip link, scroll reset and non-blocking connection notice |
| `src/modules/public/public.css` | Scoped public design tokens, typography, layout, component states and mobile/reduced-motion rules; replaces the previous public stylesheet |
| `src/modules/public/usePageMeta.ts` | Title, description, Open Graph text and canonical metadata; token/account pages use noindex and do not publish token URLs as canonical links |
| `src/modules/public/public-routes.ts` | Explicit route classification for public connectivity behavior |
| `src/modules/public/PublicWebsite.tsx` | Information pages and motor flow; reusable `SectionHeader`, `PageIntro`, catalogue states, category display, purchase steps, FAQ, form fields and premium summary |
| `src/modules/shared/auth/components/AuthLayout.tsx` and `auth-public.css` | Customer-facing shell shared by all existing authentication screens; page-specific auth logic retained |
| `src/modules/tenant/engagement/pages/PublicDocumentVerificationPage.tsx` and `PublicSignaturePage.tsx` | Public document services in the shared design, with explicit async states |
| `src/modules/shared/connectivity/components/ConnectionLostOverlay.tsx` | Public routes defer to the inline notice; internal overlay behavior retained |
| `src/App.tsx` | Registers `/claims` and `/faq`; existing routes retained |
| `index.html` | Brand-specific default title and description |
| `public/images/tanzania-road.webp` | Locally served, compressed hero photograph; no new runtime image dependency |

The existing form schemas and `validateTiraMotorPurchaseDetails` are retained. Numeric regulatory choices use existing customer ID and motor-field label definitions rather than making customers interpret raw codes; submitted numeric values are retained. Premium calculations remain server-owned. Editing a quotation returns to the existing details with entered values preserved, and confirmation must be selected again before submission.

### Photography

The hero is a car on a road in Morogoro, Tanzania, photographed by Moses Londo. [Original Unsplash photograph](https://unsplash.com/photos/a-car-parked-on-the-side-of-the-road-HVooHNhW2Cc), used under the [Unsplash licence](https://unsplash.com/license). The application serves a local 1,000 × 1,000 WebP crop (approximately 304 KiB), with explicit dimensions and high fetch priority. It replaces three remote carousel downloads and carousel timers. No competitor asset or AI-generated image is used.

## 4. Verification

- Frontend lint: `npm run lint:web` passed.
- TypeScript and production build: `npm run build:insurance-portal-web` passed.
- Existing frontend suite: `npm run test:web` passed, 55 files / 341 tests.
- Added public integration tests: `npm --prefix apps/insurance-portal-web run test -- src/modules/public/PublicWebsite.test.tsx` passed, 7 tests. Coverage includes all-category discovery, non-motor routing, insurer loading failure/retry, intake validation, original verification payload, active-cover blocking, quotation review/edit/confirmation and submit payload, reference display, offline information access and protected-route classification.
- Chromium browser checks: no horizontal overflow on 14 public routes at 320, 390, 768 and 1,440px (56 route/viewport combinations). Checked home, insurance, about, contact, claims, FAQ, buy-cover, login, registration, forgot-password, phone login, passwordless, document verification and signature request pages with API fixtures.
- Mobile browser workflow: menu open/close and navigation passed; vehicle check, details entry, quote calculation, disabled submission before confirmation, final submission, quotation reference and unchanged idempotency/value payload passed. No JavaScript page errors in the workflow. Desktop home, mobile home/login/details and premium-review screenshots were visually reviewed.
- Browser verification uses intercepted API fixtures. It does not create real quotations, sign real documents or charge customers.

### Verification limits and follow-up

- Real TIRA/TIRAMIS, insurer issuance, authentication delivery, mobile-money payment and production backend end-to-end tests require configured services and authorized test accounts. They were not executed against live insurance/customer data.
- Contact forms prepare an email in the customer’s mail application; delivery requires sending there. No contact submission API exists in the audited public service.
- Real regulatory status, legal notices, corporate history and support contacts must come from the business. Configured contact variables are honored; absent contacts are not fabricated.
- WCAG 2.2 AA is a design target, not a completed conformance certification. Full assistive-technology auditing and production Core Web Vitals measurement remain follow-up work. Existing application-wide bundle splitting and Google Fonts loading remain in place.
- Internal dashboards, authenticated customer portal workbenches, backend files and database migrations were not redesigned or modified.
