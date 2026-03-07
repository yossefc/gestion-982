/**
 * TicketInboxScreen.tsx
 * Liste unifiée de tickets — ouvert en haut, fermé en bas.
 * • S'abonne aux tickets assignés ET soumis par l'utilisateur (fusion sans doublon)
 * • Bouton "סגור" visible uniquement si assignedUserId === user.id
 * • Tickets fermés : affiche date + heure de clôture
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(date: Date | null | undefined): string {
  if (!date) return '—';
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '—';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(2);
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yy} ${hh}:${mi}`;
}

// ─── TicketCard ───────────────────────────────────────────────────────────────

interface TicketCardProps {
  ticket: Ticket;
  currentUserId: string;
  onClose: (id: string) => void;
  closing: boolean;
}

const TicketCard: React.FC<TicketCardProps> = ({ ticket, currentUserId, onClose, closing }) => {
  const isClosed  = ticket.status === 'closed';
  const canClose  = !isClosed && ticket.assignedUserId === currentUserId;
  const isReporter = ticket.reporterUserId === currentUserId;

  return (
    <View style={[s.card, isClosed ? s.cardClosed : s.cardOpen]}>
      {/* En-tête */}
      <View style={s.cardTop}>
        <Text style={[s.cardDate, isClosed && s.dimText]}>{formatDate(ticket.createdAt)}</Text>
        {isClosed ? (
          <View style={s.badgeClosed}>
            <Ionicons name="checkmark-circle" size={12} color={Colors.success} />
            <Text style={s.badgeClosedTxt}>סגור</Text>
          </View>
        ) : (
          <View style={s.badgeOpen}>
            <View style={s.badgeDot} />
            <Text style={s.badgeOpenTxt}>פתוח</Text>
          </View>
        )}
      </View>

      {/* Grille d'infos */}
      <View style={s.grid}>
        <InfoRow icon="location-outline"  label="מוצב"     value={ticket.mozavName}    dim={isClosed} />
        <InfoRow icon="construct-outline" label="סוג תקלה" value={ticket.issueTypeName} dim={isClosed} />
        <InfoRow icon="person-outline"    label="מדווח"    value={ticket.reporterName}  dim={isClosed} />
        <InfoRow icon="shield-outline"    label="פלוגה"    value={ticket.pluga}         dim={isClosed} />
      </View>

      {/* Étiquette "הדיווח שלי" si l'utilisateur est le reporter */}
      {isReporter && (
        <View style={s.reporterBadge}>
          <Ionicons name="send-outline" size={12} color="#0891B2" />
          <Text style={s.reporterBadgeTxt}>הדיווח שלי</Text>
        </View>
      )}

      {/* Description */}
      {!!ticket.description && (
        <View style={[s.descBox, isClosed && s.descBoxClosed]}>
          <Text style={[s.descTxt, isClosed && s.dimText]}>{ticket.description}</Text>
        </View>
      )}

      {/* Photo */}
      {!!ticket.photoUrl && (
        <TouchableOpacity
          style={s.photoBtn}
          onPress={() => ticket.photoUrl && Linking.openURL(ticket.photoUrl)}
          activeOpacity={0.8}
        >
          <Image source={{ uri: ticket.photoUrl }} style={s.photo} resizeMode="cover" />
          <View style={s.photoOverlay}>
            <Ionicons name="expand-outline" size={18} color="#FFF" />
            <Text style={s.photoOverlayTxt}>צפה בתמונה</Text>
          </View>
        </TouchableOpacity>
      )}

      <View style={s.divider} />

      {/* Pied */}
      {isClosed ? (
        <View style={s.closedFooter}>
          <Text style={s.closedAt}>{formatDate(ticket.closedAt)}</Text>
          <View style={s.closedFooterLabel}>
            <Ionicons name="checkmark-done-circle" size={15} color={Colors.success} />
            <Text style={s.closedFooterTxt}>נסגר בתאריך:</Text>
          </View>
        </View>
      ) : canClose ? (
        <TouchableOpacity
          style={[s.closeBtn, closing && s.closeBtnDisabled]}
          onPress={() => onClose(ticket.id)}
          disabled={closing}
          activeOpacity={0.8}
        >
          {closing
            ? <ActivityIndicator size="small" color="#FFF" />
            : <>
                <Ionicons name="checkmark-circle-outline" size={18} color="#FFF" />
                <Text style={s.closeBtnTxt}>סגור טיפול / תקלה</Text>
              </>
          }
        </TouchableOpacity>
      ) : (
        <View style={s.pendingBadge}>
          <Ionicons name="time-outline" size={14} color="#0891B2" />
          <Text style={s.pendingBadgeTxt}>בטיפול — ממתין לאחראי</Text>
        </View>
      )}
    </View>
  );
};

