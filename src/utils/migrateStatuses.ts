import { db } from '../config/firebase';
import {
    collection,
    getDocs,
    writeBatch,
    doc,
    query,
    where
} from 'firebase/firestore';

/**
 * Migration Utility: Unify Armament Statuses
 * 
 * 1. weapons_inventory: 'storage' -> 'stored'
 * 2. soldier_holdings: 'active' -> 'assigned'
 */
export const migrateArmamentStatuses = async () => {
    console.log('Starting migration of armament statuses...');
    const batch = writeBatch(db);
    let count = 0;

    try {
        // 1. Migrate weapons_inventory: storage -> stored
        console.log('Migrating weapons_inventory...');
        const weaponsRef = collection(db, 'weapons_inventory');
        const storageWeaponsQuery = query(weaponsRef, where('status', '==', 'storage'));
        const weaponsSnapshot = await getDocs(storageWeaponsQuery);

        weaponsSnapshot.forEach((document) => {
            batch.update(doc(db, 'weapons_inventory', document.id), { status: 'stored' });
            count++;
        });
        console.log(`Prepared ${weaponsSnapshot.size} weapons for status update.`);

        // 2. Migrate soldier_holdings: active -> assigned
        console.log('Migrating soldier_holdings...');
        const holdingsRef = collection(db, 'soldier_holdings');
        const holdingsSnapshot = await getDocs(holdingsRef);

        holdingsSnapshot.forEach((document) => {
            const data = document.data();
            let updated = false;

            // Update top-level status if it exists and is 'active'
            if (data.status === 'active') {
                data.status = 'assigned';
                updated = true;
            }

            // Update individual items in holdings
            if (data.items && Array.isArray(data.items)) {
                data.items.forEach((item: any) => {
                    if (item.status === 'active') {
                        item.status = 'assigned';
                        updated = true;
                    }
                    if (item.status === 'storage') {
                        item.status = 'stored';
                        updated = true;
                    }
                });
            }

            if (updated) {
                batch.update(doc(db, 'soldier_holdings', document.id), {
                    status: data.status,
                    items: data.items
                });
                count++;
            }
        });
        console.log(`Prepared soldier_holdings documents for status update.`);

        if (count > 0) {
            await batch.commit();
            console.log(`Migration completed successfully. Updated ${count} documents.`);
            return { success: true, updatedCount: count };
        } else {
            console.log('No documents required migration.');
            return { success: true, updatedCount: 0 };
        }
    } catch (error) {
        console.error('Error during migration:', error);
        return { success: false, error };
    }
};
