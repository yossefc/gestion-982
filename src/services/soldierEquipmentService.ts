// Service unifié pour gérer TOUT l'équipement d'un soldat
// Stocke combat + clothing dans le même document Firebase
import {
    collection,
    doc,
    getDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    getDocs,
    Timestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';

// =============== TYPES ===============

export interface UnifiedEquipmentItem {
    equipmentId: string;
    equipmentName: string;
    quantity: number;
    serial?: string;
    type: 'combat' | 'clothing';  // Distingue l'origine
    category?: string;            // Catégorie (נשק, אופטיקה, etc.)
    subEquipments?: { name: string }[];
    issuedAt: Date;               // Date d'attribution
    issuedBy: string;             // ID de l'utilisateur qui a attribué
}

export interface SoldierEquipment {
    soldierId: string;
    soldierName: string;
    soldierPersonalNumber: string;
    soldierPhone?: string;
    soldierCompany?: string;

    // TOUT l'équipement dans un seul tableau
    items: UnifiedEquipmentItem[];

    // Signatures (une par type si nécessaire)
    combatSignature?: string;
    clothingSignature?: string;

    // URLs des PDFs
    combatPdfUrl?: string;
    clothingPdfUrl?: string;

    // Métadonnées
    lastUpdated: Date;
    createdAt: Date;
}

// Collection unique pour tout l'équipement des soldats
const COLLECTION_NAME = 'soldier_equipment';

// =============== FONCTIONS PRINCIPALES ===============

/**
 * Récupère tout l'équipement d'un soldat
 */
export const getSoldierEquipment = async (
    soldierId: string
): Promise<SoldierEquipment | null> => {
    try {
        const docRef = doc(db, COLLECTION_NAME, soldierId);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            return null;
        }

        const data = docSnap.data();
        return {
            ...data,
            items: data.items || [],
            lastUpdated: data.lastUpdated?.toDate() || new Date(),
            createdAt: data.createdAt?.toDate() || new Date(),
        } as SoldierEquipment;
    } catch (error) {
        console.error('Error getting soldier equipment:', error);
        throw error;
    }
};

/**
 * Récupère l'équipement filtré par type (combat ou clothing)
 */
export const getSoldierEquipmentByType = async (
    soldierId: string,
    type: 'combat' | 'clothing'
): Promise<UnifiedEquipmentItem[]> => {
    const equipment = await getSoldierEquipment(soldierId);
    if (!equipment) return [];

    return equipment.items.filter(item => item.type === type);
};

/**
 * Ajoute des équipements à un soldat (ISSUE/הנפקה)
 * Fusionne avec les équipements existants
 */
export const addEquipmentToSoldier = async (
    soldierId: string,
    soldierInfo: {
        name: string;
        personalNumber: string;
        phone?: string;
        company?: string;
    },
    newItems: Omit<UnifiedEquipmentItem, 'issuedAt'>[],
    signature: string,
    issuedBy: string
): Promise<void> => {
    try {
        const docRef = doc(db, COLLECTION_NAME, soldierId);
        const existing = await getSoldierEquipment(soldierId);

        const now = new Date();
        const type = newItems[0]?.type || 'combat';

        // Préparer les nouveaux items avec timestamp
        const itemsWithTimestamp: UnifiedEquipmentItem[] = newItems.map(item => ({
            ...item,
            issuedAt: now,
            issuedBy,
        }));

        if (existing) {
            // FUSIONNER avec l'équipement existant
            const mergedItems = mergeEquipmentItems(existing.items, itemsWithTimestamp);

            const updateData: any = {
                items: mergedItems,
                lastUpdated: Timestamp.now(),
            };

            // Mettre à jour la signature du type concerné
            if (type === 'combat') {
                updateData.combatSignature = signature;
            } else {
                updateData.clothingSignature = signature;
            }

            await updateDoc(docRef, updateData);
        } else {
            // Créer un nouveau document
            const newDoc: any = {
                soldierId,
                soldierName: soldierInfo.name,
                soldierPersonalNumber: soldierInfo.personalNumber,
                items: itemsWithTimestamp,
                lastUpdated: Timestamp.now(),
                createdAt: Timestamp.now(),
            };

            if (soldierInfo.phone) newDoc.soldierPhone = soldierInfo.phone;
            if (soldierInfo.company) newDoc.soldierCompany = soldierInfo.company;

            if (type === 'combat') {
                newDoc.combatSignature = signature;
            } else {
                newDoc.clothingSignature = signature;
            }

            await setDoc(docRef, newDoc);
        }

        console.log(`Added ${newItems.length} items to soldier ${soldierId}`);
    } catch (error) {
        console.error('Error adding equipment to soldier:', error);
        throw error;
    }
};

