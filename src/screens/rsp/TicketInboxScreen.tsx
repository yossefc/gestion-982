/**
 * TicketInboxScreen.tsx
 * Boîte de réception pour l'האחראי (responsable assigné)
 *
 * Fonctionnalités :
 *  - Temps réel via subscribeToUserTickets
 *  - Deux onglets : "תקלות פתוחות" / "תקלות שנסגרו"
 *  - Ticket ouvert  : badge vert, bouton "סגור טיפול" avec confirmation
 *  - Ticket fermé   : fond grisé, icône ✓, date/heure de fermeture formatée (he-IL)
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  Alert,
  ActivityIndicator,
  Platform,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { Colors, Spacing, BorderRadius, FontSize, Shadows } from '../../theme/Colors';
import { useAuth } from '../../contexts/AuthContext';
import { ticketService } from '../../services/ticketService';
import { Ticket } from '../../types';
import { AppModal } from '../../components';

// ─── Constantes ──────────────────────────────────────────────────────────────

const TICKET_COLOR = Colors.warning;

// ─── Helpers de formatage ────────────────────────────────────────────────────

/**
 * Formate une date en hébreu / format israélien : "DD/MM/YYYY בשעה HH:MM"
 */
function formatClosedAt(date: Date | null | undefined): string {
  if (!date) return '—';
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '—';

  const day   = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year  = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const mins  = String(d.getMinutes()).padStart(2, '0');

  return `${day}/${month}/${year} בשעה ${hours}:${mins}`;
}

/**
 * Formate la date de création : "DD/MM/YY HH:MM"
 */
