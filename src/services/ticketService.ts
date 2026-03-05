/**
 * ticketService.ts
 * Service complet pour le système de Tickets / Signalement (בקשות ותקלות)
 * Collections Firestore : mozavim, issue_types, tickets
 * Firebase Storage : tickets/{ticketId}/photo.jpg
 */

import {
  collection,
  doc,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
  onSnapshot,
  QuerySnapshot,
  DocumentData,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../config/firebase';
import { Mozav, IssueType, Ticket } from '../types';

// ─── Noms de collections ───────────────────────────────────────────────────
const MOZAVIM_COL     = 'mozavim';
const ISSUE_TYPES_COL = 'issue_types';
const TICKETS_COL     = 'tickets';

// ─── Convertisseurs ──────────────────────────────────────────────────────────

function docToMozav(id: string, data: DocumentData): Mozav {
  return {
    id,
    name: data.name || '',
    createdAt: data.createdAt instanceof Timestamp
      ? data.createdAt.toDate()
      : new Date(data.createdAt || Date.now()),
  };
}

function docToIssueType(id: string, data: DocumentData): IssueType {
  return {
    id,
    name: data.name || '',
    assignedUserId: data.assignedUserId || '',
    assignedUserName: data.assignedUserName || '',
    createdAt: data.createdAt instanceof Timestamp
      ? data.createdAt.toDate()
      : new Date(data.createdAt || Date.now()),
  };
}

function docToTicket(id: string, data: DocumentData): Ticket {
  return {
    id,
    reporterName: data.reporterName || '',
    reporterUserId: data.reporterUserId || '',
    pluga: data.pluga || '',
    mozavId: data.mozavId || '',
    mozavName: data.mozavName || '',
    issueTypeId: data.issueTypeId || '',
    issueTypeName: data.issueTypeName || '',
    assignedUserId: data.assignedUserId || '',
    description: data.description || '',
    photoUrl: data.photoUrl || null,
    status: data.status || 'open',
    createdAt: data.createdAt instanceof Timestamp
      ? data.createdAt.toDate()
      : new Date(data.createdAt || Date.now()),
    closedAt: data.closedAt instanceof Timestamp
      ? data.closedAt.toDate()
      : data.closedAt
        ? new Date(data.closedAt)
        : null,
  };
}

// ─── MOZAVIM (מוצבים) ────────────────────────────────────────────────────────

/** Récupère tous les מוצבים */
export async function getMozavim(): Promise<Mozav[]> {
  const snap = await getDocs(
    query(collection(db, MOZAVIM_COL), orderBy('name'))
  );
  return snap.docs.map(d => docToMozav(d.id, d.data()));
}

/** Ajoute un מוצב */
export async function addMozav(name: string): Promise<string> {
  const ref = await addDoc(collection(db, MOZAVIM_COL), {
    name: name.trim(),
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

/** Supprime un מוצב */
export async function deleteMozav(mozavId: string): Promise<void> {
  await deleteDoc(doc(db, MOZAVIM_COL, mozavId));
}

// ─── ISSUE TYPES (סוגי תקלות) ───────────────────────────────────────────────

/** Récupère tous les types de problèmes */
export async function getIssueTypes(): Promise<IssueType[]> {
  const snap = await getDocs(
    query(collection(db, ISSUE_TYPES_COL), orderBy('name'))
  );
  return snap.docs.map(d => docToIssueType(d.id, d.data()));
}

/** Ajoute un type de problème avec son responsable */
export async function addIssueType(
  name: string,
  assignedUserId: string,
  assignedUserName: string
): Promise<string> {
  const ref = await addDoc(collection(db, ISSUE_TYPES_COL), {
    name: name.trim(),
    assignedUserId,
    assignedUserName,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

/** Supprime un type de problème */
export async function deleteIssueType(issueTypeId: string): Promise<void> {
  await deleteDoc(doc(db, ISSUE_TYPES_COL, issueTypeId));
}

// ─── UPLOAD PHOTO ────────────────────────────────────────────────────────────

/**
 * Upload une photo vers Firebase Storage
 * Retourne l'URL de téléchargement publique
 */
async function uploadTicketPhoto(
  uri: string,
  ticketId: string
): Promise<string> {
  const response = await fetch(uri);
  const blob = await response.blob();
  const storageRef = ref(storage, `tickets/${ticketId}/photo.jpg`);
  await uploadBytes(storageRef, blob);
  return getDownloadURL(storageRef);
}

// ─── TICKETS ─────────────────────────────────────────────────────────────────

/**
 * Crée un ticket (et upload la photo si fournie)
 * Retourne l'ID du ticket créé
 */
export async function createTicket(
  data: Omit<Ticket, 'id' | 'createdAt' | 'closedAt' | 'status' | 'photoUrl'>,
  photoUri?: string | null
): Promise<string> {
  // 1. Créer le document sans photo
  const docRef = await addDoc(collection(db, TICKETS_COL), {
    ...data,
    photoUrl: null,
    status: 'open',
    createdAt: serverTimestamp(),
    closedAt: null,
  });

  // 2. Uploader la photo et mettre à jour le document si fournie
  if (photoUri) {
    try {
      const photoUrl = await uploadTicketPhoto(photoUri, docRef.id);
      await updateDoc(docRef, { photoUrl });
    } catch (e) {
      console.warn('[ticketService] Photo upload failed, ticket saved without photo:', e);
    }
  }

  return docRef.id;
}

/**
 * Ferme un ticket — enregistre l'heure exacte via serverTimestamp()
 */
export async function closeTicket(ticketId: string): Promise<void> {
  const ticketRef = doc(db, TICKETS_COL, ticketId);
  await updateDoc(ticketRef, {
    status: 'closed',
    closedAt: serverTimestamp(),
  });
}

/**
 * Tickets créés par un utilisateur (vue du רס"פ)
 */
export async function getMyTickets(reporterUserId: string): Promise<Ticket[]> {
  const snap = await getDocs(
    query(
      collection(db, TICKETS_COL),
      where('reporterUserId', '==', reporterUserId),
      orderBy('createdAt', 'desc')
    )
  );
  return snap.docs.map(d => docToTicket(d.id, d.data()));
}

/**
 * Tickets assignés à un utilisateur (vue de l'האחראי)
 * Filtre uniquement les tickets dont assignedUserId correspond
 */
export async function getTicketsForUser(assignedUserId: string): Promise<Ticket[]> {
  const snap = await getDocs(
    query(
      collection(db, TICKETS_COL),
      where('assignedUserId', '==', assignedUserId),
      orderBy('createdAt', 'desc')
    )
  );
  return snap.docs.map(d => docToTicket(d.id, d.data()));
}

/**
 * Écoute en temps réel les tickets d'un responsable (האחראי)
 * Retourne un unsubscribe à appeler dans le cleanup du useEffect
 */
export function subscribeToUserTickets(
  assignedUserId: string,
  callback: (tickets: Ticket[]) => void
): () => void {
  const q = query(
    collection(db, TICKETS_COL),
    where('assignedUserId', '==', assignedUserId),
    orderBy('createdAt', 'desc')
  );

  return onSnapshot(q, (snap: QuerySnapshot<DocumentData>) => {
    const tickets = snap.docs.map(d => docToTicket(d.id, d.data()));
    callback(tickets);
  });
}

/**
 * Écoute en temps réel les tickets d'un רס"פ
 */
export function subscribeToMyTickets(
  reporterUserId: string,
  callback: (tickets: Ticket[]) => void
): () => void {
  const q = query(
    collection(db, TICKETS_COL),
    where('reporterUserId', '==', reporterUserId),
    orderBy('createdAt', 'desc')
  );

  return onSnapshot(q, (snap: QuerySnapshot<DocumentData>) => {
    const tickets = snap.docs.map(d => docToTicket(d.id, d.data()));
    callback(tickets);
  });
}

// ─── Export groupé ───────────────────────────────────────────────────────────

export const ticketService = {
  getMozavim,
  addMozav,
  deleteMozav,
  getIssueTypes,
  addIssueType,
  deleteIssueType,
  createTicket,
  closeTicket,
  getMyTickets,
  getTicketsForUser,
  subscribeToUserTickets,
  subscribeToMyTickets,
};