/**
 * Retire des équipements d'un soldat (CREDIT/זיכוי)
 */
export const removeEquipmentFromSoldier = async (
    soldierId: string,
    itemsToRemove: { equipmentId: string; quantity: number; serial?: string }[],
    type: 'combat' | 'clothing'
): Promise<UnifiedEquipmentItem[]> => {
    try {
        const existing = await getSoldierEquipment(soldierId);
        if (!existing) {
            throw new Error('Soldier equipment not found');
        }

        // Créer une copie des items et retirer les quantités
        const updatedItems = existing.items.map(item => {
            // Ne traiter que les items du même type
            if (item.type !== type) return item;

            const toRemove = itemsToRemove.find(r => r.equipmentId === item.equipmentId);
            if (!toRemove) return item;

            return {
                ...item,
                quantity: item.quantity - toRemove.quantity,
            };
        }).filter(item => item.quantity > 0); // Supprimer les items à quantité 0

        const docRef = doc(db, COLLECTION_NAME, soldierId);
        await updateDoc(docRef, {
            items: updatedItems,
            lastUpdated: Timestamp.now(),
        });

        console.log(`Removed items from soldier ${soldierId}, remaining: ${updatedItems.length}`);

        return updatedItems;
    } catch (error) {
        console.error('Error removing equipment from soldier:', error);
        throw error;
    }
};

/**
 * Met à jour l'URL du PDF
 */
export const updatePdfUrl = async (
    soldierId: string,
    type: 'combat' | 'clothing',
    pdfUrl: string
): Promise<void> => {
    try {
        const docRef = doc(db, COLLECTION_NAME, soldierId);
        const field = type === 'combat' ? 'combatPdfUrl' : 'clothingPdfUrl';

        await updateDoc(docRef, {
            [field]: pdfUrl,
            lastUpdated: Timestamp.now(),
        });
    } catch (error) {
        console.error('Error updating PDF URL:', error);
        throw error;
    }
};

/**
 * Récupère tous les soldats avec de l'équipement
 */
export const getAllSoldiersWithEquipment = async (
    type?: 'combat' | 'clothing'
): Promise<SoldierEquipment[]> => {
    try {
        const snapshot = await getDocs(collection(db, COLLECTION_NAME));

        const soldiers = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                ...data,
                items: data.items || [],
                lastUpdated: data.lastUpdated?.toDate() || new Date(),
                createdAt: data.createdAt?.toDate() || new Date(),
            } as SoldierEquipment;
        });

        // Filtrer par type si spécifié
        if (type) {
            return soldiers.filter(s =>
                s.items.some(item => item.type === type && item.quantity > 0)
            );
        }

        return soldiers.filter(s => s.items.length > 0);
    } catch (error) {
        console.error('Error getting all soldiers with equipment:', error);
        throw error;
    }
};

/**
 * Calcule les statistiques par type
 */
export const getEquipmentStats = async (
    type: 'combat' | 'clothing'
): Promise<{
    totalSoldiers: number;
    totalItems: number;
    itemsByCategory: { [category: string]: number };
}> => {
    try {
        const soldiers = await getAllSoldiersWithEquipment(type);

        let totalItems = 0;
        const itemsByCategory: { [category: string]: number } = {};

        soldiers.forEach(soldier => {
            soldier.items
                .filter(item => item.type === type)
                .forEach(item => {
                    totalItems += item.quantity;
                    const category = item.category || 'אחר';
                    itemsByCategory[category] = (itemsByCategory[category] || 0) + item.quantity;
                });
        });

        return {
            totalSoldiers: soldiers.length,
            totalItems,
            itemsByCategory,
        };
    } catch (error) {
        console.error('Error getting equipment stats:', error);
        throw error;
    }
};

// =============== FONCTIONS UTILITAIRES ===============

/**
 * Fusionne deux listes d'équipement
 * Si un item existe déjà (même equipmentId + type), additionne les quantités
 */
function mergeEquipmentItems(
    existing: UnifiedEquipmentItem[],
    newItems: UnifiedEquipmentItem[]
): UnifiedEquipmentItem[] {
    const merged = [...existing];

    newItems.forEach(newItem => {
        const existingIndex = merged.findIndex(
            e => e.equipmentId === newItem.equipmentId && e.type === newItem.type
        );

        if (existingIndex >= 0) {
            // Item existe - additionner les quantités
            merged[existingIndex] = {
                ...merged[existingIndex],
                quantity: merged[existingIndex].quantity + newItem.quantity,
                // Fusionner les serials s'ils existent
                serial: mergeSerials(merged[existingIndex].serial, newItem.serial),
                // Mettre à jour la date
                issuedAt: newItem.issuedAt,
            };
        } else {
            // Nouvel item - ajouter
            merged.push(newItem);
        }
    });

    return merged;
}

