import { v4 as uuidv4 } from 'uuid';

/** Client-side UUID (v4). Nodig voor offline aanmaken en idempotente sync. */
export function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : uuidv4();
}
