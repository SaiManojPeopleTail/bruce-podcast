export interface Post {
  type: 'image' | 'video' | 'text' | 'mixed';
  media_url: string | null;
  description: string;
  post_url: string | null;
  posted_at: string | null;
}

export interface ScrapeResult {
  platform: string;
  source_url: string;
  posts: Post[];
  notes: string;
}

export type EventType =
  | 'status'
  | 'thought'
  | 'text'
  | 'action'
  | 'post'
  | 'login_required'
  | 'login_detected'
  | 'done'
  | 'error';

export interface AgentEvent {
  type: EventType;
  data: Record<string, unknown>;
}

export interface SessionOptions {
  url: string;
  credentialsId?: string;
  /** Override env: total posts to collect */
  maxPosts?: number;
  parallelThreshold?: number;
  postsPerWorker?: number;
  maxParallelTabs?: number;
}

export interface Session {
  id: string;
  url: string;
  status: 'starting' | 'running' | 'done' | 'error' | 'cancelled';
  createdAt: number;
  lastActiveAt: number;
  abortController: AbortController;
}

export interface Credentials {
  id: string;
  platform: 'instagram' | 'linkedin';
  username: string;
  password: string;
  storageState?: string;
}
