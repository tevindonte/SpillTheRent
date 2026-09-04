export type FaqItem = {
  question: string;
  answer: string;
};

export const FAQ_ITEMS: FaqItem[] = [
  {
    question: "What is spillthe.rent?",
    answer:
      "spillthe.rent is a free rental research tool built entirely for renters. Search any apartment building in Manhattan, Brooklyn, or Long Island City and get the real picture: tenant reviews, government violation records, bedbug history, landlord portfolios, and real rent prices people actually paid. No sugar coating, no landlord spin.",
  },
  {
    question: "Where does the data come from?",
    answer:
      "We pull from multiple sources: NYC HPD violation records, the NYC Bedbug Registry, Department of Buildings permits, housing court tenant actions, OATH short-term rental violations, NYC rent stabilization lists, Google Reviews, and direct submissions from real tenants. Everything is sourced from official government databases or verified tenant reports. Nothing is fabricated or paid for by landlords.",
  },
  {
    question: "Is this free to use?",
    answer:
      "Yes, completely free. You can search any building, read reviews, and see all official data without paying anything or creating an account.",
  },
  {
    question: "Do I need an account to use it?",
    answer:
      "No. You can browse the map and read everything without an account. Creating an account lets you submit reviews, report your rent, track buildings you're watching, and build your rental history profile.",
  },
  {
    question: "Can landlords pay to remove or hide bad reviews?",
    answer:
      "Never. Landlords cannot pay to suppress, edit, or remove any reviews or official data on this platform. Government records are what they are. Community reviews can only be responded to, never deleted by a landlord. This is non-negotiable.",
  },
  {
    question: "How do I know the reviews are real?",
    answer:
      "Community reviews come from verified tenant submissions. Google reviews are pulled directly from Google's API. Official data like HPD violations and bedbug reports come straight from NYC government databases. These are public records that cannot be faked or manipulated.",
  },
  {
    question: "What is an HPD violation?",
    answer:
      "HPD stands for NYC Housing Preservation and Development. When a building has code violations (things like no heat, mold, pest infestations, or structural issues), HPD records them officially. We pull these records and display them per building so you can see a building's full violation history before you sign a lease.",
  },
  {
    question: "What does the HPD violation score mean?",
    answer:
      "We categorize buildings based on their open violation count. Clean means zero open violations. Minor means 1 to 5. Moderate means 6 to 15. Severe means 16 or more open violations. Class C violations are the most serious and indicate conditions that are immediately hazardous.",
  },
  {
    question: "What is a rent stabilized building?",
    answer:
      "Rent stabilized buildings in NYC have legal limits on how much a landlord can raise rent each year. Tenants in stabilized units have stronger legal protections. We flag rent stabilized buildings so you know your rights before you sign.",
  },
  {
    question: "What are HP Actions?",
    answer:
      "HP Actions are lawsuits filed by tenants against their landlord in NYC Housing Court to force repairs or stop harassment. If a building shows multiple HP Actions it means conditions got bad enough that tenants had to take legal action. We surface this data because it's one of the strongest signals of a problematic landlord.",
  },
  {
    question: "What is The Receipt?",
    answer:
      "The Receipt is our rent calculator that shows you what you're actually paying versus what a landlord is advertising. Landlords often advertise a listed rent but offer concessions like one free month. The Receipt does the math and shows you the real average monthly cost over your lease term so you're not caught off guard.",
  },
  {
    question: "Can I report my own rent?",
    answer:
      "Yes. You can submit what you're paying, your bedroom count, and your move-in year anonymously. This data helps other renters benchmark whether a listing is fairly priced for that building and neighborhood.",
  },
  {
    question: "Is my review anonymous?",
    answer:
      "By default yes. You can choose to attach your handle to a review if you want credit but anonymous is the default to protect tenants from landlord retaliation.",
  },
  {
    question: "Can I add a building that isn't on the map?",
    answer:
      "Yes. Use the + button on the map to add a missing building. We'll verify it against Google Places and add it to our database. If Google can't confirm it we'll still add it with a pending verification status.",
  },
  {
    question: "Why is my building showing no data?",
    answer:
      "Some buildings, especially smaller ones, may not have Google Business listings, meaning no Google rating is available. If there are no community reviews yet that's just because no tenants have submitted one yet, so you could be the first. Official data like HPD violations depends on whether any violations have been filed with the city.",
  },
  {
    question: "How often is the data updated?",
    answer:
      "Government data is refreshed monthly. Google ratings are updated periodically. Community reviews appear in real time as tenants submit them.",
  },
  {
    question: "What cities or neighborhoods do you cover?",
    answer:
      "Currently Manhattan, Brooklyn, and Long Island City in Queens. We're expanding to more NYC boroughs and cities based on demand.",
  },
  {
    question: "I'm a landlord. Can I respond to reviews?",
    answer:
      "Not yet but this is coming. We're building a verified landlord program that lets property managers with strong records respond to reviews publicly and list verified vacancies. Reach out to us if you're interested.",
  },
  {
    question: "How do I report a fake or abusive review?",
    answer:
      "Use the flag option on any review to report it. We review flagged content and remove anything that violates our community guidelines.",
  },
  {
    question: "Who built this?",
    answer:
      "spillthe.rent was built by a developer frustrated with the lack of honest information available to renters in NYC. The platform exists entirely on the renter's side.",
  },
];
