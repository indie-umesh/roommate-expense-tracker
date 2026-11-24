// Validation helpers for genuine contact (Email or Indian Mobile)
// Disallows disposable temp emails, invalid formats, and dummy repeated mobile numbers

const DISPOSABLE_EMAIL_DOMAINS = new Set([
  "10minutemail.com",
  "10minutemail.net",
  "tempmail.com",
  "temp-mail.org",
  "guerrillamail.com",
  "guerrillamail.net",
  "guerrillamail.org",
  "guerrillamailblock.com",
  "mailinator.com",
  "throwawaymail.com",
  "yopmail.com",
  "yopmail.fr",
  "yopmail.net",
  "trashmail.com",
  "trashmail.net",
  "sharklasers.com",
  "dispostable.com",
  "getairmail.com",
  "mytemp.email",
  "fakemailgenerator.com",
  "burnermail.io",
  "mohmal.com",
  "crazymailing.com",
  "dropmail.me",
  "tempail.com",
  "test.com",
  "example.com",
  "fake.com",
  "mailnesia.com",
  "inboxkitten.com",
  "generator.email",
  "zillamail.com"
]);

export interface ContactValidationResult {
  isValid: boolean;
  type: "email" | "phone" | null;
  normalizedValue: string;
  errorMessage?: string;
}

export function validateGenuineContact(input: string): ContactValidationResult {
  const trimmed = input.trim();
  if (!trimmed) {
    return {
      isValid: false,
      type: null,
      normalizedValue: "",
      errorMessage: "Please enter your email or 10-digit mobile number.",
    };
  }

  // 1. Check if it's an email
  if (trimmed.includes("@")) {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(trimmed)) {
      return {
        isValid: false,
        type: "email",
        normalizedValue: trimmed,
        errorMessage: "Please enter a valid email address.",
      };
    }

    const domain = trimmed.split("@")[1]?.toLowerCase();
    if (!domain || DISPOSABLE_EMAIL_DOMAINS.has(domain)) {
      return {
        isValid: false,
        type: "email",
        normalizedValue: trimmed,
        errorMessage: "Temporary/disposable emails are not accepted. Please use a genuine email.",
      };
    }

    return {
      isValid: true,
      type: "email",
      normalizedValue: trimmed.toLowerCase(),
    };
  }

  // 2. Check if it's an Indian mobile number
  const digitsOnly = trimmed.replace(/\D/g, "");
  let cleanNumber = digitsOnly;

  // Handle +91 or 91 prefix
  if (cleanNumber.length === 12 && cleanNumber.startsWith("91")) {
    cleanNumber = cleanNumber.slice(2);
  } else if (cleanNumber.length === 11 && cleanNumber.startsWith("0")) {
    cleanNumber = cleanNumber.slice(1);
  }

  // Must be exactly 10 digits
  if (cleanNumber.length !== 10) {
    return {
      isValid: false,
      type: "phone",
      normalizedValue: cleanNumber,
      errorMessage: "Mobile number must be exactly 10 digits.",
    };
  }

  // Must start with 6, 7, 8, or 9
  if (!/^[6-9]/.test(cleanNumber)) {
    return {
      isValid: false,
      type: "phone",
      normalizedValue: cleanNumber,
      errorMessage: "Valid Indian mobile numbers must start with 6, 7, 8, or 9.",
    };
  }

  // Reject dummy repeated numbers (e.g. 9999999999, 8888888888, 7777777777, 6666666666)
  if (/^(\d)\1{9}$/.test(cleanNumber)) {
    return {
      isValid: false,
      type: "phone",
      normalizedValue: cleanNumber,
      errorMessage: "Dummy number detected. Please enter your genuine mobile number.",
    };
  }

  // Reject obvious sequential/fake test patterns
  const fakePatterns = [
    "1234567890",
    "0123456789",
    "9876543210",
    "9898989898",
    "9090909090",
    "9191919191",
    "8989898989",
    "7878787878"
  ];
  if (fakePatterns.includes(cleanNumber)) {
    return {
      isValid: false,
      type: "phone",
      normalizedValue: cleanNumber,
      errorMessage: "Please enter your genuine mobile number.",
    };
  }

  return {
    isValid: true,
    type: "phone",
    normalizedValue: `+91${cleanNumber}`,
  };
}
