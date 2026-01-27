
import { NewsItem } from './types';

export const CATEGORIES = [
  'TUTTE',
  'MACHINE LEARNING',
  'ETICA AI',
  'REGOLAMENTAZIONE',
  'HARDWARE'
];

export const MOCK_INITIAL_NEWS: NewsItem[] = [
  {
    id: 'f1',
    title: "OpenAI lancia 'SearchGPT': Sfida diretta a Google nel search",
    summary: 'Un nuovo prototipo di ricerca con intelligenza artificiale progettato per offrire risposte rapide e dirette con fonti citate in modo chiaro.',
    url: 'https://openai.com/blog',
    source: { name: 'TECHCRUNCH', domain: 'techcrunch.com' },
    published_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 mins ago
    fetched_at: new Date().toISOString(),
    tags: ['Nuovi Modelli'],
    thumbnail: '',
    language: 'it',
    score: { freshness: 0.95, relevance: 0.9, popularity: 0.85 }
  },
  {
    id: 'f2',
    title: "Meta rilascia Llama 3.1: Il più grande modello open-source di sempre",
    summary: 'Con 405 miliardi di parametri, Mark Zuckerberg punta a democratizzare l\'accesso ai modelli di frontiera sfidando il dominio dei modelli chiusi.',
    url: 'https://meta.com',
    source: { name: 'THE VERGE', domain: 'theverge.com' },
    published_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
    fetched_at: new Date().toISOString(),
    tags: ['Nuovi Modelli', 'Machine Learning'],
    thumbnail: '',
    language: 'it',
    score: { freshness: 0.88, relevance: 0.95, popularity: 0.92 }
  },
  {
    id: 'f3',
    title: "NVIDIA annuncia l'architettura Blackwell per il calcolo AI",
    summary: 'La nuova GPU promette prestazioni fino a 30 volte superiori per l\'inferenza di modelli linguistici di grandi dimensioni, riducendo drasticamente i consumi.',
    url: 'https://nvidia.com',
    source: { name: 'WIRED', domain: 'wired.com' },
    published_at: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(), // 5 hours ago
    fetched_at: new Date().toISOString(),
    tags: ['Hardware'],
    thumbnail: '',
    language: 'it',
    score: { freshness: 0.85, relevance: 0.9, popularity: 0.98 }
  },
  {
    id: 'f4',
    title: "L'Unione Europea approva formalmente l'AI Act",
    summary: 'La prima legge globale sull\'intelligenza artificiale introduce regole basate sul rischio, vietando alcune pratiche e imponendo obblighi ai modelli più potenti.',
    url: 'https://europa.eu',
    source: { name: 'REUTERS', domain: 'reuters.com' },
    published_at: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(), // 12 hours ago
    fetched_at: new Date().toISOString(),
    tags: ['Regolamentazione', 'Etica AI'],
    thumbnail: '',
    language: 'it',
    score: { freshness: 0.8, relevance: 0.99, popularity: 0.9 }
  },
  {
    id: 'f5',
    title: "Google DeepMind presenta AlphaFold 3",
    summary: 'Il nuovo modello è in grado di prevedere la struttura e le interazioni di tutte le molecole della vita, aprendo nuove frontiere per la biologia e la medicina.',
    url: 'https://deepmind.google',
    source: { name: 'NATURE', domain: 'nature.com' },
    published_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 24 hours ago
    fetched_at: new Date().toISOString(),
    tags: ['Machine Learning'],
    thumbnail: '',
    language: 'it',
    score: { freshness: 0.75, relevance: 0.95, popularity: 0.8 }
  },
  {
    id: 'f6',
    title: "Ricerca sulle allucinazioni: Nuove tecniche di 'Grounding'",
    summary: 'Un nuovo framework accademico propone metodi innovativi per ridurre le allucinazioni nei LLM attraverso il recupero dinamico di fonti verificate.',
    url: 'https://arxiv.org',
    source: { name: 'MIT TECH REVIEW', domain: 'technologyreview.com' },
    published_at: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(), // 2 days ago
    fetched_at: new Date().toISOString(),
    tags: ['Etica AI', 'Machine Learning'],
    thumbnail: '',
    language: 'it',
    score: { freshness: 0.7, relevance: 0.85, popularity: 0.6 }
  }
];
