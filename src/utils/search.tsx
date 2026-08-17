import type { ReactNode } from 'react';
import type { Post } from '@/types';

export interface SearchResult {
  post: Post;
  score: number;
  matchedFields: ('title' | 'excerpt' | 'tags')[];
}

function normalize(text: string): string {
  return text.toLowerCase().trim();
}

function calculateScore(post: Post, query: string): { score: number; matchedFields: SearchResult['matchedFields'] } {
  const q = normalize(query);
  const title = normalize(post.title);
  const excerpt = normalize(post.excerpt);
  const tagNames = post.tags.map((t) => normalize(t.name)).join(' ');

  let score = 0;
  const matchedFields: SearchResult['matchedFields'] = [];

  if (title.includes(q)) {
    score += title === q ? 100 : title.startsWith(q) ? 80 : 50;
    matchedFields.push('title');
  }
  if (excerpt.includes(q)) {
    score += 20;
    matchedFields.push('excerpt');
  }
  if (tagNames.includes(q)) {
    score += 30;
    matchedFields.push('tags');
  }

  return { score, matchedFields };
}

export function searchPosts(posts: Post[], query: string): SearchResult[] {
  const q = normalize(query);
  if (!q) return [];

  return posts
    .map((post) => ({ post, ...calculateScore(post, q) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);
}






export function highlightText(text: string, query: string, highlightColor?: string): ReactNode[] {
  const q = normalize(query);
  if (!q) return [text];

  const keywords = q.split(/\s+/).filter(Boolean);
  if (keywords.length === 0) return [text];

  const pattern = new RegExp(`(${keywords.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
  const parts = text.split(pattern);

  return parts.map((part, index) => {
    const isMatch = keywords.some((k) => part.toLowerCase() === k);
    if (isMatch) {
      return (
        <mark
          key={index}
          style={{
            backgroundColor: highlightColor,
            color: 'inherit',
            padding: '0 2px',
            borderRadius: '4px',
            fontWeight: 600,
          }}
        >
          {part}
        </mark>
      );
    }
    return part;
  });
}
