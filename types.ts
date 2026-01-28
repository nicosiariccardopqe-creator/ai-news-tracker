export interface Source {
  name: string;
  domain: string;
  icon?: string;
}

export interface NewsScore {
  freshness: number;
  relevance: number;
  popularity: number;
}

export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  url: string;
  source: Source;
  published_at: string;
  fetched_at: string;
  tags: string[];
  thumbnail?: string;
  language: string;
  score: NewsScore;
}

export interface ErrorDetail {
  message: string;
  stack?: string;
  payload?: any;
  timestamp: string;
  type: string;
}

export interface NewsResponse {
  generated_at: string;
  source_version: string;
  items: NewsItem[];
  paging: {
    next_cursor: string | null;
    count: number;
  };
}

export enum AppState {
  IDLE = 'IDLE',
  LOADING = 'LOADING',
  SUCCESS = 'SUCCESS',
  EMPTY = 'EMPTY',
  ERROR = 'ERROR'
}

export interface TelemetryEvent {
  event: 'cta_refresh_clicked' | 'news_impression' | 'news_click_out' | 'filter_applied' | 'error_shown';
  timestamp: string;
  data?: any;
}