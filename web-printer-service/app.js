// Firebase Configuration
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import {
    getAuth,
    signInWithEmailAndPassword,
    GoogleAuthProvider,
    signInWithPopup,
    onAuthStateChanged,
    signOut
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import {
    getFirestore,
    collection,
    query,
    where,
    orderBy,
    onSnapshot,
    doc,
    updateDoc,
    Timestamp,
    deleteDoc,
    getDocs
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Firebase Config (same as mobile app)
const firebaseConfig = {
    apiKey: "AIzaSyB229X5qoI8v5KOQ_gG0RtyIJAWZ-GfU50",
    authDomain: "gestion-982.firebaseapp.com",
    projectId: "gestion-982",
    storageBucket: "gestion-982.firebasestorage.app",
    messagingSenderId: "624248239778",
    appId: "1:624248239778:android:497ded1eeec435330cc9fb"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// DOM Elements
const loginSection = document.getElementById('loginSection');
const dashboard = document.getElementById('dashboard');
const loginForm = document.getElementById('loginForm');
const googleLoginBtn = document.getElementById('googleLoginBtn');
const loginError = document.getElementById('loginError');
const logoutBtn = document.getElementById('logoutBtn');
const statusBadge = document.getElementById('statusBadge');
const statusText = document.getElementById('statusText');
const queueList = document.getElementById('queueList');
const todayCount = document.getElementById('todayCount');
const completedCount = document.getElementById('completedCount');
const pendingCount = document.getElementById('pendingCount');
const failedCount = document.getElementById('failedCount');
const clearCompletedBtn = document.getElementById('clearCompletedBtn');
const pdfFrame = document.getElementById('pdfFrame');

// State
let unsubscribeQueue = null;
let stats = {
    today: 0,
    completed: 0,
    pending: 0,
    failed: 0
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    checkAuthState();
});

function setupEventListeners() {
    loginForm.addEventListener('submit', handleLogin);
    if (googleLoginBtn) {
        googleLoginBtn.addEventListener('click', handleGoogleLogin);
    }
    logoutBtn.addEventListener('click', handleLogout);
    clearCompletedBtn.addEventListener('click', clearCompletedJobs);
}

// Check Authentication State
function checkAuthState() {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            showDashboard();
            startListeningToQueue();
            updateStatusBadge(true);
        } else {
            showLogin();
            updateStatusBadge(false);
        }
    });
}

