const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

const firebaseConfig = {
    apiKey: "AIzaSyB229X5qoI8v5KOQ_gG0RtyIJAWZ-GfU50",
    projectId: "gestion-982",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkInventory() {
    console.log("Fetching weapons_inventory...");
    const weaponsSnap = await getDocs(collection(db, 'weapons_inventory'));
    const weapons = weaponsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    console.log(`Found ${weapons.length} weapons.`);
    const assignedWeapons = weapons.filter(w => w.status === 'assigned');
    console.log(`Found ${assignedWeapons.length} ASSIGNED weapons.`);

    console.log("Fetching soldier_holdings...");
    const holdingsSnap = await getDocs(collection(db, 'soldier_holdings'));
    const holdings = holdingsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    console.log(`Found ${holdings.length} holdings.`);

    const combatHoldings = holdings.filter(h => h.type === 'combat');
    console.log(`Found ${combatHoldings.length} combat holdings.`);

    let allAssignedSerials = new Set();
    for (const h of combatHoldings) {
        for (const item of (h.items || [])) {
            if (item.serials) {
                for (const s of item.serials) {
                    allAssignedSerials.add(s);
                }
            }
        }
    }
    console.log(`Total unique serials currently held by soldiers: ${allAssignedSerials.size}`);

    const weaponsToFix = [];
    const soldiersToNotify = new Set();

    for (const w of assignedWeapons) {
        if (!allAssignedSerials.has(w.serialNumber)) {
            weaponsToFix.push({
                id: w.id,
                serial: w.serialNumber,
                assignedTo: w.assignedTo?.soldierName || 'Unknown'
            });
            if (w.assignedTo?.soldierName) {
                soldiersToNotify.add(w.assignedTo.soldierName);
            }
        }
    }

    console.log('\n--- INCONSISTENCIES FOUND ---');
    console.log(`There are ${weaponsToFix.length} weapons marked as 'assigned' in 'weapons_inventory' but NOT found in any soldier's current combat holdings.`);

    if (weaponsToFix.length > 0) {
        console.log("\nSoldiers affected:");
        for (const s of Array.from(soldiersToNotify).sort()) {
            console.log(`- ${s}`);
        }

        console.log("\nWeapons to fix:");
        for (const w of weaponsToFix) {
            console.log(`- Serial: ${w.serial}, Soldat précédent: ${w.assignedTo}, docId: ${w.id}`);
        }
    } else {
        console.log("No inconsistencies found! All assigned weapons are properly accounted for in soldier holdings.");
    }

    process.exit(0);
}

checkInventory().catch(console.error);
