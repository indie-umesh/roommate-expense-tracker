/**
 * Name & Text Transliterator & Localizer
 * Converts Latin / English script names & titles to Devanagari (Hindi)
 * when Hindi is selected as the active language.
 */

import type { LanguageCode } from "./i18n";

// Comprehensive Dictionary for instant, accurate matching of common Indian names, words, and places
const HINDI_NAME_DICTIONARY: Record<string, string> = {
  // First Names
  umesh: "उमेश",
  ritesh: "रितेश",
  kumar: "कुमार",
  vikas: "विकास",
  vikash: "विकास",
  aman: "अमन",
  rahul: "राहुल",
  rohit: "रोहित",
  amit: "अमित",
  ankit: "अंकित",
  abhishek: "अभिषेक",
  shivam: "शिवम",
  shubham: "शुभम",
  saurabh: "सौरभ",
  gaurav: "गौरव",
  deepak: "दीपक",
  suresh: "सुरेश",
  ramesh: "रमेश",
  mahesh: "महेश",
  dinesh: "दिनेश",
  mukesh: "मुकेश",
  ganesh: "गणेश",
  rajesh: "राजेश",
  naresh: "नरेश",
  kamlesh: "कमलेश",
  brijesh: "बृजेश",
  sandeep: "संदीप",
  sandip: "संदीप",
  kuldeep: "कुलदीप",
  pradeep: "प्रदीप",
  pardeep: "प्रदीप",
  sanjay: "संजय",
  ajay: "अजय",
  vijay: "विजय",
  vinay: "विनय",
  vivek: "विवेक",
  vikram: "विक्रम",
  vishal: "विशाल",
  varun: "वरुण",
  tarun: "तरुण",
  arun: "अरुण",
  karan: "करण" ,
  manish: "मनीष",
  ashish: "आशीष",
  harish: "हरीश",
  girish: "गिरीश",
  piyush: "पीयूष",
  ayush: "आयुष",
  anurag: "अनुराग",
  mayank: "मयंक",
  mohit: "मोहित",
  pankaj: "पंकज",
  neeraj: "नीरज",
  dheeraj: "धीरज",
  suraj: "सूरज",
  pawan: "पवन",
  naveen: "नवीन",
  praveen: "प्रवीण",
  alok: "आलोक",
  ashok: "अशोक",
  sunil: "सुनील",
  anil: "अनिल",
  kapil: "कपिल",
  nikhil: "निखिल",
  akhil: "अखिल",
  sahil: "साहिल",
  atul: "अतुल",
  kunal: "कुणाल",
  prashant: "प्रशांत",
  siddharth: "सिद्धार्थ",
  aditya: "आदित्य",
  anand: "आनंद",
  arvind: "अरविंद",
  govind: "गोविंद",
  dharmendra: "धर्मेंद्र",
  jitendra: "जितेंद्र",
  narendra: "नरेंद्र",
  devendra: "देवेंद्र",
  surendra: "सुरेंद्र",
  virendra: "वीरेंद्र",
  satendra: "सतेंद्र",
  priya: "प्रिया",
  pooja: "पूजा",
  puja: "पूजा",
  neha: "नेहा",
  anjali: "अंजलि",
  sneha: "स्नेहा",
  divya: "दिव्या",
  kriti: "कृति",
  shreya: "श्रेया",
  riya: "रिया",
  kavita: "कविता",
  sunita: "सुनीता",
  anita: "अनीता",
  swati: "स्वाति",
  tanu: "तनु",
  monika: "मोनिका",
  radha: "राधा",
  nisha: "निशा",

  // Surnames
  sharma: "शर्मा",
  verma: "वर्मा",
  singh: "सिंह",
  gupta: "गुप्ता",
  yadav: "यादव",
  patel: "पटेल",
  jain: "जैन",
  mishra: "मिश्रा",
  tiwari: "तिवारी",
  pandey: "पांडेय",
  dubey: "दुबे",
  shukla: "शुक्ला",
  chaudhary: "चौधरी",
  choudhary: "चौधरी",
  choudhari: "चौधरी",
  meena: "मीना",
  rajput: "राजपूत",
  saini: "सैनी",
  agarwal: "अग्रवाल",
  agrawal: "अग्रवाल",
  kapoor: "कपूर",
  khanna: "खन्ना",
  bhatia: "भाटिया",
  reddy: "रेड्डी",
  nair: "नायर",
  pillai: "पिल्लई",
  menon: "मेनन",
  rao: "राव",
  joshi: "जोशी",
  kulkarni: "कुलकर्णी",
  deshmukh: "देशमुख",
  patil: "पाटिल",
  pawar: "पवार",
  shinde: "शिंदे",
  jadhav: "जाधव",
  more: "मोरे",
  goyal: "गोयल",
  mittal: "मित्तल",
  bansal: "बंसal",
  garg: "गर्ग",
  saxena: "सक्सेना",
  srivastava: "श्रीवास्तव",
  tripathi: "त्रिपाठी",
  jha: "झा",
  das: "दास",
  ghosh: "घोष",
  banerjee: "बनर्जी",
  chatterjee: "चटर्जी",
  mukherjee: "मुखर्जी",
  dutta: "दत्ता",
  sen: "सेन",
  roy: "रॉय",
  bose: "बोस",

  // Flat & Location Words
  flat: "फ्लैट",
  nagar: "नगर",
  room: "कमरा",
  roommate: "रूममेट",
  roommates: "रूममेट्स",
  house: "घर",
  apartment: "अपार्टमेंट",
  apartments: "अपार्टमेंट्स",
  colony: "कॉलोनी",
  society: "सोसायटी",
  heights: "हाइट्स",
  towers: "टावर्स",
  tower: "टावर",
  residency: "रेजीडेंसी",
  enclave: "एन्क्लेव",
  vihar: "विहार",
  park: "पार्क",
  road: "रोड",
  street: "स्ट्रीट",
  block: "ब्लॉक",
  sector: "सेक्टर",
  phase: "फेज",
  indore: "इंदौर",
  bhopal: "भोपाल",
  delhi: "दिल्ली",
  mumbai: "मुंबई",
  pune: "पुणे",
  bangalore: "बैंगलोर",
  bengaluru: "बेंगलुरु",
  hyderabad: "हैदराबाद",
  jaipur: "जयपुर",
  lucknow: "लखनऊ",
  kanpur: "कानपुर",
  noida: "नोएडा",
  gurugram: "गुरुग्राम",
  gurgaon: "गुड़गांव",
  patna: "पटना",
  kolkata: "कोलकाता",
  ahmedabad: "अहमदाबाद",
  surat: "सूरत",
  vadodara: "वडोदरा",
  user: "उपयोगकर्ता",
  admin: "एडमिन",
};