const InfoRow: React.FC<{ icon: string; label: string; value: string; dim?: boolean }> = ({
  icon, label, value, dim,
}) => (
  <View style={s.infoRow}>
    <Text style={[s.infoValue, dim && s.dimText]}>{value || '—'}</Text>
    <Text style={s.infoLabel}>{label}</Text>
    <Ionicons name={icon as any} size={13} color={dim ? Colors.textLight : Colors.textSecondary} />
  </View>
);

// ─── Séparateur de section ────────────────────────────────────────────────────

const SectionSeparator: React.FC<{ label: string }> = ({ label }) => (
  <View style={s.sectionSep}>
    <View style={s.sectionLine} />
    <Text style={s.sectionLabel}>{label}</Text>
    <View style={s.sectionLine} />
  </View>
);

// ─── Écran principal ──────────────────────────────────────────────────────────

type ListItem = Ticket | { _separator: true; label: string; _key: string };

const TicketInboxScreen: React.FC = () => {
  const navigation   = useNavigation();
  const { user }     = useAuth();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [closingId, setClosingId] = useState<string | null>(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType]       = useState<'success' | 'error'>('success');
  const [modalMsg, setModalMsg]         = useState('');

  // ─── Abonnements ────────────────────────────────────────────────────────

  useEffect(() => {
    if (!user) return;
    setLoading(true);

    // Map pour fusionner sans doublons
    const map = new Map<string, Ticket>();
    let assignedReady = false;
    let mineReady     = false;

    const publish = () => {
      const all = Array.from(map.values());
      const open   = all.filter(t => t.status === 'open')
                        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      const closed = all.filter(t => t.status === 'closed')
                        .sort((a, b) => {
                          const ta = a.closedAt ? a.closedAt.getTime() : 0;
                          const tb = b.closedAt ? b.closedAt.getTime() : 0;
                          return tb - ta;
                        });
      setTickets([...open, ...closed]);
      if (assignedReady && mineReady) setLoading(false);
    };

    const unsubAssigned = ticketService.subscribeToUserTickets(user.id, (data) => {
      data.forEach(t => map.set(t.id, t));
      assignedReady = true;
      publish();
    });

    const unsubMine = ticketService.subscribeToMyTickets(user.id, (data) => {
      data.forEach(t => map.set(t.id, t));
      mineReady = true;
      publish();
    });

    return () => { unsubAssigned(); unsubMine(); };
  }, [user]);

  // ─── Fermeture ──────────────────────────────────────────────────────────

  const handleClose = useCallback((ticketId: string) => {
    Alert.alert('סגירת תקלה', 'האם אתה בטוח שברצונך לסגור את התקלה?', [
      { text: 'ביטול', style: 'cancel' },
      {
        text: 'סגור תקלה',
        onPress: async () => {
          setClosingId(ticketId);
          try {
            await ticketService.closeTicket(ticketId);
          } catch {
            setModalType('error');
            setModalMsg('שגיאה בסגירת התקלה. אנא נסה שנית.');
            setModalVisible(true);
          } finally {
            setClosingId(null);
          }
        },
      },
    ]);
  }, []);

  // ─── Construction de la liste avec séparateurs ───────────────────────────

  const openTickets   = tickets.filter(t => t.status === 'open');
  const closedTickets = tickets.filter(t => t.status === 'closed');

  const listData: ListItem[] = [
    ...openTickets,
    ...(closedTickets.length > 0
      ? [{ _separator: true as const, label: 'תקלות שנסגרו', _key: '__sep_closed__' }]
      : []),
    ...closedTickets,
  ];

  // ─── Rendu ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={s.root}>
        <Header openCount={0} navigation={navigation} />
        <View style={s.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.warning} />
          <Text style={s.loadingTxt}>טוען תקלות...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={s.root}>
      <Header openCount={openTickets.length} navigation={navigation} />

      {tickets.length === 0 ? (
        <View style={s.emptyContainer}>
          <Ionicons name="checkmark-done-circle-outline" size={56} color={Colors.textLight} />
          <Text style={s.emptyTitle}>אין תקלות</Text>
          <Text style={s.emptySubtitle}>לא נמצאו תקלות פתוחות או סגורות</Text>
        </View>
      ) : (
        <FlatList
          data={listData}
          keyExtractor={item => ('_separator' in item ? item._key : item.id)}
          contentContainerStyle={s.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            if ('_separator' in item) {
              return <SectionSeparator label={item.label} />;
            }
            return (
              <TicketCard
                ticket={item}
                currentUserId={user?.id || ''}
                onClose={handleClose}
                closing={closingId === item.id}
              />
            );
          }}
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

// ─── Header extrait ───────────────────────────────────────────────────────────

const Header: React.FC<{ openCount: number; navigation: any }> = ({ openCount, navigation }) => (
  <View style={s.header}>
    <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
      <Ionicons name="arrow-forward" size={22} color="#FFF" />
    </TouchableOpacity>
    <View style={s.headerCenter}>
      <Text style={s.headerTitle}>תיבת בקשות / תקלות</Text>
      <Text style={s.headerSubtitle}>
        {openCount > 0 ? `${openCount} תקלות פתוחות` : 'אין תקלות פתוחות'}
      </Text>
    </View>
    <View style={{ width: 40 }} />
  </View>
);

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },

  // Header
  header: {
    backgroundColor: Colors.warning,
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
  headerTitle: { fontSize: FontSize.xl, fontWeight: '700', color: '#FFF' },
  headerSubtitle: { fontSize: FontSize.sm, color: 'rgba(255,255,255,0.85)', marginTop: 2 },

  // Loading / empty
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
  loadingTxt: { color: Colors.textSecondary, fontSize: FontSize.md },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textSecondary },
  emptySubtitle: { fontSize: FontSize.md, color: Colors.textLight },

  // Liste
  listContent: { padding: Spacing.lg, paddingBottom: 60 },

  // Séparateur de section
  sectionSep: {
    flexDirection: 'row', alignItems: 'center',
    marginVertical: Spacing.lg, gap: Spacing.sm,
  },
  sectionLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  sectionLabel: {
    fontSize: FontSize.sm, fontWeight: '700',
    color: Colors.textSecondary, paddingHorizontal: Spacing.sm,
  },

  // Card
  card: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderLeftWidth: 4,
    ...Shadows.small,
    backgroundColor: Colors.backgroundCard,
  },
  cardOpen:   { borderLeftColor: Colors.warning },
  cardClosed: { borderLeftColor: Colors.success, backgroundColor: '#F9FAFB', opacity: 0.88 },

  // En-tête de card
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  cardDate: { fontSize: FontSize.sm, color: Colors.textSecondary },

  // Badges statut
  badgeOpen: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.warningLight, borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm, paddingVertical: 3,
  },
  badgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.warning },
  badgeOpenTxt: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.warningDark },

  badgeClosed: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.successLight, borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm, paddingVertical: 3,
  },
  badgeClosedTxt: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.successDark },

  // Grille infos
  grid: { gap: Spacing.xs, marginBottom: Spacing.sm },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, justifyContent: 'flex-end' },
  infoLabel: { fontSize: FontSize.sm, color: Colors.textSecondary, minWidth: 60, textAlign: 'right' },
  infoValue: { fontSize: FontSize.sm, color: Colors.text, fontWeight: '500', flex: 1, textAlign: 'right' },

  // Badge reporter
  reporterBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-end',
    backgroundColor: '#F0F9FF', borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm, paddingVertical: 2, marginBottom: Spacing.sm,
    borderWidth: 1, borderColor: '#BAE6FD',
  },
  reporterBadgeTxt: { fontSize: FontSize.xs, fontWeight: '600', color: '#0891B2' },

  // Description
  descBox: {
    backgroundColor: Colors.backgroundInput, borderRadius: BorderRadius.sm,
    padding: Spacing.sm, marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.borderLight,
  },
  descBoxClosed: { backgroundColor: '#EFEFEF' },
  descTxt: { fontSize: FontSize.sm, color: Colors.text, textAlign: 'right', lineHeight: 20 },

  // Photo
  photoBtn: { position: 'relative', marginBottom: Spacing.sm, borderRadius: BorderRadius.md, overflow: 'hidden' },
  photo: { width: '100%', height: 160 },
  photoOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: Spacing.sm, gap: Spacing.sm,
  },
  photoOverlayTxt: { color: '#FFF', fontSize: FontSize.sm, fontWeight: '600' },

  divider: { height: 1, backgroundColor: Colors.borderLight, marginVertical: Spacing.sm },

  // Bouton fermer
  closeBtn: {
    backgroundColor: Colors.success, borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
  },
  closeBtnDisabled: { backgroundColor: Colors.disabled },
  closeBtnTxt: { fontSize: FontSize.base, fontWeight: '700', color: '#FFF' },

  // Badge en attente
  pendingBadge: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.sm, backgroundColor: '#F0F9FF',
    borderRadius: BorderRadius.md, paddingVertical: Spacing.sm,
    borderWidth: 1, borderColor: '#BAE6FD',
  },
  pendingBadgeTxt: { fontSize: FontSize.sm, fontWeight: '600', color: '#075985' },

  // Footer fermé
  closedFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: Spacing.sm },
  closedFooterLabel: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  closedFooterTxt: { fontSize: FontSize.sm, color: Colors.success, fontWeight: '600' },
  closedAt: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '500' },

  // Texte atténué
  dimText: { color: Colors.textLight },
});

export default TicketInboxScreen;