// Handle Login
async function handleLogin(e) {
    e.preventDefault();

    const submitBtn = loginForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'מתחבר...';

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    try {
        loginError.style.display = 'none';
        await signInWithEmailAndPassword(auth, email, password);
        console.log('✓ התחברות הצליחה');
    } catch (error) {
        console.error('✗ שגיאת התחברות:', error);
        loginError.textContent = 'שגיאה: ' + error.message;
        loginError.style.display = 'block';
        alert('שגיאה בהתחברות: ' + error.message);
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
}

// Handle Google Login
async function handleGoogleLogin() {
    const btn = document.getElementById('googleLoginBtn');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = 'נפתח חלון התחברות...';

    try {
        loginError.style.display = 'none';
        const provider = new GoogleAuthProvider();
        await signInWithPopup(auth, provider);
        console.log('✓ התחברות עם Google הצליחה');
    } catch (error) {
        console.error('✗ שגיאת התחברות Google:', error);
        loginError.textContent = 'שגיאה בהתחברות עם Google: ' + error.message;
        loginError.style.display = 'block';
        alert('שגיאה בהתחברות Google: ' + error.message);
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

// Handle Logout
async function handleLogout() {
    try {
        if (unsubscribeQueue) {
            unsubscribeQueue();
            unsubscribeQueue = null;
        }
        await signOut(auth);
        console.log('✓ התנתקות הצליחה');
    } catch (error) {
        console.error('✗ שגיאת התנתקות:', error);
    }
}

// Show/Hide Sections
function showLogin() {
    loginSection.style.display = 'block';
    dashboard.style.display = 'none';
}

function showDashboard() {
    loginSection.style.display = 'none';
    dashboard.style.display = 'block';
}

// Update Status Badge
function updateStatusBadge(isOnline) {
    if (isOnline) {
        statusBadge.classList.add('online');
        statusBadge.classList.remove('offline');
        statusText.textContent = 'מחובר - מאזין למסמכים';
    } else {
        statusBadge.classList.add('offline');
        statusBadge.classList.remove('online');
        statusText.textContent = 'לא מחובר';
    }
}

// Start Listening to Print Queue
function startListeningToQueue() {
    const q = query(
        collection(db, 'print_queue'),
        orderBy('createdAt', 'desc')
    );

    unsubscribeQueue = onSnapshot(q, (snapshot) => {
        console.log('📊 עדכון תור:', snapshot.size, 'משימות');

        // Update stats
        updateStats(snapshot.docs);

        // Update queue display
        displayQueue(snapshot.docs);

        // Process pending jobs
        snapshot.docChanges().forEach((change) => {
            if (change.type === 'added' && change.doc.data().status === 'pending') {
                processPrintJob(change.doc.id, change.doc.data());
            }
        });
    }, (error) => {
        console.error('✗ שגיאת האזנה:', error);
        updateStatusBadge(false);
    });
}

// Update Statistics
function updateStats(docs) {
    stats = {
        today: 0,
        completed: 0,
        pending: 0,
        failed: 0
    };

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    docs.forEach((doc) => {
        const data = doc.data();
        const createdAt = data.createdAt?.toDate();

        // Count today's jobs
        if (createdAt && createdAt >= today) {
            stats.today++;
        }

        // Count by status
        switch (data.status) {
            case 'completed':
                stats.completed++;
                break;
            case 'pending':
            case 'printing':
                stats.pending++;
                break;
            case 'failed':
                stats.failed++;
                break;
        }
    });

    // Update UI
    todayCount.textContent = stats.today;
    completedCount.textContent = stats.completed;
    pendingCount.textContent = stats.pending;
    failedCount.textContent = stats.failed;
}

// Display Queue
function displayQueue(docs) {
    if (docs.length === 0) {
        queueList.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📭</div>
                <p>אין משימות הדפסה כרגע</p>
                <p class="empty-subtext">המערכת מאזינה למסמכים חדשים...</p>
            </div>
        `;
        return;
    }

    queueList.innerHTML = docs.map((doc) => {
        const data = doc.data();
        return createQueueItemHTML(doc.id, data);
    }).join('');

    // Attach event listeners to print buttons
    docs.forEach((doc) => {
        const printBtn = document.getElementById(`print-${doc.id}`);
        if (printBtn) {
            printBtn.onclick = () => printPDF(doc.data().pdfUrl, doc.data().soldierName);
        }
    });
}

// Create Queue Item HTML
function createQueueItemHTML(jobId, data) {
    const statusText = {
        pending: 'ממתין',
        printing: 'מדפיס...',
        completed: 'הושלם',
        failed: 'נכשל'
    };

    const documentTypeText = {
        combat: 'ציוד קרבי',
        clothing: 'ביגוד',
        rsp: 'אפסנאות'
    };

    const createdAt = data.createdAt?.toDate().toLocaleString('he-IL');
    const printedAt = data.printedAt?.toDate().toLocaleString('he-IL');

    return `
        <div class="queue-item ${data.status}">
            <div class="queue-item-content">
                <div class="queue-item-header">
                    <div class="queue-item-title">${data.soldierName}</div>
                    <div class="queue-item-badge ${data.documentType}">${documentTypeText[data.documentType] || data.documentType}</div>
                </div>
                <div class="queue-item-meta">
                    <span>📋 ${data.soldierPersonalNumber}</span>
                    <span>👤 ${data.createdByName}</span>
                    <span>🕐 ${createdAt}</span>
                    ${data.status === 'completed' && printedAt ? `<span>✅ ${printedAt}</span>` : ''}
                    ${data.status === 'failed' ? `<span style="color: #c53030;">❌ ${data.error || 'שגיאה לא ידועה'}</span>` : ''}
                </div>
            </div>
            <div class="queue-item-actions">
                ${data.status === 'completed' || data.status === 'failed' ?
            `<button id="print-${jobId}" class="btn btn-success">הדפס שוב</button>` :
            `<span style="color: #718096;">${statusText[data.status]}</span>`
        }
            </div>
        </div>
    `;
}

// Process Print Job (Auto-download and open for printing)
async function processPrintJob(jobId, data) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🆕 משימת הדפסה חדשה:', jobId);
    console.log('   חייל:', data.soldierName, `(${data.soldierPersonalNumber})`);
    console.log('   סוג:', data.documentType);

    try {
        // Mark as printing
        await updateDoc(doc(db, 'print_queue', jobId), {
            status: 'printing',
            printStartedAt: Timestamp.now()
        });

        console.log('✓ סומן כ"מדפיס"');

        // Download and print PDF
        await printPDF(data.pdfUrl, data.soldierName);

        // Mark as completed
        await updateDoc(doc(db, 'print_queue', jobId), {
            status: 'completed',
            printedAt: Timestamp.now()
        });

        console.log('✓ הודפס בהצלחה!');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        // Show browser notification
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('מסמך הודפס', {
                body: `${data.soldierName} - ${data.documentType}`,
                icon: '🖨️'
            });
        }

    } catch (error) {
        console.error('✗ שגיאה בהדפסה:', error);

        // Mark as failed
        await updateDoc(doc(db, 'print_queue', jobId), {
            status: 'failed',
            error: error.message,
            failedAt: Timestamp.now()
        });

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    }
}

// Print PDF (Download and open)
async function printPDF(pdfUrl, soldierName) {
    return new Promise((resolve, reject) => {
        try {
            console.log('⬇ פותח PDF:', soldierName);

            // Open PDF in iframe and trigger print
            pdfFrame.onload = () => {
                try {
                    // Wait a moment for PDF to load, then print
                    setTimeout(() => {
                        pdfFrame.contentWindow.print();
                        resolve();
                    }, 1000);
                } catch (error) {
                    console.warn('⚠ לא ניתן להדפיס אוטומטית, פותח בחלון חדש');
                    // Fallback: open in new window
                    window.open(pdfUrl, '_blank');
                    resolve();
                }
            };

            pdfFrame.onerror = () => {
                // Fallback: download directly
                console.warn('⚠ שגיאה בטעינת iframe, מוריד ישירות');
                const link = document.createElement('a');
                link.href = pdfUrl;
                link.download = `${soldierName}.pdf`;
                link.click();
                resolve();
            };

            pdfFrame.src = pdfUrl;

        } catch (error) {
            console.error('✗ שגיאה:', error);
            reject(error);
        }
    });
}

// Clear Completed Jobs
async function clearCompletedJobs() {
    if (!confirm('האם למחוק את כל המשימות שהושלמו?')) {
        return;
    }

    try {
        const q = query(
            collection(db, 'print_queue'),
            where('status', '==', 'completed')
        );

        const snapshot = await getDocs(q);
        const deletePromises = snapshot.docs.map((doc) => deleteDoc(doc.ref));

        await Promise.all(deletePromises);

        console.log(`✓ ${snapshot.size} משימות נמחקו`);
        alert(`${snapshot.size} משימות נמחקו בהצלחה`);
    } catch (error) {
        console.error('✗ שגיאה במחיקה:', error);
        alert('שגיאה במחיקת משימות');
    }
}

// Request notification permission on load
if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
}

console.log('🖨️ מערכת הדפסה מרכזית - מוכנה');
