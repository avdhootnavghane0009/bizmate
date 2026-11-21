export interface IndustryConfig {
  id: string;
  name: string;
  category: string;
  icon: string;
  tagline: string;
  terminology: {
    customer: string;
    orderOrBooking: string;
    catalogItem: string;
    unit: string;
  };
  sampleVoicePrompt: string;
}

export const SUPPORTED_INDUSTRIES: Record<string, IndustryConfig> = {
  restaurants: {
    id: "restaurants",
    name: "Restaurants & Cafes",
    category: "Food & Beverage",
    icon: "Utensils",
    tagline: "Table reservations, online orders, kitchen tickets & food supplies",
    terminology: { customer: "Diner", orderOrBooking: "Food Order", catalogItem: "Menu Item", unit: "Portion" },
    sampleVoicePrompt: "Kal 20 kg potatoes order karna, paneer ka stock check karna aur Rahul ka payment reminder bhejna."
  },
  travel: {
    id: "travel",
    name: "Travel & Tourism",
    category: "Hospitality",
    icon: "Plane",
    tagline: "Tour packages, itineraries, payment milestones & passport follow-ups",
    terminology: { customer: "Traveller", orderOrBooking: "Tour Booking", catalogItem: "Package", unit: "Seat" },
    sampleVoicePrompt: "Dubai package ka quote send karo Rohan ko with 4-star hotel option."
  },
  salons: {
    id: "salons",
    name: "Spas & Salons",
    category: "Beauty & Wellness",
    icon: "Sparkles",
    tagline: "Service appointments, stylist allocation, booking reminders & memberships",
    terminology: { customer: "Client", orderOrBooking: "Appointment", catalogItem: "Treatment", unit: "Session" },
    sampleVoicePrompt: "Pooja ko kal sham 5 baje ka haircut slot book kardo with Priya."
  },
  retail: {
    id: "retail",
    name: "Retail & Grocery",
    category: "Commerce",
    icon: "Store",
    tagline: "Barcode inventory, WhatsApp orders, low-stock reorders & GST credit invoices",
    terminology: { customer: "Customer", orderOrBooking: "Sale Order", catalogItem: "Stock Item", unit: "Piece/Kg" },
    sampleVoicePrompt: "Atta aur mustard oil ka stock check karo aur low items ki list banao."
  },
  ecommerce: {
    id: "ecommerce",
    name: "E-Commerce & D2C",
    category: "Commerce",
    icon: "ShoppingBag",
    tagline: "Shopify sync, abandoned cart recovery & shipping updates",
    terminology: { customer: "Buyer", orderOrBooking: "Web Order", catalogItem: "SKU", unit: "Unit" },
    sampleVoicePrompt: "Aaj ke abandoned carts check karo aur recovery discount WhatsApp bhejo."
  },
  real_estate: {
    id: "real_estate",
    name: "Real Estate",
    category: "Property",
    icon: "Building2",
    tagline: "Property inquiries, budget qualification, site visit scheduling & broker pipeline",
    terminology: { customer: "Buyer", orderOrBooking: "Site Visit", catalogItem: "Property Unit", unit: "Unit" },
    sampleVoicePrompt: "Sharma ji ka 3 BHK inquiry update karo aur weekend pe site visit schedule karo."
  },
  healthcare: {
    id: "healthcare",
    name: "Healthcare & Clinics",
    category: "Medical",
    icon: "HeartPulse",
    tagline: "Doctor clinic appointments, patient reminders & follow-up care",
    terminology: { customer: "Patient", orderOrBooking: "Consultation", catalogItem: "Treatment", unit: "Visit" },
    sampleVoicePrompt: "Dr. Verma ka 4 baje ka slot confirm kardo and patient ko reminder bhejo."
  },
  education: {
    id: "education",
    name: "Education & Coaching",
    category: "Education",
    icon: "GraduationCap",
    tagline: "Course admissions, demo counseling classes & fee installment reminders",
    terminology: { customer: "Student", orderOrBooking: "Admission", catalogItem: "Course Batch", unit: "Course" },
    sampleVoicePrompt: "Batch 4 ke sabhi students ko fee due date ka WhatsApp reminder dispatch karo."
  },
  services: {
    id: "services",
    name: "Professional Services",
    category: "Corporate",
    icon: "Briefcase",
    tagline: "Client retainers, milestone approvals & automated GST tax invoices",
    terminology: { customer: "Client", orderOrBooking: "Milestone", catalogItem: "Retainer", unit: "Month" },
    sampleVoicePrompt: "Apex Corp ka quarterly audit invoice generate karke review ke liye draft karo."
  },
  general: {
    id: "general",
    name: "Other Businesses",
    category: "General",
    icon: "Layers",
    tagline: "Universal CRM, lead qualification, payments and WhatsApp automations",
    terminology: { customer: "Client", orderOrBooking: "Order", catalogItem: "Item", unit: "Unit" },
    sampleVoicePrompt: "Aaj ke pending payment follow-ups ki list WhatsApp pe send karo."
  }
};
