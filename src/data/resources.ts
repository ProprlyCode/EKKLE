import { supabase } from '@/lib/supabase';
import type { ResourceKind, Tables } from '@/lib/database.types';

/**
 * Resources: church-approved reading, video and links.
 * Leaders manage them through the table (policies: leadership of the org).
 * Seekers read only the published ones of their church, via seeker_* RPCs.
 */

export type Resource = Tables<'resources'>;
export interface ResourceWithTopics extends Resource {
  topics: string[];
}

export interface ResourceDraft {
  title: string;
  blurb: string;
  body: string;
  kind: ResourceKind;
  url: string | null;
  topics: string[];
}

/** Leaders: every resource of the org, drafts included, with topics. */
export async function listResources(): Promise<ResourceWithTopics[]> {
  const { data, error } = await supabase
    .from('resources')
    .select('*, resource_tags(tags(name))')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });
  if (error) throw error;
  type Row = Resource & { resource_tags: { tags: { name: string } | null }[] | null };
  return ((data ?? []) as unknown as Row[]).map(({ resource_tags, ...r }) => ({
    ...r,
    topics: (resource_tags ?? [])
      .map((rt) => rt.tags?.name)
      .filter((n): n is string => Boolean(n))
      .sort(),
  }));
}

export async function createResource(orgId: string): Promise<Resource> {
  const { data, error } = await supabase
    .from('resources')
    .insert({ org_id: orgId, title: 'New resource' })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function saveResource(id: string, draft: ResourceDraft): Promise<void> {
  const { error } = await supabase
    .from('resources')
    .update({
      title: draft.title.trim(),
      blurb: draft.blurb.trim(),
      body: draft.body,
      kind: draft.kind,
      url: draft.kind === 'text' ? null : draft.url?.trim() || null,
    })
    .eq('id', id);
  if (error) throw error;
  const { error: tErr } = await supabase.rpc('set_resource_topics', {
    p_resource_id: id,
    p_names: draft.topics,
  });
  if (tErr) throw tErr;
}

export async function setResourcePublished(id: string, published: boolean): Promise<void> {
  const { error } = await supabase
    .from('resources')
    .update({ status: published ? 'approved' : 'draft' })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteResource(id: string): Promise<void> {
  const { error } = await supabase.from('resources').delete().eq('id', id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Seekers (Your space)
// ---------------------------------------------------------------------------

export interface SeekerResourceSummary {
  id: string;
  title: string;
  blurb: string;
  kind: ResourceKind;
  topics: string[];
}
export interface SeekerResource extends SeekerResourceSummary {
  url: string | null;
  body: string;
}

export async function listSeekerResources(): Promise<SeekerResourceSummary[]> {
  const { data, error } = await supabase.rpc('seeker_resources');
  if (error) throw error;
  return (data as unknown as SeekerResourceSummary[]) ?? [];
}

export async function getSeekerResource(id: string): Promise<SeekerResource | null> {
  const { data, error } = await supabase.rpc('seeker_resource', { p_resource_id: id });
  if (error) throw error;
  return (data as unknown as SeekerResource | null) ?? null;
}
