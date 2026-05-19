/**
 * CertificateViewerScreen
 *
 * Supports:
 *   • Images — rendered inline with react-native Image (pan + zoom via ScrollView)
 *   • PDFs   — opened externally via Linking (browser / Google Drive / built-in viewer)
 *
 * Navigation param: { fileUrl: string; fileName?: string }
 *
 * No native PDF or blob packages needed.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StatusBar,
  ScrollView,
  Image,
  Dimensions,
  Linking,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {useTheme} from '../theme';

const {width: SCREEN_W, height: SCREEN_H} = Dimensions.get('window');

function isPdf(url: string): boolean {
  if (!url) return false;
  const lower = url.toLowerCase().split('?')[0];
  return lower.endsWith('.pdf') || lower.includes('/pdf');
}

function isImage(url: string): boolean {
  if (!url) return false;
  const lower = url.toLowerCase().split('?')[0];
  return (
    lower.endsWith('.jpg') ||
    lower.endsWith('.jpeg') ||
    lower.endsWith('.png') ||
    lower.endsWith('.gif') ||
    lower.endsWith('.webp') ||
    lower.endsWith('.bmp')
  );
}

const openInBrowser = (url: string) => {
  Linking.canOpenURL(url).then(supported => {
    if (supported) {
      Linking.openURL(url);
    } else {
      Alert.alert('Error', 'Cannot open this link on your device.');
    }
  });
};

export default function CertificateViewerScreen({route, navigation}: any) {
  const {colors} = useTheme();
  const {fileUrl, fileName = 'certificate'} = route.params ?? {};

  const type = isPdf(fileUrl) ? 'pdf' : isImage(fileUrl) ? 'image' : 'unknown';

  return (
    <SafeAreaView style={[styles.safe, {backgroundColor: colors.bg}]} edges={['top']}>
      <StatusBar barStyle={colors.statusBar} backgroundColor={colors.bg} />

      {/* Header */}
      <View
        style={[
          styles.header,
          {backgroundColor: colors.card, borderBottomColor: colors.border},
        ]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, {color: colors.text}]} numberOfLines={1}>
            {fileName || 'Certificate'}
          </Text>
        </View>

        {/* Open externally — works for both PDFs and images */}
        <TouchableOpacity
          style={[styles.actionBtn, {backgroundColor: colors.primaryMuted}]}
          onPress={() => openInBrowser(fileUrl)}>
          <MaterialCommunityIcons name="open-in-new" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Body */}
      {!fileUrl ? (
        <View style={styles.center}>
          <MaterialCommunityIcons
            name="file-alert-outline"
            size={60}
            color={colors.textMuted}
          />
          <Text style={[styles.errText, {color: colors.textMuted}]}>
            No file URL provided.
          </Text>
        </View>
      ) : type === 'image' ? (
        /* ── Image viewer ── */
        <ScrollView
          style={{flex: 1, backgroundColor: '#000'}}
          contentContainerStyle={styles.imageScrollContent}
          maximumZoomScale={4}
          minimumZoomScale={1}
          bouncesZoom
          centerContent>
          <Image
            source={{uri: fileUrl}}
            style={styles.fullImage}
            resizeMode="contain"
            onError={() => Alert.alert('Error', 'Could not load image.')}
          />
        </ScrollView>
      ) : type === 'pdf' ? (
        /* ── PDF — open externally (Google Drive / Chrome / built-in viewer) ── */
        <View style={[styles.center, {backgroundColor: colors.bg}]}>
          <MaterialCommunityIcons
            name="file-pdf-box"
            size={80}
            color="#ef4444"
          />
          <Text style={[styles.pdfName, {color: colors.text}]} numberOfLines={2}>
            {fileName}
          </Text>
          <Text style={[styles.pdfHint, {color: colors.textMuted}]}>
            PDF files open in your browser or Google Drive.
          </Text>

          <TouchableOpacity
            style={[styles.openBtn, {backgroundColor: colors.primary}]}
            onPress={() => openInBrowser(fileUrl)}>
            <MaterialCommunityIcons name="open-in-new" size={20} color="#fff" />
            <Text style={styles.openBtnText}>Open PDF</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.outlineBtn, {borderColor: colors.primary}]}
            onPress={() => {
              // Google Drive viewer fallback for direct URLs
              const driveUrl = `https://drive.google.com/viewerng/viewer?embedded=true&url=${encodeURIComponent(fileUrl)}`;
              openInBrowser(driveUrl);
            }}>
            <MaterialCommunityIcons name="google-drive" size={18} color={colors.primary} />
            <Text style={[styles.outlineBtnText, {color: colors.primary}]}>
              Open with Google Drive
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        /* ── Unknown type — try as image, fallback to browser ── */
        <ScrollView
          style={{flex: 1, backgroundColor: '#000'}}
          contentContainerStyle={styles.imageScrollContent}
          maximumZoomScale={4}
          minimumZoomScale={1}
          bouncesZoom
          centerContent>
          <Image
            source={{uri: fileUrl}}
            style={styles.fullImage}
            resizeMode="contain"
            onError={() =>
              Alert.alert(
                'Unsupported format',
                'Cannot preview this file type.',
                [{text: 'Open in Browser', onPress: () => openInBrowser(fileUrl)}, {text: 'OK'}],
              )
            }
          />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 10,
  },
  backBtn: {padding: 6},
  headerCenter: {flex: 1},
  headerTitle: {fontSize: 16, fontWeight: '700'},
  actionBtn: {padding: 8, borderRadius: 10},
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    padding: 32,
  },
  pdfName: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 4,
  },
  pdfHint: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
  openBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 12,
    minWidth: 180,
    justifyContent: 'center',
  },
  openBtnText: {color: '#fff', fontSize: 15, fontWeight: '700'},
  outlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    minWidth: 180,
    justifyContent: 'center',
  },
  outlineBtnText: {fontSize: 14, fontWeight: '600'},
  errText: {fontSize: 15, fontWeight: '600', textAlign: 'center'},
  imageScrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: SCREEN_H - 120,
  },
  fullImage: {
    width: SCREEN_W,
    height: SCREEN_H - 120,
  },
});
