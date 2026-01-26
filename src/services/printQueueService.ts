/**
 * printQueueService.ts
 * Service de gestion de la file d'attente d'impression centralisée
 * Permet à plusieurs appareils d'envoyer des documents à imprimer sur une imprimante centrale
 */

import {
  collection,
  addDoc,
  updateDoc,
  doc,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
  deleteDoc,
  getDocs,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../config/firebase';
import * as FileSystem from 'expo-file-system/legacy';

const PRINT_QUEUE_COLLECTION = 'print_queue';

export interface PrintJob {
  id: string;
  pdfUrl: string; // URL Firebase Storage
  soldierName: string;
  soldierPersonalNumber: string;
  documentType: 'combat' | 'clothing' | 'rsp';
  status: 'pending' | 'printing' | 'completed' | 'failed';
  createdAt: Date;
  createdBy: string;
  createdByName: string;
  printedAt?: Date;
  printedBy?: string; // ID de l'ordinateur/imprimante
  error?: string;
  metadata?: {
    itemsCount: number;
    company?: string;
  };
}

export const printQueueService = {
  /**
   * Ajoute un document PDF à la file d'attente d'impression
   * @param pdfData - Données du PDF (base64 ou Uint8Array)
   * @param jobData - Métadonnées du document
   */
  async addPrintJob(
    pdfData: string | Uint8Array,
    jobData: {
      soldierName: string;
      soldierPersonalNumber: string;
      documentType: 'combat' | 'clothing' | 'rsp';
      createdBy: string;
      createdByName: string;
      metadata?: {
        itemsCount: number;
        company?: string;
      };
    }
  ): Promise<string> {
    try {
      console.log('[PrintQueue] Adding print job to queue...');

      // Keep base64 string as-is (don't convert to Uint8Array)
      let pdfBase64: string;
      if (typeof pdfData === 'string') {
        // Remove data:application/pdf;base64, prefix if present
        pdfBase64 = pdfData.replace(/^data:application\/pdf;base64,/, '');
      } else {
        // Convert Uint8Array to base64
        let binary = '';
        for (let i = 0; i < pdfData.length; i++) {
          binary += String.fromCharCode(pdfData[i]);
        }
        pdfBase64 = btoa(binary);
      }

      // Générer un nom de fichier unique
      const timestamp = Date.now();
      const fileName = `${jobData.documentType}_${jobData.soldierPersonalNumber}_${timestamp}.pdf`;

      console.log('[PrintQueue] Storing PDF as base64 in Firestore...');

      // Créer l'entrée dans la file d'attente avec le PDF en base64
      // Note: Firestore permet 1MB par document, suffisant pour la plupart des PDFs
      const printJob = {
        pdfBase64, // Store base64 directly instead of URL
        pdfUrl: `data:application/pdf;base64,${pdfBase64}`, // Create data URL for compatibility
        fileName,
        soldierName: jobData.soldierName,
        soldierPersonalNumber: jobData.soldierPersonalNumber,
        documentType: jobData.documentType,
        status: 'pending',
        createdAt: Timestamp.now(),
        createdBy: jobData.createdBy,
        createdByName: jobData.createdByName,
        metadata: jobData.metadata || {},
      };

      const docRef = await addDoc(collection(db, PRINT_QUEUE_COLLECTION), printJob);
      console.log('[PrintQueue] Print job added to queue:', docRef.id);

      return docRef.id;
    } catch (error) {
      console.error('[PrintQueue] Error adding print job:', error);
      throw error;
    }
  },

  /**
   * Écoute les nouveaux jobs d'impression (pour l'ordinateur d'impression)
   * @param callback - Fonction appelée pour chaque nouveau job
   */
  listenForPrintJobs(
    callback: (job: PrintJob) => void,
    onError?: (error: Error) => void
  ): () => void {
    console.log('[PrintQueue] Starting to listen for print jobs...');

    const q = query(
      collection(db, PRINT_QUEUE_COLLECTION),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const job: PrintJob = {
              id: change.doc.id,
              ...change.doc.data(),
              createdAt: change.doc.data().createdAt?.toDate(),
              printedAt: change.doc.data().printedAt?.toDate(),
            } as PrintJob;

            console.log('[PrintQueue] New print job detected:', job.id);
            callback(job);
          }
        });
      },
      (error) => {
        console.error('[PrintQueue] Error listening for print jobs:', error);
        if (onError) onError(error);
      }
    );

    return unsubscribe;
  },

  /**
   * Marque un job comme étant en cours d'impression
   */
  async markAsPrinting(jobId: string, printerId: string): Promise<void> {
    try {
      const docRef = doc(db, PRINT_QUEUE_COLLECTION, jobId);
      await updateDoc(docRef, {
        status: 'printing',
        printedBy: printerId,
        printStartedAt: Timestamp.now(),
      });
      console.log('[PrintQueue] Job marked as printing:', jobId);
    } catch (error) {
      console.error('[PrintQueue] Error marking job as printing:', error);
      throw error;
    }
  },

  /**
   * Marque un job comme complété
   */
  async markAsCompleted(jobId: string): Promise<void> {
    try {
      const docRef = doc(db, PRINT_QUEUE_COLLECTION, jobId);
      await updateDoc(docRef, {
        status: 'completed',
        printedAt: Timestamp.now(),
      });
      console.log('[PrintQueue] Job marked as completed:', jobId);
    } catch (error) {
      console.error('[PrintQueue] Error marking job as completed:', error);
      throw error;
    }
  },

  /**
   * Marque un job comme échoué
   */
  async markAsFailed(jobId: string, error: string): Promise<void> {
    try {
      const docRef = doc(db, PRINT_QUEUE_COLLECTION, jobId);
      await updateDoc(docRef, {
        status: 'failed',
        error,
        failedAt: Timestamp.now(),
      });
      console.log('[PrintQueue] Job marked as failed:', jobId, error);
    } catch (error) {
      console.error('[PrintQueue] Error marking job as failed:', error);
      throw error;
    }
  },

  /**
   * Obtient tous les jobs en attente
   */
  async getPendingJobs(): Promise<PrintJob[]> {
    try {
      const q = query(
        collection(db, PRINT_QUEUE_COLLECTION),
        where('status', '==', 'pending'),
        orderBy('createdAt', 'asc')
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        printedAt: doc.data().printedAt?.toDate(),
      })) as PrintJob[];
    } catch (error) {
      console.error('[PrintQueue] Error getting pending jobs:', error);
      throw error;
    }
  },

  /**
   * Nettoie les jobs complétés de plus de 24h
   */
  async cleanupOldJobs(): Promise<number> {
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const q = query(
        collection(db, PRINT_QUEUE_COLLECTION),
        where('status', '==', 'completed'),
        where('printedAt', '<', Timestamp.fromDate(yesterday))
      );

      const snapshot = await getDocs(q);
      let deletedCount = 0;

      for (const docSnapshot of snapshot.docs) {
        await deleteDoc(doc(db, PRINT_QUEUE_COLLECTION, docSnapshot.id));
        deletedCount++;
      }

      console.log('[PrintQueue] Cleaned up', deletedCount, 'old jobs');
      return deletedCount;
    } catch (error) {
      console.error('[PrintQueue] Error cleaning up old jobs:', error);
      throw error;
    }
  },
};
