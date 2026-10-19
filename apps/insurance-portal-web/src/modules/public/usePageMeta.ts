import { useEffect } from 'react';

export function usePageMeta(
  title: string,
  description: string,
  noIndex = false,
) {
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

    const robots = document.createElement('meta');
    robots.name = 'robots';
    robots.content = noIndex ? 'noindex, nofollow' : 'index, follow';
    document.head.appendChild(robots);

    const canonical =
      document.querySelector<HTMLLinkElement>('link[rel="canonical"]') ??
      document.createElement('link');
    canonical.setAttribute('rel', 'canonical');
    if (noIndex) {
      canonical.remove();
    } else {
      canonical.setAttribute(
        'href',
        window.location.origin + window.location.pathname,
      );
      document.head.appendChild(canonical);
    }
    return () => {
      robots.remove();
      canonical.remove();
    };
  }, [description, title, noIndex]);
}
