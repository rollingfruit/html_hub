import { RequestStatus, RequestType } from '../types';

export type Ticket = {
  requestId: number;
  clientSecret: string;
  path: string;
  type: RequestType;
  status: RequestStatus;
  reason?: string;
  token?: string;
  expiresAt?: string | null;
  timestamp: number;
};

const STORAGE_KEY = 'ecs_ticket_records';
export const TICKET_EVENT = 'ecs-ticket-change';

const hasWindow = () => typeof window !== 'undefined';

const readTickets = (): Ticket[] => {
  if (!hasWindow()) {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed as Ticket[];
    }
    return [];
  } catch (error) {
    return [];
  }
};

const persistTickets = (tickets: Ticket[]) => {
  if (!hasWindow()) {
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tickets));
  if (typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent(TICKET_EVENT));
  }
};

const normalizePath = (path: string) => {
  if (!path) {
    return '';
  }
  return path.trim().replace(/^\/+/, '').replace(/\/+/g, '/');
};

const sortTickets = (tickets: Ticket[]) => tickets.sort((a, b) => b.timestamp - a.timestamp);

const generateSecret = () => {
  if (typeof crypto !== 'undefined') {
    if (typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    if (typeof crypto.getRandomValues === 'function') {
      const buffer = new Uint8Array(16);
      crypto.getRandomValues(buffer);
      return Array.from(buffer, (byte) => byte.toString(16).padStart(2, '0')).join('');
    }
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
};

const TicketManager = {
  normalizePath,
  generateSecret,
  list(): Ticket[] {
    return sortTickets(readTickets());
  },
  getTicket(path: string, type: RequestType): Ticket | null {
    const normalized = normalizePath(path);
    if (!normalized) {
      return null;
    }
    const tickets = readTickets().filter((ticket) => ticket.path === normalized && ticket.type === type);
    return sortTickets(tickets)[0] || null;
  },
  getTicketById(requestId: number): Ticket | null {
    return readTickets().find((ticket) => ticket.requestId === requestId) || null;
  },
  createTicket({
    requestId,
    path,
    type,
    clientSecret,
    reason,
  }: {
    requestId: number;
    path: string;
    type: RequestType;
    clientSecret: string;
    reason?: string;
  }): Ticket {
    const normalized = normalizePath(path);
    const tickets = readTickets().filter((ticket) => ticket.requestId !== requestId);
    const ticket: Ticket = {
      requestId,
      path: normalized,
      type,
      clientSecret,
      reason,
      status: 'PENDING',
      timestamp: Date.now(),
    };
    tickets.push(ticket);
    persistTickets(tickets);
    return ticket;
  },
  updateTicket(requestId: number, updates: Partial<Omit<Ticket, 'requestId' | 'clientSecret'>>): Ticket | null {
    const tickets = readTickets();
    let updated: Ticket | null = null;
    const next = tickets.map((ticket) => {
      if (ticket.requestId !== requestId) {
        return ticket;
      }
      updated = {
        ...ticket,
        ...updates,
        timestamp: Date.now(),
      };
      return updated;
    });
    if (!updated) {
      return null;
    }
    persistTickets(next);
    return updated;
  },
  removeTicket(requestId: number) {
    const tickets = readTickets();
    const filtered = tickets.filter((ticket) => ticket.requestId !== requestId);
    if (filtered.length !== tickets.length) {
      persistTickets(filtered);
    }
  },
};

export default TicketManager;