/**
 * Phonetic transliteration from English Latin to Devanagari for unlisted words
 */
function phoneticToDevanagari(word: string): string {
  const w = word.toLowerCase();

  // Multi-character consonant digraphs
  const digraphs: [string, string][] = [
    ["shh", "ष"],
    ["ksh", "क्ष"],
    ["chh", "छ"],
    ["kh", "ख"],
    ["gh", "घ"],
    ["ch", "च"],
    ["jh", "झ"],
    ["th", "थ"],
    ["dh", "ध"],
    ["ph", "फ"],
    ["bh", "भ"],
    ["sh", "श"],
    ["gy", "ज्ञ"],
    ["tr", "त्र"],
    ["ee", "ी"],
    ["oo", "ू"],
    ["aa", "ा"],
    ["ai", "ै"],
    ["au", "ौ"],
  ];

  // Single characters
  const charMap: Record<string, string> = {
    k: "क",
    g: "ग",
    c: "क",
    j: "ज",
    t: "त",
    d: "द",
    n: "न",
    p: "प",
    f: "फ",
    b: "ब",
    m: "म",
    y: "य",
    r: "र",
    l: "ल",
    v: "व",
    w: "व",
    s: "स",
    h: "ह",
    z: "ज़",
    q: "क",
    x: "क्स",
  };

  const initialVowels: Record<string, string> = {
    a: "अ",
    aa: "आ",
    i: "इ",
    ee: "ई",
    u: "उ",
    oo: "ऊ",
    e: "ए",
    ai: "ऐ",
    o: "ओ",
    au: "औ",
  };

  const matras: Record<string, string> = {
    a: "",
    aa: "ा",
    i: "ि",
    ee: "ी",
    u: "ु",
    oo: "ू",
    e: "े",
    ai: "ै",
    o: "ो",
    au: "ौ",
  };

  let out = "";
  let i = 0;

  while (i < w.length) {
    // Check initial vowel
    if (i === 0 && (w[i] === "a" || w[i] === "i" || w[i] === "u" || w[i] === "e" || w[i] === "o")) {
      if (w.startsWith("aa", i)) {
        out += initialVowels.aa;
        i += 2;
        continue;
      }
      if (w.startsWith("ee", i)) {
        out += initialVowels.ee;
        i += 2;
        continue;
      }
      if (w.startsWith("oo", i)) {
        out += initialVowels.oo;
        i += 2;
        continue;
      }
      if (w.startsWith("ai", i)) {
        out += initialVowels.ai;
        i += 2;
        continue;
      }
      if (w.startsWith("au", i)) {
        out += initialVowels.au;
        i += 2;
        continue;
      }
      out += initialVowels[w[i]] || w[i];
      i++;
      continue;
    }

    // Check digraph consonants
    let matchedDigraph = false;
    for (const [dig, dev] of digraphs) {
      if (w.startsWith(dig, i)) {
        out += dev;
        i += dig.length;
        matchedDigraph = true;
        break;
      }
    }
    if (matchedDigraph) continue;

    const ch = w[i];
    if (charMap[ch]) {
      out += charMap[ch];
      i++;
      // Check for attached vowel (matra)
      if (i < w.length) {
        if (w.startsWith("aa", i)) {
          out += matras.aa;
          i += 2;
        } else if (w.startsWith("ee", i)) {
          out += matras.ee;
          i += 2;
        } else if (w.startsWith("oo", i)) {
          out += matras.oo;
          i += 2;
        } else if (w.startsWith("ai", i)) {
          out += matras.ai;
          i += 2;
        } else if (w.startsWith("au", i)) {
          out += matras.au;
          i += 2;
        } else if (matras[w[i]] !== undefined) {
          out += matras[w[i]];
          i++;
        }
      }
    } else if (matras[ch] !== undefined) {
      out += matras[ch];
      i++;
    } else {
      out += ch;
      i++;
    }
  }

  return out || word;
}

