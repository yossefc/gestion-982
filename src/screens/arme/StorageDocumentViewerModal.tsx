/**
 * StorageDocumentViewerModal.tsx
 * Full-screen modal that renders the אפסון document in a WebView,
 * so the user can see it before printing/sharing.
 */

import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, FontSize } from '../../theme/Colors';
import { generateStoragePDF, StoragePDFData } from '../../services/pdfService';

interface Props {
  visible: boolean;
  html: string;
  pdfData: StoragePDFData;
  onClose: () => void;
}

const StorageDocumentViewerModal: React.FC<Props> = ({
  visible,
  html,
  pdfData,
  onClose,
}) => {
  const [sharing, setSharing] = useState(false);
  const [webViewLoading, setWebViewLoading] = useState(true);

  const handleShare = async () => {
    setSharing(true);
    try {
      await generateStoragePDF(pdfData);
    } catch (err) {
      console.error('[StorageDocumentViewer] Share error:', err);
    } finally {
      setSharing(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerBtn} onPress={onClose}>
            <Ionicons name="close" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>אישור על אפסון ארמו"י</Text>
          <TouchableOpacity
            style={[styles.headerBtn, styles.shareBtn]}
            onPress={handleShare}
            disabled={sharing}
          >
            {sharing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons
                name={Platform.OS === 'ios' ? 'print-outline' : 'share-social-outline'}
                size={22}
                color="#fff"
              />
            )}
          </TouchableOpacity>
        </View>

        {/* WebView document preview */}
        <View style={styles.webViewContainer}>
          {webViewLoading && (
            <View style={styles.webViewLoader}>
              <ActivityIndicator size="large" color={Colors.arme} />
              <Text style={styles.loadingText}>טוען מסמך...</Text>
            </View>
          )}
          <WebView
            source={{ html }}
            style={styles.webView}
            originWhitelist={['*']}
            scalesPageToFit
            onLoadEnd={() => setWebViewLoading(false)}
            showsVerticalScrollIndicator={false}
          />
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <TouchableOpacity style={styles.closeFooterBtn} onPress={onClose}>
            <Text style={styles.closeFooterText}>סגור</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.shareFooterBtn, sharing && styles.btnDisabled]}
            onPress={handleShare}
            disabled={sharing}
          >
            {sharing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons
                  name={Platform.OS === 'ios' ? 'print-outline' : 'share-social-outline'}
                  size={20}
                  color="#fff"
                />
                <Text style={styles.shareFooterText}>
                  {Platform.OS === 'ios' ? 'הדפס / שתף' : 'שתף PDF'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    backgroundColor: Colors.arme,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 12,
    paddingHorizontal: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareBtn: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  headerTitle: {
    color: '#fff',
    fontSize: FontSize.base,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  webViewContainer: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#f0f0f0',
  },
  webViewLoader: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f0f0',
    zIndex: 10,
  },
  loadingText: {
    marginTop: Spacing.sm,
    fontSize: FontSize.sm,
    color: '#64748B',
  },
  webView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  footer: {
    flexDirection: 'row',
    gap: Spacing.md,
    padding: Spacing.lg,
    paddingBottom: Platform.OS === 'ios' ? 32 : Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#fff',
  },
  closeFooterBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeFooterText: {
    fontSize: FontSize.base,
    fontWeight: '600',
    color: '#64748B',
  },
  shareFooterBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: 12,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.arme,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  shareFooterText: {
    fontSize: FontSize.base,
    fontWeight: '700',
    color: '#fff',
  },
});

export default StorageDocumentViewerModal;
