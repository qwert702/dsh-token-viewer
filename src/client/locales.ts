/** `tokenViewer` namespace dictionaries. */

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'input': '输入',
  'output': '输出',
  'cacheHit': '缓存命中',
  'context': '上下文',
  'cacheRead': '缓存读',
  'cacheWrite': '缓存写',
  'uncached': '未缓存',
  'tokens': 'tokens',
  'title': 'Token 消耗',
  'sessions': '会话',
  'balance': '余额',
  'refresh': '刷新余额',
  'balanceUnavailable': '余额不可用',
  'perSession': '按会话查看',
  'expand': '展开',
  'collapse': '收起',
} satisfies Record<string, string>

/** The tokenViewer namespace key union. */
export type TokenKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'input': 'Input',
  'output': 'Output',
  'cacheHit': 'Cache hit',
  'context': 'Context',
  'cacheRead': 'cache read',
  'cacheWrite': 'cache write',
  'uncached': 'uncached',
  'tokens': 'tokens',
  'title': 'Token Usage',
  'sessions': 'sessions',
  'balance': 'Balance',
  'refresh': 'Refresh balance',
  'balanceUnavailable': 'Balance unavailable',
  'perSession': 'per-conversation',
  'expand': 'Expand',
  'collapse': 'Collapse',
} satisfies Record<TokenKey, string>
