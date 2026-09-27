/**
 * Addresses (docs/tenancy.md). ekkle.org is Ekklē itself; every account lives
 * at <subdomain>.ekkle.org or its own connected domain. The same rules map to
 * staging (<sub>.staging.ekkle.org) and local dev (<sub>.localhost).
 */

export interface AccountAddress {
  subdomain: string;
  custom_domain?: string | null;
}

const PLATFORM_HOSTS = new Set([
  'ekkle.org',
  'www.ekkle.org',
  'staging.ekkle.org',
  'localhost',
  '127.0.0.1',
]);

/** Is this address Ekklē itself (not an account)? Vercel previews count too. */
export function isPlatformHost(hostname = window.location.hostname): boolean {
  return PLATFORM_HOSTS.has(hostname) || hostname.endsWith('.vercel.app');
}

type Env = 'local' | 'staging' | 'production';
function currentEnv(hostname = window.location.hostname): Env {
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.localhost')) {
    return 'local';
  }
  if (
    hostname === 'staging.ekkle.org' ||
    hostname.endsWith('.staging.ekkle.org') ||
    hostname.endsWith('.vercel.app')
  ) {
    return 'staging';
  }
  return 'production';
}

function withPort(host: string) {
  const { port } = window.location;
  return port ? `${host}:${port}` : host;
}

/** Full URL of a page on an account's address, in this environment. */
export function accountUrl(account: AccountAddress, path = '/'): string {
  const { protocol } = window.location;
  switch (currentEnv()) {
    case 'local':
      return `${protocol}//${withPort(`${account.subdomain}.localhost`)}${path}`;
    case 'staging':
      return `https://${account.subdomain}.staging.ekkle.org${path}`;
    default:
      return `https://${account.custom_domain || `${account.subdomain}.ekkle.org`}${path}`;
  }
}

/** Full URL of a page on Ekklē itself (ekkle.org), in this environment. */
export function platformUrl(path = '/'): string {
  const { protocol } = window.location;
  switch (currentEnv()) {
    case 'local':
      return `${protocol}//${withPort('localhost')}${path}`;
    case 'staging':
      return `https://staging.ekkle.org${path}`;
    default:
      return `https://ekkle.org${path}`;
  }
}
