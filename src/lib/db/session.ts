// Huidige ingelogde gebruiker voor de datalaag. Wordt door AuthProvider gezet; zonder sessie
// wordt er geen lokale database geopend en dus ook geen data geladen.
let userId: string | null = null;

export function setSessionUser(id: string | null): void {
  userId = id;
}

export function requireUserId(): string {
  if (!userId) throw new Error('Geen sessie.');
  return userId;
}