/**
 * Fusionne deux strings de serials
 */
function mergeSerials(existing?: string, newSerial?: string): string | undefined {
    if (!existing && !newSerial) return undefined;
    if (!existing) return newSerial;
    if (!newSerial) return existing;

    const existingSerials = existing.split(',').map(s => s.trim());
    const newSerials = newSerial.split(',').map(s => s.trim());

    // Fusionner sans doublons
    const merged = [...new Set([...existingSerials, ...newSerials])];
    return merged.join(', ');
}

// =============== MIGRATION ===============

/**
 * Migre les données depuis l'ancien système (assignments) vers le nouveau
 * À exécuter UNE SEULE FOIS
 */
export const migrateFromOldSystem = async (): Promise<void> => {
    try {
        console.log('Starting migration from old assignment system...');

        // Récupérer tous les anciens assignments
        const oldAssignments = await getDocs(collection(db, 'assignments'));

        const soldierMap = new Map<string, SoldierEquipment>();

        oldAssignments.docs.forEach(docSnap => {
            const data = docSnap.data();
            const soldierId = data.soldierId;

            if (!soldierId) return;

            // Créer ou récupérer l'entrée du soldat
            if (!soldierMap.has(soldierId)) {
                soldierMap.set(soldierId, {
                    soldierId,
                    soldierName: data.soldierName || '',
                    soldierPersonalNumber: data.soldierPersonalNumber || '',
                    soldierPhone: data.soldierPhone,
                    soldierCompany: data.soldierCompany,
                    items: [],
                    lastUpdated: new Date(),
                    createdAt: new Date(),
                });
            }

            const soldier = soldierMap.get(soldierId)!;

            // Ajouter les items de cet assignment
            const type = data.type as 'combat' | 'clothing';
            const action = data.action || 'issue';

            (data.items || []).forEach((item: any) => {
                const newItem: UnifiedEquipmentItem = {
                    equipmentId: item.equipmentId || '',
                    equipmentName: item.equipmentName,
                    quantity: action === 'credit' ? -item.quantity : item.quantity,
                    serial: item.serial,
                    type,
                    category: item.category,
                    subEquipments: item.subEquipments,
                    issuedAt: data.timestamp?.toDate() || new Date(),
                    issuedBy: data.assignedBy || '',
                };

                soldier.items.push(newItem);
            });

            // Ajouter les signatures
            if (data.signature) {
                if (type === 'combat') {
                    soldier.combatSignature = data.signature;
                } else {
                    soldier.clothingSignature = data.signature;
                }
            }

            // Ajouter les PDFs
            if (data.pdfUrl) {
                if (type === 'combat') {
                    soldier.combatPdfUrl = data.pdfUrl;
                } else {
                    soldier.clothingPdfUrl = data.pdfUrl;
                }
            }
        });

        // Consolider les items pour chaque soldat
        for (const [soldierId, soldier] of soldierMap) {
            // Regrouper par equipmentId + type et calculer le solde
            const consolidatedItems = new Map<string, UnifiedEquipmentItem>();

            soldier.items.forEach(item => {
                const key = `${item.equipmentId}_${item.type}`;

                if (consolidatedItems.has(key)) {
                    const existing = consolidatedItems.get(key)!;
                    existing.quantity += item.quantity;
                    existing.serial = mergeSerials(existing.serial, item.serial);
                } else {
                    consolidatedItems.set(key, { ...item });
                }
            });

            // Garder seulement les items avec quantité > 0
            soldier.items = Array.from(consolidatedItems.values())
                .filter(item => item.quantity > 0);

            // Sauvegarder dans la nouvelle collection
            if (soldier.items.length > 0 || soldier.combatSignature || soldier.clothingSignature) {
                const docRef = doc(db, COLLECTION_NAME, soldierId);
                await setDoc(docRef, {
                    ...soldier,
                    lastUpdated: Timestamp.now(),
                    createdAt: Timestamp.now(),
                });
                console.log(`Migrated soldier ${soldierId}: ${soldier.items.length} items`);
            }
        }

        console.log('Migration completed!');
    } catch (error) {
        console.error('Error during migration:', error);
        throw error;
    }
};