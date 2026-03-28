/**
 * State BRIC Implementation - Reference Template
 * Complete BRIC for managing state-specific data (CA, IL, TX, etc.)
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { eventBus, Event, EventTopics, createEvent } from '../../lib/event-system';
import { RpcServer } from '../../lib/inter-bric-rpc';

export interface StateBricConfig {
  stateCode: string; // 'CA', 'IL', 'TX', etc.
  supabaseUrl: string;
  supabaseServiceKey: string;
  kmsKeyId: string; // State-specific KMS key
}

/**
 * State BRIC - Manages all data for a single state
 * Implements Law #4: State BRIC Complete Isolation
 */
export class StateBric {
  private stateCode: string;
  private db: SupabaseClient;
  private rpcServer: RpcServer;

  constructor(config: StateBricConfig) {
    this.stateCode = config.stateCode;
    this.db = createClient(config.supabaseUrl, config.supabaseServiceKey);

    this.rpcServer = new RpcServer({
      serviceName: `state-bric-${config.stateCode}`,
      certPath: `/certs/state-${config.stateCode}.crt`,
      keyPath: `/certs/state-${config.stateCode}.key`,
      caPath: `/certs/ca.crt`,
    });

    this.registerRpcHandlers();
    this.subscribeToEvents();
  }

  /**
   * Create a new customer in this state
   * Enforces Law #4: State isolation via RLS
   */
  async createCustomer(data: {
    company_name: string;
    contact_name: string;
    email: string;
    phone: string;
    metadata?: Record<string, any>;
  }): Promise<{ id: string; error?: string }> {
    try {
      // Enforce state_code = this.stateCode (Law #4)
      const { data: customer, error } = await this.db
        .from(`customers`)
        .insert({
          state_code: this.stateCode,
          company_name: data.company_name,
          contact_name: data.contact_name,
          email: data.email,
          phone: data.phone,
          status: 'active',
          metadata: data.metadata || {},
        })
        .select('id')
        .single();

      if (error) {
        return { id: '', error: error.message };
      }

      // Emit event
      const event = createEvent(
        'customer_created',
        EventTopics.CUSTOMER_CREATED,
        {
          customer_id: customer!.id,
          state_code: this.stateCode,
          company_name: data.company_name,
        },
        `state-bric-${this.stateCode}`,
        this.stateCode
      );

      await eventBus.publish(event);

      return { id: customer!.id };
    } catch (error) {
      return { id: '', error: String(error) };
    }
  }

  /**
   * Create a new project for a customer
   */
  async createProject(data: {
    customer_id: string;
    name: string;
    description: string;
    service_type: string;
    estimated_value: number;
  }): Promise<{ id: string; error?: string }> {
    try {
      const { data: project, error } = await this.db
        .from('projects')
        .insert({
          state_code: this.stateCode,
          customer_id: data.customer_id,
          name: data.name,
          description: data.description,
          service_type: data.service_type,
          estimated_value: data.estimated_value,
          status: 'intake',
          deposit_status: 'pending',
          contract_status: 'pending',
        })
        .select('id')
        .single();

      if (error) {
        return { id: '', error: error.message };
      }

      const event = createEvent(
        'project_created',
        EventTopics.PROJECT_CREATED,
        {
          project_id: project!.id,
          customer_id: data.customer_id,
          state_code: this.stateCode,
          service_type: data.service_type,
        },
        `state-bric-${this.stateCode}`,
        this.stateCode
      );

      await eventBus.publish(event);

      return { id: project!.id };
    } catch (error) {
      return { id: '', error: String(error) };
    }
  }

  /**
   * Get customer (RLS enforces only state-scoped access)
   */
  async getCustomer(customerId: string): Promise<any | null> {
    try {
      const { data, error } = await this.db
        .from('customers')
        .select('*')
        .eq('id', customerId)
        .eq('state_code', this.stateCode)
        .single();

      if (error) {
        console.error('Get customer error:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Get customer failed:', error);
      return null;
    }
  }

  /**
   * Get projects for customer
   */
  async getProjects(customerId: string): Promise<any[]> {
    try {
      const { data, error } = await this.db
        .from('projects')
        .select('*')
        .eq('customer_id', customerId)
        .eq('state_code', this.stateCode);

      if (error) {
        console.error('Get projects error:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Get projects failed:', error);
      return [];
    }
  }

  /**
   * Record transaction (deposit, payment, etc.)
   */
  async recordTransaction(data: {
    project_id: string;
    customer_id: string;
    type: 'deposit' | 'payment' | 'refund' | 'adjustment';
    amount: number;
    description: string;
    reference_id: string;
  }): Promise<{ id: string; error?: string }> {
    try {
      const { data: transaction, error } = await this.db
        .from('transactions')
        .insert({
          state_code: this.stateCode,
          project_id: data.project_id,
          customer_id: data.customer_id,
          type: data.type,
          amount: data.amount,
          description: data.description,
          reference_id: data.reference_id,
        })
        .select('id')
        .single();

      if (error) {
        return { id: '', error: error.message };
      }

      // Emit event
      const event = createEvent(
        `transaction_${data.type}`,
        EventTopics.PROJECT_CREATED,
        {
          transaction_id: transaction!.id,
          project_id: data.project_id,
          amount: data.amount,
        },
        `state-bric-${this.stateCode}`,
        this.stateCode
      );

      await eventBus.publish(event);

      return { id: transaction!.id };
    } catch (error) {
      return { id: '', error: String(error) };
    }
  }

  /**
   * Register RPC methods for inter-BRIC calls
   */
  private registerRpcHandlers(): void {
    this.rpcServer.registerHandler('get_customer', async (params: any) => {
      return this.getCustomer(params.customer_id);
    });

    this.rpcServer.registerHandler('create_customer', async (params: any) => {
      return this.createCustomer(params);
    });

    this.rpcServer.registerHandler('get_projects', async (params: any) => {
      return this.getProjects(params.customer_id);
    });

    this.rpcServer.registerHandler('record_transaction', async (params: any) => {
      return this.recordTransaction(params);
    });
  }

  /**
   * Subscribe to state-specific events
   */
  private subscribeToEvents(): void {
    // Listen for policy verified events
    eventBus.subscribe(EventTopics.POLICY_VERIFIED, async (event: Event) => {
      if (event.stateCode !== this.stateCode) return;

      console.log(`Policy verified for customer ${event.data.customer_id} in ${this.stateCode}`);
      // Could trigger auto-transition of projects
    });

    // Listen for compliance approved events
    eventBus.subscribe(EventTopics.COMPLIANCE_APPROVED, async (event: Event) => {
      if (event.stateCode !== this.stateCode) return;

      console.log(`Compliance approved for ${event.data.customer_id} in ${this.stateCode}`);
      // Could unlock project progression
    });
  }
}

/**
 * Factory to create state BRICs for all states
 */
export function createStateBricsForAllStates(config: {
  supabaseUrl: string;
  supabaseServiceKey: string;
  states: string[];
}): Map<string, StateBric> {
  const brics = new Map<string, StateBric>();

  for (const state of config.states) {
    brics.set(
      state,
      new StateBric({
        stateCode: state,
        supabaseUrl: config.supabaseUrl,
        supabaseServiceKey: config.supabaseServiceKey,
        kmsKeyId: `state-${state}-key`,
      })
    );
  }

  return brics;
}
