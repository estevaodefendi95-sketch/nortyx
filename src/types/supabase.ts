/**
 * Type definitions for Supabase data models
 * Ensures type safety and avoids `as any` casts
 */

// Role types
export type AppRole = 'admin' | 'moderator' | 'user';
export type OrgRole = 'owner' | 'admin' | 'member' | 'viewer';
export type RecurrenceType = 'daily' | 'weekly' | 'monthly' | 'yearly';
export type FormaPagamento = 'dinheiro' | 'credito' | 'debito' | 'pix' | 'transferencia' | 'cheque';
export type TransactionType = 'entrada' | 'saida';
export type PlanType = 'free' | 'pro' | 'enterprise';
export type SubscriptionStatus = 'active' | 'canceled' | 'past_due';

// Database models
export interface Organization {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string;
  plan: PlanType;
  subscription_status: SubscriptionStatus;
  created_at: string;
  updated_at: string;
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: OrgRole;
  created_at: string;
}

export interface Profile {
  user_id: string;
  email: string;
  display_name: string | null;
  organization_id: string | null;
  approved: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  user_id: string;
  role: AppRole;
  created_at: string;
}

export interface Category {
  id: string;
  code: string;
  name: string;
  color: string;
  organization_id: string;
  created_at: string;
  updated_at: string;
}

export interface Subcategory {
  id: string;
  code: string;
  name: string;
  category_code: string;
  organization_id: string;
  created_at: string;
}

export interface Transaction {
  id: number;
  organization_id: string;
  empresa: string;
  valor: number;
  data: string;
  categoria: string;
  subcategoria: string | null;
  pago: boolean;
  agendado: boolean;
  tipo: TransactionType;
  forma_pagamento: FormaPagamento | null;
  pix_code: string | null;
  recurrence_type: RecurrenceType | null;
  recurrence_group_id: string | null;
  observacao: string | null;
  created_at: string;
  updated_at: string;
}

export interface DailyIncome {
  id: number;
  organization_id: string;
  data: string;
  valor: number;
  created_at: string;
  updated_at: string;
}

export interface BillingClient {
  id: string;
  organization_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  created_at: string;
  updated_at: string;
}

export interface BillingCharge {
  id: string;
  organization_id: string;
  client_id: string;
  description: string;
  valor: number;
  data_cobranca: string;
  status: 'pending' | 'paid' | 'canceled';
  created_at: string;
  updated_at: string;
}

export interface TabVisibility {
  id: string;
  user_id: string;
  organization_id: string;
  dashboard: boolean;
  calendar: boolean;
  categories: boolean;
  clients: boolean;
  lancamento: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  action: string;
  table_name: string;
  record_id: string;
  old_data: Record<string, any> | null;
  new_data: Record<string, any> | null;
  user_email: string | null;
  organization_id: string;
  created_at: string;
}

export interface OrganizationInvite {
  id: string;
  organization_id: string;
  email: string;
  role: OrgRole;
  accepted_at: string | null;
  created_at: string;
}

// Insert/Update types (without id, timestamps)
export interface CategoryInsert {
  code: string;
  name: string;
  color: string;
  organization_id: string;
}

export interface TransactionInsert {
  organization_id: string;
  empresa: string;
  valor: number;
  data: string;
  categoria: string;
  subcategoria?: string | null;
  pago: boolean;
  agendado: boolean;
  tipo: TransactionType;
  forma_pagamento?: FormaPagamento | null;
  pix_code?: string | null;
  recurrence_type?: RecurrenceType | null;
  recurrence_group_id?: string | null;
  observacao?: string | null;
}

export interface DailyIncomeInsert {
  organization_id: string;
  data: string;
  valor: number;
}

export interface BillingClientInsert {
  organization_id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
}

export interface BillingChargeInsert {
  organization_id: string;
  client_id: string;
  description: string;
  valor: number;
  data_cobranca: string;
  status?: 'pending' | 'paid' | 'canceled';
}
