import { useEffect, useState } from 'react';
import { useLocation, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { FullPageLoading } from '@/ui/states';
import FindAccount from './FindAccount';
import { accountUrl, platformUrl, type AccountAddress } from './address';

/** Leave for another address (full page load — sessions belong to an address). */
export function GoTo({ url }: { url: string }) {
  useEffect(() => {
    window.location.replace(url);
  }, [url]);
  return <FullPageLoading />;
}

/** An Ekklē page (homepage, For ministries) opened on an account's address. */
export function ToPlatform() {
  const { pathname, search } = useLocation();
  return <GoTo url={platformUrl(`${pathname}${search}`)} />;
}

/**
 * Old ekkle.org links that name a member — /r/:slug, /offer?ref=… — go on to
 * that member's account, so printed QR codes keep working. Anything else
 * (or an unknown member) → Find your church.
 */
export function LegacyMemberLink() {
  const { slug } = useParams();
  const [params] = useSearchParams();
  const { pathname, search } = useLocation();
  const who = slug ?? params.get('ref') ?? '';
  const [target, setTarget] = useState<AccountAddress | null | undefined>(who ? undefined : null);

  useEffect(() => {
    if (!who) return;
    let active = true;
    supabase.rpc('member_account', { p_slug: who }).then(({ data }) => {
      if (active) setTarget((data as unknown as AccountAddress) ?? null);
    });
    return () => {
      active = false;
    };
  }, [who]);

  if (target === undefined) return <FullPageLoading />;
  if (target === null) return <FindAccount />;
  return <GoTo url={accountUrl(target, `${pathname}${search}`)} />;
}