/**
 * Translates/transliterates an individual word to Hindi
 */
export function transliterateWordToHindi(word: string): string {
  if (!word) return "";

  // If already contains Devanagari script (U+0900 to U+097F), keep as-is
  if (/[\u0900-\u097F]/.test(word)) {
    return word;
  }

  // Preserve leading/trailing punctuation
  const match = word.match(/^([^a-zA-Z0-9]*)(.*?)([^a-zA-Z0-9]*)$/);
  if (!match) return word;

  const [, prefix, core, suffix] = match;
  if (!core) return word;

  const clean = core.toLowerCase();
  const dictMatch = HINDI_NAME_DICTIONARY[clean];
  if (dictMatch) {
    return prefix + dictMatch + suffix;
  }

  // Fallback to phonetic engine
  const phon = phoneticToDevanagari(core);
  return prefix + phon + suffix;
}

/**
 * Main localizer function:
 * Takes any person name, roommate name, or flat name (e.g. "Vikas Nagar Flat", "Umesh", "Ritesh Kumar")
 * and converts it to the active language script.
 */
export function localizeName(name: string | undefined | null, lang: LanguageCode): string {
  if (!name) return "";

  // If language is Hindi, transliterate all Latin names/words into Devanagari
  if (lang === "hi") {
    // Split on whitespace or hyphens
    return name
      .split(/(\s+|-)/)
      .map((part) => {
        if (/^\s+$/.test(part) || part === "-") return part;
        return transliterateWordToHindi(part);
      })
      .join("");
  }

  // For other languages, return clean name
  return name;
}
