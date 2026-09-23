import { supabase } from '@/lib/supabase';

/** Safeguarding incident reports (leadership). Metadata only — never messages. */

export interface IncidentReport {
  id: string;
  reason: string;
  reporter_type: 'member' | 'recipient';
  created_at: string;
  reviewed: boolean;
  conversation_status: 'active' | 'blocked';
  member_name: string;
  recipient_name: string | null;
}

export async function listReports(): Promise<IncidentReport[]> {
  const { data, error } = await supabase.rpc('list_reports');
  if (error) throw error;
  return (data as unknown as IncidentReport[]) ?? [];
}

export async function openReportsCount(): Promise<number> {
  const { data, error } = await supabase.rpc('open_reports_count');
  if (error) throw error;
  return (data as number) ?? 0;
}

export async function resolveReport(reportId: string): Promise<void> {
  const { error } = await supabase.rpc('resolve_report', { p_report_id: reportId });
  if (error) throw error;
}
