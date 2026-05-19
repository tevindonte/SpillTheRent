import { absoluteUrl, DEFAULT_DESCRIPTION, SITE_NAME } from "@/lib/seo";

export function HomeJsonLd() {
  const origin = absoluteUrl("/");

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${origin}#website`,
        name: SITE_NAME,
        url: origin,
        description: DEFAULT_DESCRIPTION,
        inLanguage: "en-US",
        publisher: { "@id": `${origin}#organization` },
      },
      {
        "@type": "Organization",
        "@id": `${origin}#organization`,
        name: SITE_NAME,
        url: origin,
        description: DEFAULT_DESCRIPTION,
      },
      {
        "@type": "WebApplication",
        "@id": `${origin}#app`,
        name: SITE_NAME,
        url: origin,
        applicationCategory: "RealEstateApplication",
        operatingSystem: "Web",
        description: DEFAULT_DESCRIPTION,
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
        },
        areaServed: {
          "@type": "City",
          name: "New York City",
          containedInPlace: { "@type": "State", name: "New York" },
        },
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  );
}