function formatCreatedAt(date: Date): string {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '—';
  const day   = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year  = String(d.getFullYear()).slice(2);
  const hours = String(d.getHours()).padStart(2, '0');
  const mins  = String(d.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${mins}`;
}

// ─── Composant TicketCard ────────────────────────────────────────────────────

interface TicketCardProps {
  ticket: Ticket;
  onClose: (ticketId: string) => void;
  closing: boolean;
}

const TicketCard: React.FC<TicketCardProps> = ({ ticket, onClose, closing }) => {
  const isClosed = ticket.status === 'closed';

  return (
    <View style={[card.container, isClosed && card.containerClosed]}>
      {/* En-tête : badge + date */}
      <View style={card.topRow}>
        <Text style={[card.date, isClosed && card.dateClosed]}>
          {formatCreatedAt(ticket.createdAt)}
        </Text>
        {isClosed ? (
          <View style={card.badgeClosed}>
            <Ionicons name="checkmark-circle" size={13} color={Colors.success} />
            <Text style={card.badgeClosedText}>סגור</Text>
          </View>
        ) : (
          <View style={card.badgeOpen}>
            <View style={card.badgeOpenDot} />
            <Text style={card.badgeOpenText}>פתוח</Text>
          </View>
        )}
      </View>

      {/* Infos principales */}
      <View style={card.infoGrid}>
        <InfoRow icon="location-outline" label="מוצב" value={ticket.mozavName} muted={isClosed} />
        <InfoRow icon="construct-outline" label="סוג תקלה" value={ticket.issueTypeName} muted={isClosed} />
        <InfoRow icon="person-outline" label="מדווח" value={ticket.reporterName} muted={isClosed} />
        <InfoRow icon="shield-outline" label="פלוגה" value={ticket.pluga} muted={isClosed} />
      </View>

      {/* Description */}
      {!!ticket.description && (
        <View style={[card.descBox, isClosed && card.descBoxClosed]}>
          <Text style={[card.descText, isClosed && card.descTextClosed]}>{ticket.description}</Text>
        </View>
      )}

      {/* Photo */}
      {!!ticket.photoUrl && (
        <TouchableOpacity
          style={card.photoBtn}
          onPress={() => ticket.photoUrl && Linking.openURL(ticket.photoUrl)}
          activeOpacity={0.8}
        >
          <Image source={{ uri: ticket.photoUrl }} style={card.photo} resizeMode="cover" />
          <View style={card.photoOverlay}>
            <Ionicons name="expand-outline" size={18} color={Colors.textWhite} />
            <Text style={card.photoOverlayText}>צפה בתמונה</Text>
          </View>
        </TouchableOpacity>
      )}

      {/* Séparateur */}
      <View style={card.divider} />

      {/* Pied : action ou date de clôture */}
      {isClosed ? (
        <View style={card.closedFooter}>
          <Text style={card.closedAtText}>{formatClosedAt(ticket.closedAt)}</Text>
          <View style={card.closedFooterLabel}>
            <Ionicons name="checkmark-done-circle" size={16} color={Colors.success} />
            <Text style={card.closedFooterLabelText}>נסגר בתאריך:</Text>
          </View>
        </View>
      ) : (
        <TouchableOpacity
          style={[card.closeBtn, closing && card.closeBtnDisabled]}
          onPress={() => onClose(ticket.id)}
          disabled={closing}
          activeOpacity={0.8}
        >
          {closing ? (
            <ActivityIndicator size="small" color={Colors.textWhite} />
          ) : (
            <>
              <Ionicons name="checkmark-circle-outline" size={18} color={Colors.textWhite} />
              <Text style={card.closeBtnText}>סגור טיפול / תקלה</Text>
            </>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
};

const InfoRow: React.FC<{ icon: string; label: string; value: string; muted?: boolean }> = ({
  icon, label, value, muted
}) => (
  <View style={card.infoRow}>
    <Text style={[card.infoValue, muted && card.infoValueMuted]}>{value || '—'}</Text>
    <Text style={card.infoLabel}>{label}</Text>
    <Ionicons name={icon as any} size={14} color={muted ? Colors.textLight : Colors.textSecondary} />
  </View>
);

const card = StyleSheet.create({
  container: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: Colors.warning,
    ...Shadows.small,
  },
  containerClosed: {
    backgroundColor: '#F9FAFB',
    borderLeftColor: Colors.success,
    opacity: 0.85,
  },

  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md },
  date: { fontSize: FontSize.sm, color: Colors.textSecondary },
  dateClosed: { color: Colors.textLight },

  // Badge ouvert
  badgeOpen: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.warningLight, borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm, paddingVertical: 3,
  },
  badgeOpenDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.warning },
  badgeOpenText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.warningDark },

  // Badge fermé
  badgeClosed: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.successLight, borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm, paddingVertical: 3,
  },
  badgeClosedText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.successDark },

  // Grille d'infos
  infoGrid: { gap: Spacing.xs, marginBottom: Spacing.sm },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, justifyContent: 'flex-end' },
  infoLabel: { fontSize: FontSize.sm, color: Colors.textSecondary, minWidth: 60, textAlign: 'right' },
  infoValue: { fontSize: FontSize.sm, color: Colors.text, fontWeight: '500', flex: 1, textAlign: 'right' },
  infoValueMuted: { color: Colors.textSecondary },

  // Description
  descBox: {
    backgroundColor: Colors.backgroundInput, borderRadius: BorderRadius.sm,
    padding: Spacing.sm, marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.borderLight,
  },
  descBoxClosed: { backgroundColor: '#EFEFEF' },
  descText: { fontSize: FontSize.sm, color: Colors.text, textAlign: 'right', lineHeight: 20 },
  descTextClosed: { color: Colors.textSecondary },

  // Photo
  photoBtn: { position: 'relative', marginBottom: Spacing.sm, borderRadius: BorderRadius.md, overflow: 'hidden' },
  photo: { width: '100%', height: 160 },
  photoOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: Spacing.sm, gap: Spacing.sm,
  },
  photoOverlayText: { color: Colors.textWhite, fontSize: FontSize.sm, fontWeight: '600' },

  divider: { height: 1, backgroundColor: Colors.borderLight, marginVertical: Spacing.sm },

  // Bouton fermer
  closeBtn: {
    backgroundColor: Colors.success, borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
  },
  closeBtnDisabled: { backgroundColor: Colors.disabled },
  closeBtnText: { fontSize: FontSize.base, fontWeight: '700', color: Colors.textWhite },

  // Footer ticket fermé
  closedFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: Spacing.sm },
  closedFooterLabel: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  closedFooterLabelText: { fontSize: FontSize.sm, color: Colors.success, fontWeight: '600' },
  closedAtText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '500' },
});

// ─── Écran Principal ─────────────────────────────────────────────────────────

type Tab = 'open' | 'closed';

const TicketInboxScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('open');
  const [closingId, setClosingId] = useState<string | null>(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType]       = useState<'success' | 'error'>('success');
  const [modalMsg, setModalMsg]         = useState('');

  // ─── Abonnement temps réel ─────────────────────────────────────────────

  useEffect(() => {
    if (!user) return;
    setLoading(true);

    const unsubscribe = ticketService.subscribeToUserTickets(user.id, (data) => {
      setTickets(data);
      setLoading(false);
    });

    return unsubscribe;
  }, [user]);

  // ─── Filtrage par onglet ───────────────────────────────────────────────

  const openTickets   = tickets.filter(t => t.status === 'open');
  const closedTickets = tickets.filter(t => t.status === 'closed');
  const displayed     = activeTab === 'open' ? openTickets : closedTickets;

  // ─── Fermeture d'un ticket ─────────────────────────────────────────────

  const handleCloseTicket = useCallback((ticketId: string) => {
    Alert.alert(
      'סגירת תקלה',
      'האם אתה בטוח שברצונך לסגור את התקלה?',
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'סגור תקלה',
          style: 'default',
          onPress: async () => {
            setClosingId(ticketId);
            try {
              await ticketService.closeTicket(ticketId);
              // Le snapshot temps réel met à jour automatiquement la liste
            } catch (e) {
              console.error('[TicketInbox] closeTicket error:', e);
              setModalType('error');
              setModalMsg('שגיאה בסגירת התקלה. אנא נסה שנית.');
              setModalVisible(true);
            } finally {
              setClosingId(null);
            }
          },
        },
      ]
    );
  }, []);

  // ─── Rendu ────────────────────────────────────────────────────────────

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons
        name={activeTab === 'open' ? 'checkmark-done-circle-outline' : 'archive-outline'}
        size={56}
        color={Colors.textLight}
      />
      <Text style={styles.emptyTitle}>
        {activeTab === 'open' ? 'אין תקלות פתוחות' : 'אין תקלות שנסגרו'}
      </Text>
      <Text style={styles.emptySubtitle}>
        {activeTab === 'open' ? 'כל התקלות שלך טופלו' : 'לא נמצאו תקלות סגורות'}
      </Text>
    </View>
  );

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-forward" size={22} color={Colors.textWhite} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>תיבת בקשות / תקלות</Text>
          <Text style={styles.headerSubtitle}>
            {openTickets.length > 0 ? `${openTickets.length} תקלות פתוחות` : 'אין תקלות פתוחות'}
          </Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Onglets */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'closed' && styles.tabActive]}
          onPress={() => setActiveTab('closed')}
        >
          {closedTickets.length > 0 && (
            <View style={[styles.tabBadge, styles.tabBadgeClosed]}>
              <Text style={styles.tabBadgeText}>{closedTickets.length}</Text>
            </View>
          )}
          <Ionicons
            name="checkmark-done-circle-outline"
            size={16}
            color={activeTab === 'closed' ? Colors.success : Colors.textSecondary}
          />
          <Text style={[styles.tabText, activeTab === 'closed' && styles.tabTextActiveClosed]}>
            תקלות שנסגרו
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'open' && styles.tabActive]}
          onPress={() => setActiveTab('open')}
        >
          {openTickets.length > 0 && (
            <View style={[styles.tabBadge, styles.tabBadgeOpen]}>
              <Text style={styles.tabBadgeText}>{openTickets.length}</Text>
            </View>
          )}
          <Ionicons
            name="alert-circle-outline"
            size={16}
            color={activeTab === 'open' ? Colors.warning : Colors.textSecondary}
          />
          <Text style={[styles.tabText, activeTab === 'open' && styles.tabTextActiveOpen]}>
            תקלות פתוחות
          </Text>
        </TouchableOpacity>
      </View>

      {/* Corps */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={TICKET_COLOR} />
          <Text style={styles.loadingText}>טוען תקלות...</Text>
        </View>
      ) : (
        <FlatList
          data={displayed}
          keyExtractor={t => t.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={renderEmpty}
          renderItem={({ item }) => (
            <TicketCard
              ticket={item}
              onClose={handleCloseTicket}
              closing={closingId === item.id}
            />
          )}
        />
      )}

      <AppModal
        visible={modalVisible}
        type={modalType}
        message={modalMsg}
        buttons={[{ text: 'אישור', style: 'primary', onPress: () => setModalVisible(false) }]}
        onClose={() => setModalVisible(false)}
      />
    </View>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },

  header: {
    backgroundColor: TICKET_COLOR,
    paddingTop: Platform.OS === 'ios' ? 56 : 44,
    paddingBottom: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    ...Shadows.medium,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.textWhite },
  headerSubtitle: { fontSize: FontSize.sm, color: 'rgba(255,255,255,0.85)', marginTop: 2 },

  // Onglets
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.backgroundCard,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    ...Shadows.xs,
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: Spacing.md, gap: Spacing.sm, position: 'relative',
  },
  tabActive: {
    borderBottomWidth: 3,
    borderBottomColor: TICKET_COLOR,
  },
  tabText: { fontSize: FontSize.md, fontWeight: '600', color: Colors.textSecondary },
  tabTextActiveOpen: { color: Colors.warningDark },
  tabTextActiveClosed: { color: Colors.successDark },

  tabBadge: {
    position: 'absolute', top: 6, right: 16,
    minWidth: 18, height: 18, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
  },
  tabBadgeOpen: { backgroundColor: Colors.warning },
  tabBadgeClosed: { backgroundColor: Colors.success },
  tabBadgeText: { fontSize: 10, fontWeight: '800', color: Colors.textWhite },

  // Loading
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
  loadingText: { color: Colors.textSecondary, fontSize: FontSize.md },

  // Liste
  listContent: { padding: Spacing.lg, paddingBottom: Spacing.xxxl },

  // Empty state
  emptyContainer: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingTop: Spacing.xxxl * 2, gap: Spacing.md,
  },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textSecondary, textAlign: 'center' },
  emptySubtitle: { fontSize: FontSize.md, color: Colors.textLight, textAlign: 'center' },
});

export default TicketInboxScreen;
