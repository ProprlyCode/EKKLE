import { supabase } from '@/lib/supabase';
import type { Json } from '@/lib/database.types';
import type { Cta } from './sequences';

/**
 * Situations (0048–0049): Ekklē's flow templates for everyday situations,
 * a ministry's copies of them, and the situations a member can share.
 */

export type Audience = 'personal' | 'public';

export interface TemplateScreen {
  headline: string;
  body: string;
}

export interface FlowTemplate {
  id: string;
  situation: string;
  slug: string;
  title: string;
  when_to_use: string;
  audience: Audience;
  screens: TemplateScreen[];
  connect: { headline: string; body: string; ctas: Cta[] };
  status: 'draft' | 'published';
  sort_order: number;
  /** For a ministry: its newest copy of this template, if any. */
  copy_id?: string | null;
}

export interface TemplateDraft {
  id: string | null;
  situation: string;
  slug: string;
  title: string;
  when_to_use: string;
  audience: Audience;
  screens: TemplateScreen[];
  connect: { headline: string; body: string; ctas: Cta[] };
}

export interface Situation {
  slug: string;
  name: string;
  title: string;
}

export interface FlowOutcome {
  id: string;
  title: string;
  situation: string | null;
  opened: number;
  finished: number;
  wrote: number;
}

/** The Ekklē team: every template, drafts included. */
export async function platformFlowTemplates(): Promise<FlowTemplate[]> {
  const { data, error } = await supabase.rpc('platform_flow_templates');
  if (error) throw error;
  return (data as unknown as FlowTemplate[]) ?? [];
}

export async function saveFlowTemplate(d: TemplateDraft, status: 'draft' | 'published'): Promise<string> {
  const { data, error } = await supabase.rpc('save_flow_template', {
    p_id: d.id,
    p_situation: d.situation,
    p_slug: d.slug,
    p_title: d.title,
    p_when_to_use: d.when_to_use,
    p_audience: d.audience,
    p_screens: d.screens as unknown as Json,
    p_connect_headline: d.connect.headline,
    p_connect_body: d.connect.body,
    p_ctas: d.connect.ctas as unknown as Json,
    p_status: status,
  });
  if (error) throw error;
  return data as string;
}

export async function deleteFlowTemplate(id: string): Promise<void> {
  const { error } = await supabase.rpc('delete_flow_template', { p_id: id });
  if (error) throw error;
}

/** Admins and Leaders: Ekklē's published templates, with their copy if any. */
export async function ministryFlowTemplates(): Promise<FlowTemplate[]> {
  const { data, error } = await supabase.rpc('flow_templates_for_ministry');
  if (error) throw error;
  return (data as unknown as FlowTemplate[]) ?? [];
}

/** Copy a template into the ministry's flows (a draft); returns the flow id. */
export async function copyFlowTemplate(templateId: string): Promise<string> {
  const { data, error } = await supabase.rpc('use_flow_template', { p_template: templateId });
  if (error) throw error;
  return data as string;
}

/** Name a flow's situation and offer it to members (a blank name clears it). */
export async function setFlowSituation(
  sequenceId: string,
  situation: string,
  slug: string,
  offered: boolean,
): Promise<void> {
  const { error } = await supabase.rpc('set_flow_situation', {
    p_sequence: sequenceId,
    p_situation: situation,
    p_slug: slug,
    p_offered: offered,
  });
  if (error) throw error;
}

/** A member: the situations their ministry offers. */
export async function mySituations(): Promise<Situation[]> {
  const { data, error } = await supabase.rpc('my_situations');
  if (error) throw error;
  return (data as unknown as Situation[]) ?? [];
}

/** Admins and Leaders: opened / finished / wrote for each flow. */
export async function flowOutcomes(days: number | null): Promise<FlowOutcome[]> {
  const { data, error } = await supabase.rpc('flow_outcomes', { p_days: days });
  if (error) throw error;
  return (data as unknown as FlowOutcome[]) ?? [];
}
