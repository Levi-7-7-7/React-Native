import React, {useState, useEffect, useRef, useCallback} from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Platform, Modal,
  FlatList, StatusBar, PermissionsAndroid,
  Animated,
} from 'react-native';
import {ScrollView} from 'react-native-gesture-handler';
import {SafeAreaView} from 'react-native-safe-area-context';
import DateTimePicker, {
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import {launchImageLibrary, launchCamera} from 'react-native-image-picker';
import {pick, types} from '@react-native-documents/picker';
import ImageResizer from 'react-native-image-resizer';
import RNFS from 'react-native-fs';
import axiosInstance from '../api/axiosInstance';
import {useTheme, Colors} from '../theme';
import {useFocusEffect} from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import LottieView from 'lottie-react-native';
import {tabEmitter} from '../utils/tabEvents';

const MAX_FILE_SIZE_MB = 5;
const RESIZE_WIDTH  = 1200;
const RESIZE_HEIGHT = 1600;
const RESIZE_QUALITY = 100;

const clearTempCache = async () => {
  try {
    const tempDirs = [RNFS.CachesDirectoryPath, RNFS.TemporaryDirectoryPath];
    for (const dir of tempDirs) {
      const exists = await RNFS.exists(dir);
      if (!exists) continue;
      const files = await RNFS.readDir(dir);
      for (const file of files) {
        try {
          if (
            file.name.endsWith('.jpg') || file.name.endsWith('.jpeg') ||
            file.name.endsWith('.png') || file.name.endsWith('.pdf') ||
            file.name.endsWith('.webp') || file.name.endsWith('.heic')
          ) {
            await RNFS.unlink(file.path);
          }
        } catch {}
      }
    }
  } catch (err) {
    console.log('Cache cleanup error:', err);
  }
};

function buildSearchIndex(categories: any[]) {
  const items: any[] = [];
  categories.forEach(cat => {
    (cat.subcategories || []).forEach((sub: any) => {
      items.push({
        categoryId: cat._id,
        categoryName: cat.name,
        subcategoryName: sub.name,
        sub,
      });
    });
  });
  return items;
}

function DropdownModal({
  visible, title, items, selectedValue, onSelect, onClose, colors,
}: {
  visible: boolean;
  title: string;
  items: {label: string; value: string}[];
  selectedValue: string;
  onSelect: (v: string) => void;
  onClose: () => void;
  colors: Colors;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity
        style={[dm.overlay, {backgroundColor: colors.overlay}]}
        activeOpacity={1}
        onPress={onClose}
      />
      <View style={[dm.sheet, {backgroundColor: colors.sheetBg}]}>
        <Text style={[dm.sheetTitle, {color: colors.primary, borderBottomColor: colors.borderLight}]}>
          {title}
        </Text>
        <FlatList
          data={items}
          keyExtractor={i => i.value}
          renderItem={({item}) => (
            <TouchableOpacity
              style={[
                dm.item,
                {borderBottomColor: colors.borderLight},
                item.value === selectedValue && {backgroundColor: colors.primaryMuted},
              ]}
              onPress={() => { onSelect(item.value); onClose(); }}>
              <Text
                style={[
                  dm.itemText,
                  {color: item.value === selectedValue ? colors.primary : colors.textSub},
                  item.value === selectedValue && {fontWeight: '700'},
                ]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          )}
        />
        <TouchableOpacity
          style={[dm.cancelBtn, {backgroundColor: colors.border}]}
          onPress={onClose}>
          <Text style={[dm.cancelText, {color: colors.textSub}]}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

function DatePickerField({
  label, value, onPress, colors,
}: {
  label: string;
  value: Date | null;
  onPress: () => void;
  colors: Colors;
}) {
  const formatted = value
    ? value.toLocaleDateString('en-IN', {day: '2-digit', month: 'short', year: 'numeric'})
    : null;
  return (
    <TouchableOpacity
      style={[dpf.btn, {backgroundColor: colors.inputBg, borderColor: value ? colors.primary : colors.border}]}
      onPress={onPress}
      activeOpacity={0.7}>
      <MaterialCommunityIcons
        name="calendar-month-outline"
        size={20}
        color={value ? colors.primary : colors.textMuted}
        style={dpf.icon}
      />
      <Text style={[dpf.text, {color: formatted ? colors.text : colors.textMuted}]}>
        {formatted || label}
      </Text>
      {value && (
        <MaterialCommunityIcons name="check-circle" size={18} color={colors.primary} style={dpf.chevron} />
      )}
    </TouchableOpacity>
  );
}

// ← No navigation prop
export default function UploadCertificateScreen() {
  const {colors} = useTheme();

  const [categories, setCategories] = useState<any[]>([]);
  const [categoryId, setCategoryId] = useState('');
  const [subcategories, setSubcategories] = useState<any[]>([]);
  const [subcategoryName, setSubcategoryName] = useState('');
  const [levelSelected, setLevelSelected] = useState('');
  const [prizeType, setPrizeType] = useState('');
  const [uploadedFile, setUploadedFile] = useState<any>(null);
  const [eligiblePoints, setEligiblePoints] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [dateFrom, setDateFrom] = useState<Date | null>(null);
  const [dateTo, setDateTo] = useState<Date | null>(null);
  const [isDurationEvent, setIsDurationEvent] = useState(false);
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);
  const [eventName, setEventName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isOthers, setIsOthers] = useState(false);
  const [othersDescription, setOthersDescription] = useState('');
  const skipSubcategoryReset = useRef(false);
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [subModalOpen, setSubModalOpen] = useState(false);
  const [levelModalOpen, setLevelModalOpen] = useState(false);
  const [prizeModalOpen, setPrizeModalOpen] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  const resetForm = () => {
    setCategoryId('');
    setSubcategoryName('');
    setSubcategories([]);
    setLevelSelected('');
    setPrizeType('');
    setUploadedFile(null);
    setEligiblePoints(null);
    setDateFrom(null);
    setDateTo(null);
    setIsDurationEvent(false);
    setEventName('');
    setSearchQuery('');
    setIsOthers(false);
    setOthersDescription('');
    setSubmitted(false);
    fadeAnim.setValue(0);
    scaleAnim.setValue(0.8);
  };

  useEffect(() => {
    axiosInstance
      .get('/categories')
      .then(res => setCategories(res.data.categories || []))
      .catch(() => Alert.alert('Error', 'Failed to fetch categories'));
  }, []);

  useEffect(() => {
    if (!categoryId) {
      setSubcategories([]);
      setSubcategoryName('');
      setLevelSelected('');
      setPrizeType('');
      setEligiblePoints(null);
      return;
    }
    const cat = categories.find(c => c._id === categoryId);
    setSubcategories(cat?.subcategories || []);
    if (skipSubcategoryReset.current) {
      skipSubcategoryReset.current = false;
    } else {
      setSubcategoryName('');
      setLevelSelected('');
      setPrizeType('');
      setEligiblePoints(null);
    }
  }, [categoryId, categories]);

  useEffect(() => {
    if (!categoryId || !subcategoryName) { setEligiblePoints(null); return; }
    const cat = categories.find(c => c._id === categoryId);
    const sub = cat?.subcategories?.find((s: any) => s.name === subcategoryName);
    if (!sub) { return setEligiblePoints(null); }
    if (sub.fixedPoints != null) {
      setEligiblePoints(sub.fixedPoints);
    } else if (sub.levels?.length) {
      if (!levelSelected || !prizeType) { return setEligiblePoints(null); }
      const levelObj = sub.levels.find((l: any) => l.name === levelSelected);
      const prizeObj = levelObj?.prizes?.find((p: any) => p.type === prizeType);
      setEligiblePoints(prizeObj?.points ?? null);
    } else {
      setEligiblePoints(null);
    }
  }, [categoryId, subcategoryName, levelSelected, prizeType, categories]);

  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); setShowDropdown(false); return; }
    const idx = buildSearchIndex(categories);
    const q = searchQuery.toLowerCase();
    const results = idx
      .filter(item =>
        item.subcategoryName.toLowerCase().includes(q) ||
        item.categoryName.toLowerCase().includes(q),
      )
      .slice(0, 10);
    setSearchResults(results);
    setShowDropdown(true);
  }, [searchQuery, categories]);

  useEffect(() => {
    return () => {
      if (uploadedFile?._isTemp && uploadedFile?.uri) {
        RNFS.exists(uploadedFile.uri).then(exists => {
          if (exists) RNFS.unlink(uploadedFile.uri).catch(() => {});
        });
      }
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      clearTempCache();
    }, []),
  );

  // ← Fixed: no navigation.reset, uses tabEmitter instead
  useEffect(() => {
    if (submitted) {
      Animated.parallel([
        Animated.timing(fadeAnim, {toValue: 1, duration: 500, useNativeDriver: true}),
        Animated.spring(scaleAnim, {toValue: 1, friction: 6, tension: 80, useNativeDriver: true}),
      ]).start();

      const timer = setTimeout(() => {
        resetForm();
        tabEmitter.emit('switchTab', 0); // ← go to Dashboard
      }, 2600);

      return () => clearTimeout(timer);
    }
  }, [submitted]);

  const selectSearchResult = (item: any) => {
    const cat = categories.find(c => c._id === item.categoryId);
    skipSubcategoryReset.current = true;
    setCategoryId(item.categoryId);
    setSubcategories(cat?.subcategories || []);
    setSubcategoryName(item.subcategoryName);
    setLevelSelected('');
    setPrizeType('');
    setSearchQuery('');
    setShowDropdown(false);
    setIsOthers(false);
    setOthersDescription('');
  };

  const activateOthers = () => {
    setCategoryId('');
    setSubcategoryName('');
    setSubcategories([]);
    setLevelSelected('');
    setPrizeType('');
    setEligiblePoints(null);
    setSearchQuery('');
    setShowDropdown(false);
    setIsOthers(true);
    setOthersDescription('');
  };

  const requestMediaPermission = async (): Promise<boolean> => {
    if (Platform.OS !== 'android') return true;
    const permission =
      Platform.Version >= 33
        ? PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES
        : PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE;
    const already = await PermissionsAndroid.check(permission);
    if (already) return true;
    const result = await PermissionsAndroid.request(permission, {
      title: 'Photos & Media Permission',
      message: 'This app needs access to your photos and media to attach certificate images.',
      buttonPositive: 'Allow',
      buttonNegative: 'Deny',
      buttonNeutral: 'Ask Later',
    });
    if (result === PermissionsAndroid.RESULTS.GRANTED) return true;
    if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
      Alert.alert('Permission Blocked', 'Go to Settings → Apps → ActivityPoints → Permissions and enable "Photos & Media".');
    } else {
      Alert.alert('Permission Required', 'Photos & Media access is needed to pick a certificate image.');
    }
    return false;
  };

  const requestCameraPermission = async (): Promise<boolean> => {
    if (Platform.OS !== 'android') return true;
    const already = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CAMERA);
    if (already) return true;
    const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA, {
      title: 'Camera Permission',
      message: 'This app needs camera access to photograph your certificate.',
      buttonPositive: 'Allow',
      buttonNegative: 'Deny',
      buttonNeutral: 'Ask Later',
    });
    if (result === PermissionsAndroid.RESULTS.GRANTED) return true;
    if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
      Alert.alert('Permission Blocked', 'Go to Settings → Apps → ActivityPoints → Permissions and enable "Camera".');
    } else {
      Alert.alert('Permission Required', 'Camera access is required to take a photo of your certificate.');
    }
    return false;
  };

  const resizeImageIfNeeded = async (asset: any): Promise<{file: any; isTemp: boolean}> => {
    const sizeInMB = (asset.fileSize || 0) / 1024 / 1024;
    if (sizeInMB <= MAX_FILE_SIZE_MB) return {file: asset, isTemp: false};
    Alert.alert('Optimizing Image', 'Large image detected. Compressing for faster upload...');
    try {
      const resized = await ImageResizer.createResizedImage(
        asset.uri, 900, 1200, 'JPEG', 60, 0, undefined, false,
        {mode: 'contain', onlyScaleDown: true},
      );
      return {
        file: {uri: resized.uri, type: 'image/jpeg', fileName: resized.name, fileSize: resized.size},
        isTemp: true,
      };
    } catch {
      return {file: asset, isTemp: false};
    }
  };

  const validateAndSet = (asset: any, isTemp = false) => {
    if ((asset.fileSize || 0) > MAX_FILE_SIZE_MB * 1024 * 1024) {
      Alert.alert('File too large', `File must be under ${MAX_FILE_SIZE_MB} MB.`);
      if (isTemp && asset.uri) RNFS.unlink(asset.uri).catch(() => {});
      return;
    }
    const mime: string = (asset.type || '').toLowerCase();
    const name: string = (asset.fileName || '').toLowerCase();
    const isImage = mime.startsWith('image/');
    const isPdf = mime === 'application/pdf' || name.endsWith('.pdf');
    if (!isImage && !isPdf) {
      Alert.alert('Unsupported file type', 'Only images (JPG, PNG, etc.) and PDF files are accepted.');
      if (isTemp && asset.uri) RNFS.unlink(asset.uri).catch(() => {});
      return;
    }
    setUploadedFile((prev: any) => {
      if (prev?._isTemp && prev?.uri) RNFS.unlink(prev.uri).catch(() => {});
      return {...asset, _isTemp: isTemp};
    });
  };

  const pickFromGallery = async () => {
    const ok = await requestMediaPermission();
    if (!ok) return;
    const result = await launchImageLibrary({mediaType: 'photo', quality: 0.7, selectionLimit: 1, presentationStyle: 'pageSheet'});
    if (result.didCancel || !result.assets?.length) return;
    const {file: resized, isTemp} = await resizeImageIfNeeded(result.assets[0]);
    validateAndSet(resized, isTemp);
  };

  const pickFromCamera = async () => {
    const ok = await requestCameraPermission();
    if (!ok) return;
    const result = await launchCamera({mediaType: 'photo', quality: 0.7, saveToPhotos: false, includeBase64: false, cameraType: 'back'});
    if (result.didCancel || !result.assets?.length) return;
    const {file: resized, isTemp} = await resizeImageIfNeeded(result.assets[0]);
    validateAndSet(resized, isTemp);
  };

  const pickPdf = async () => {
    try {
      const results = await pick({type: [types.pdf], allowMultiSelection: false});
      if (!results || results.length === 0) return;
      const file = results[0];
      validateAndSet({
        uri: file.uri,
        type: file.type || 'application/pdf',
        fileName: file.name || 'document.pdf',
        fileSize: file.size || 0,
      });
    } catch (err: any) {
      if (err?.code === 'DOCUMENT_PICKER_CANCELED' || err?.message?.toLowerCase().includes('cancel')) return;
      Alert.alert('PDF Error', 'Unable to open PDF picker. Please try again.');
    }
  };

  const handlePickFile = () => {
    Alert.alert(
      'Attach Certificate',
      'Choose how to attach your certificate.',
      [
        {text: '📷  Take Photo', onPress: pickFromCamera},
        {text: '🖼️  Choose Image', onPress: pickFromGallery},
        {text: '📄  Choose PDF', onPress: pickPdf},
        {text: 'Cancel', style: 'cancel'},
      ],
      {cancelable: true},
    );
  };

  const currentSub = !isOthers && subcategoryName
    ? subcategories.find(s => s.name === subcategoryName)
    : null;
  const hasLevels = currentSub?.levels?.length > 0;

  const canSubmit = isOthers
    ? othersDescription.trim() && uploadedFile && dateFrom && (!isDurationEvent || dateTo) && !uploading
    : categoryId && subcategoryName && uploadedFile && dateFrom && (!isDurationEvent || dateTo) && !uploading;

  const handleSubmit = async () => {
    if (!dateFrom) {
      Alert.alert('Certificate Date Required', 'Please select the certificate date.');
      return;
    }
    if (isDurationEvent && !dateTo) {
      Alert.alert('End Date Required', 'Please select the activity end date.');
      return;
    }
    if (!canSubmit) return;
    setUploading(true);
    const file = uploadedFile;
    try {
      const formData = new FormData();
      if (isOthers) {
        formData.append('categoryId', 'others');
        formData.append('subcategoryName', othersDescription.trim());
        formData.append('level', '');
        formData.append('prizeType', '');
      } else {
        formData.append('categoryId', categoryId);
        formData.append('subcategoryName', subcategoryName);
        formData.append('level', levelSelected || '');
        formData.append('prizeType', prizeType || '');
      }
      if (dateFrom) formData.append('dateFrom', dateFrom.toISOString().split('T')[0]);
      if (dateTo) formData.append('dateTo', dateTo.toISOString().split('T')[0]);
      if (eventName.trim()) formData.append('eventName', eventName.trim());
      formData.append('file', {
        uri: Platform.OS === 'android' ? file.uri : file.uri.replace('file://', ''),
        type: file.type || 'image/jpeg',
        name: file.fileName || 'certificate.jpg',
      } as any);
      await axiosInstance.post('/certificates/upload', formData, {
        headers: {'Content-Type': 'multipart/form-data'},
      });
      await clearTempCache();
      setSubmitted(true);
    } catch (err) {
      Alert.alert('Upload Failed', 'Please check your connection and try again.');
    } finally {
      if (file?._isTemp && file?.uri) RNFS.unlink(file.uri).catch(() => {});
      setUploadedFile(null);
      setUploading(false);
    }
  };

  if (submitted) {
    return (
      <SafeAreaView style={[styles.safeArea, {backgroundColor: colors.successBg}]}>
        <Animated.View
          style={[
            styles.successContainer,
            {backgroundColor: colors.successBg, opacity: fadeAnim, transform: [{scale: scaleAnim}]},
          ]}>
          <LottieView
            source={require('../assets/animations/successes.json')}
            autoPlay
            loop={false}
            style={{width: 220, height: 220, marginBottom: 10}}
          />
          <Text style={[styles.successTitle, {color: colors.successTitle}]}>
            Certificate Submitted!
          </Text>
          <Text style={[styles.successSub, {color: colors.successSub}]}>
            Your certificate has been submitted and is pending approval by your tutor.
          </Text>
        </Animated.View>
      </SafeAreaView>
    );
  }

  const selectedCat = categories.find(c => c._id === categoryId);
  const catItems = [
    ...categories.map(c => ({label: c.name, value: c._id})),
    {label: 'Others', value: '__others__'},
  ];
  const subItems = subcategories.map((s: any) => ({label: s.name, value: s.name}));
  const levelItems = currentSub?.levels?.map((l: any) => ({label: l.name, value: l.name})) || [];
  const selectedLevelObj = currentSub?.levels?.find((l: any) => l.name === levelSelected);
  const prizeItems = selectedLevelObj ? selectedLevelObj.prizes.map((p: any) => ({label: p.type, value: p.type})) : [];

  return (
    <SafeAreaView style={[styles.safeArea, {backgroundColor: colors.bg}]}>
      <StatusBar barStyle={colors.statusBar} backgroundColor={colors.bg} />

      <DropdownModal visible={catModalOpen} title="Select Category" items={catItems}
        selectedValue={categoryId} colors={colors}
        onSelect={v => { if (v === '__others__') { activateOthers(); } else { setCategoryId(v); setIsOthers(false); } }}
        onClose={() => setCatModalOpen(false)}
      />
      <DropdownModal visible={subModalOpen} title="Select Subcategory" items={subItems}
        selectedValue={subcategoryName} colors={colors}
        onSelect={v => setSubcategoryName(v)}
        onClose={() => setSubModalOpen(false)}
      />
      <DropdownModal visible={levelModalOpen} title="Select Level" items={levelItems}
        selectedValue={levelSelected} colors={colors}
        onSelect={v => {
          setLevelSelected(v);
          setPrizeType('');
          const lvl = currentSub?.levels?.find((l: any) => l.name === v);
          if (lvl?.prizes?.length === 1) setPrizeType(lvl.prizes[0].type);
        }}
        onClose={() => setLevelModalOpen(false)}
      />
      <DropdownModal visible={prizeModalOpen} title="Select Prize Type" items={prizeItems}
        selectedValue={prizeType} colors={colors}
        onSelect={v => setPrizeType(v)}
        onClose={() => setPrizeModalOpen(false)}
      />

      {showFromPicker && (
        <DateTimePicker
          value={dateFrom || new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          maximumDate={new Date()}
          onChange={(event: DateTimePickerEvent, selected?: Date) => {
            setShowFromPicker(Platform.OS === 'ios');
            if (event.type !== 'dismissed' && selected) {
              setDateFrom(selected);
              if (dateTo && selected > dateTo) setDateTo(null);
            }
          }}
        />
      )}
      {showToPicker && (
        <DateTimePicker
          value={dateTo || dateFrom || new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          minimumDate={dateFrom || undefined}
          maximumDate={new Date()}
          onChange={(event: DateTimePickerEvent, selected?: Date) => {
            setShowToPicker(Platform.OS === 'ios');
            if (event.type !== 'dismissed' && selected) setDateTo(selected);
          }}
        />
      )}

      <ScrollView
        style={[styles.container, {backgroundColor: colors.bg}]}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled">
        <Text style={[styles.pageTitle, {color: colors.primary}]}>Upload Certificate</Text>

        <Text style={[styles.label, {color: colors.textSub}]}>Search Certificate Type</Text>
        <TextInput
          style={[styles.input, {backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text}]}
          placeholder="Search by name, category…"
          placeholderTextColor={colors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {showDropdown && (
          <View style={[styles.dropdown, {backgroundColor: colors.card, borderColor: colors.border}]}>
            {searchResults.map((item, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.dropdownItem, {borderBottomColor: colors.borderLight}]}
                onPress={() => selectSearchResult(item)}>
                <Text style={[styles.dropdownMain, {color: colors.textSub}]}>{item.subcategoryName}</Text>
                <Text style={[styles.dropdownSub, {color: colors.textMuted}]}>{item.categoryName}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.dropdownItem, {borderBottomColor: colors.borderLight}]}
              onPress={activateOthers}>
              <Text style={[styles.dropdownMain, {color: colors.textSub}]}>Others</Text>
              <Text style={[styles.dropdownSub, {color: colors.textMuted}]}>Certificate not listed above</Text>
            </TouchableOpacity>
          </View>
        )}

        {isOthers ? (
          <View style={[styles.othersBox, {backgroundColor: colors.primaryMuted, borderColor: colors.primaryLight}]}>
            <View style={styles.othersHeader}>
              <View style={{flexDirection: 'row', alignItems: 'center', gap: 6}}>
                <MaterialCommunityIcons name="paperclip" size={16} color={colors.primary} />
                <Text style={[styles.othersLabel, {color: colors.primary}]}>Others</Text>
              </View>
              <TouchableOpacity onPress={() => { setIsOthers(false); setOthersDescription(''); }}>
                <Text style={[styles.clearText, {color: colors.dangerText}]}>✕ Clear</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.input, {backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text}]}
              placeholder="Describe the certificate (e.g. Blood Donation 2024)"
              placeholderTextColor={colors.textMuted}
              value={othersDescription}
              onChangeText={setOthersDescription}
            />
          </View>
        ) : (
          <>
            <Text style={[styles.label, {color: colors.textSub}]}>Category</Text>
            <TouchableOpacity
              style={[styles.selector, {backgroundColor: colors.inputBg, borderColor: colors.border}]}
              onPress={() => setCatModalOpen(true)}>
              <Text style={[selectedCat ? styles.selectorText : styles.selectorPH, {color: selectedCat ? colors.text : colors.textMuted}]}>
                {selectedCat ? selectedCat.name : 'Select category'}
              </Text>
              <Text style={[styles.chevron, {color: colors.textMuted}]}>▼</Text>
            </TouchableOpacity>

            {subcategories.length > 0 && (
              <>
                <Text style={[styles.label, {color: colors.textSub}]}>Subcategory</Text>
                <TouchableOpacity
                  style={[styles.selector, {backgroundColor: colors.inputBg, borderColor: colors.border}]}
                  onPress={() => setSubModalOpen(true)}>
                  <Text style={[subcategoryName ? styles.selectorText : styles.selectorPH, {color: subcategoryName ? colors.text : colors.textMuted}]}>
                    {subcategoryName || 'Select subcategory'}
                  </Text>
                  <Text style={[styles.chevron, {color: colors.textMuted}]}>▼</Text>
                </TouchableOpacity>
              </>
            )}

            {hasLevels && (
              <>
                <Text style={[styles.label, {color: colors.textSub}]}>Level</Text>
                <TouchableOpacity
                  style={[styles.selector, {backgroundColor: colors.inputBg, borderColor: colors.border}]}
                  onPress={() => setLevelModalOpen(true)}>
                  <Text style={[levelSelected ? styles.selectorText : styles.selectorPH, {color: levelSelected ? colors.text : colors.textMuted}]}>
                    {levelSelected || 'Select level'}
                  </Text>
                  <Text style={[styles.chevron, {color: colors.textMuted}]}>▼</Text>
                </TouchableOpacity>

                {levelSelected && (
                  <>
                    <Text style={[styles.label, {color: colors.textSub}]}>Prize Type</Text>
                    <TouchableOpacity
                      style={[styles.selector, {backgroundColor: colors.inputBg, borderColor: colors.border}]}
                      onPress={() => setPrizeModalOpen(true)}>
                      <Text style={[prizeType ? styles.selectorText : styles.selectorPH, {color: prizeType ? colors.text : colors.textMuted}]}>
                        {prizeType || 'Select prize type'}
                      </Text>
                      <Text style={[styles.chevron, {color: colors.textMuted}]}>▼</Text>
                    </TouchableOpacity>
                  </>
                )}
              </>
            )}

            {subcategoryName && (
              <>
                <Text style={[styles.label, {color: colors.textSub}]}>Event / Competition Name</Text>
                <TextInput
                  style={[styles.input, {backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text}]}
                  placeholder="e.g. NPTEL Python 2024, Hackathon MTI"
                  placeholderTextColor={colors.textMuted}
                  value={eventName}
                  onChangeText={setEventName}
                  maxLength={120}
                />
              </>
            )}

            {eligiblePoints !== null && (
              <View style={[styles.eligibleBox, {backgroundColor: colors.cardWarn, borderColor: colors.badgePendingText}]}>
                <View style={{flexDirection: 'row', alignItems: 'center', gap: 6}}>
                  <MaterialCommunityIcons name="trophy-award" size={18} color={colors.warnText} />
                  <Text style={[styles.eligibleText, {color: colors.warnText}]}>Eligible Points: {eligiblePoints}</Text>
                </View>
                <Text style={[styles.eligibleNote, {color: colors.warnNote}]}>*Final points will be approved by tutor</Text>
              </View>
            )}
          </>
        )}

        <View style={{flexDirection: 'row', alignItems: 'center', marginTop: 14, marginBottom: 6}}>
          <MaterialCommunityIcons name="calendar-range" size={18} color={colors.textSub} style={{marginRight: 6}} />
          <Text style={[styles.label, {color: colors.textSub, marginTop: 0, marginBottom: 0}]}>Certificate Date *</Text>
        </View>
        <View style={styles.dateField}>
          <DatePickerField label="Select certificate date" value={dateFrom} onPress={() => setShowFromPicker(true)} colors={colors} />
        </View>

        <TouchableOpacity
          onPress={() => { setIsDurationEvent(prev => { if (prev) setDateTo(null); return !prev; }); }}
          style={{flexDirection: 'row', alignItems: 'center', marginTop: 14}}>
          <MaterialCommunityIcons
            name={isDurationEvent ? 'checkbox-marked' : 'checkbox-blank-outline'}
            size={22} color={colors.primary} style={{marginRight: 8}}
          />
          <Text style={{color: colors.textSub, fontSize: 14, fontWeight: '500'}}>This activity spans multiple days</Text>
        </TouchableOpacity>

        {isDurationEvent && (
          <View style={{marginTop: 14}}>
            <Text style={[styles.dateLabel, {color: colors.textMuted}]}>End Date *</Text>
            <DatePickerField label="Select end date" value={dateTo} onPress={() => setShowToPicker(true)} colors={colors} />
          </View>
        )}

        {(dateFrom || dateTo) && (
          <TouchableOpacity
            onPress={() => { setDateFrom(null); setDateTo(null); setIsDurationEvent(false); }}
            style={styles.clearDates}>
            <Text style={[styles.clearDatesText, {color: colors.textMuted}]}>✕ Clear dates</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.filePicker, {backgroundColor: colors.card, borderColor: uploadedFile ? colors.primary : '#3b82f6'}]}
          onPress={handlePickFile}>
          <View style={{alignItems: 'center'}}>
            <MaterialCommunityIcons
              name={uploadedFile ? 'file-check-outline' : 'paperclip'}
              size={24} color={uploadedFile ? colors.primary : '#2563eb'} style={{marginBottom: 6}}
            />
            <Text style={[styles.filePickerText, {color: uploadedFile ? colors.primary : '#2563eb'}]}>
              {uploadedFile
                ? `${uploadedFile.fileName || 'File selected'} (${((uploadedFile.fileSize || 0) / 1024 / 1024).toFixed(2)} MB)`
                : `Attach Certificate — Image, PDF or Camera\n(Max ${MAX_FILE_SIZE_MB} MB)`}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.submitBtn, {backgroundColor: colors.primaryBtn}, !canSubmit && styles.submitDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit}>
          {uploading ? (
            <View style={{flexDirection: 'row', alignItems: 'center', gap: 10}}>
              <ActivityIndicator color="#fff" />
              <Text style={{color: '#fff', fontWeight: '600'}}>Uploading...</Text>
            </View>
          ) : (
            <Text style={styles.submitText}>Submit Certificate</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const dm = StyleSheet.create({
  overlay: {...StyleSheet.absoluteFillObject},
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    maxHeight: '70%', paddingBottom: Platform.OS === 'android' ? 24 : 8,
  },
  sheetTitle: {fontSize: 16, fontWeight: '700', padding: 18, borderBottomWidth: 1},
  item: {paddingHorizontal: 18, paddingVertical: 16, borderBottomWidth: 1},
  itemText: {fontSize: 15, fontWeight: '500'},
  cancelBtn: {margin: 12, padding: 14, borderRadius: 12, alignItems: 'center'},
  cancelText: {fontSize: 15, fontWeight: '600'},
});

const dpf = StyleSheet.create({
  btn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1.5, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 13, minHeight: 50,
  },
  icon: {fontSize: 16},
  text: {flex: 1, fontSize: 14, fontWeight: '500'},
  chevron: {fontSize: 14, fontWeight: '700'},
});

const styles = StyleSheet.create({
  safeArea: {flex: 1},
  container: {flex: 1},
  content: {padding: 20, paddingBottom: 120},
  pageTitle: {fontSize: 22, fontWeight: '800', marginBottom: 20},
  label: {fontSize: 13, fontWeight: '600', marginTop: 14, marginBottom: 6},
  input: {borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15},
  dropdown: {borderWidth: 1.5, borderRadius: 12, marginTop: 4},
  dropdownItem: {paddingHorizontal: 14, paddingVertical: 14, borderBottomWidth: 1},
  dropdownMain: {fontSize: 15, fontWeight: '500'},
  dropdownSub: {fontSize: 12, marginTop: 2},
  selector: {
    borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 52,
  },
  selectorText: {fontSize: 15, flex: 1},
  selectorPH: {fontSize: 15, flex: 1},
  chevron: {fontSize: 14, marginLeft: 8},
  othersBox: {borderRadius: 12, padding: 14, marginTop: 10, borderWidth: 1.5},
  othersHeader: {flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8},
  othersLabel: {fontWeight: '700', fontSize: 14},
  clearText: {fontSize: 13, fontWeight: '500'},
  eligibleBox: {borderRadius: 10, padding: 12, marginTop: 12, borderWidth: 1},
  eligibleText: {fontWeight: '700', fontSize: 14},
  eligibleNote: {fontSize: 12, marginTop: 2},
  dateRow: {flexDirection: 'row', gap: 10},
  dateField: {flex: 1},
  dateLabel: {fontSize: 12, marginBottom: 4},
  clearDates: {marginTop: 6, alignSelf: 'flex-end'},
  clearDatesText: {fontSize: 12, fontWeight: '500'},
  filePicker: {borderWidth: 2, borderStyle: 'dashed', borderRadius: 12, padding: 18, alignItems: 'center', marginTop: 16},
  filePickerText: {fontSize: 14, fontWeight: '600', textAlign: 'center'},
  submitBtn: {borderRadius: 12, paddingVertical: 18, alignItems: 'center', marginTop: 24, minHeight: 56},
  submitDisabled: {opacity: 0.4},
  submitText: {color: '#fff', fontWeight: '700', fontSize: 16},
  successContainer: {flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30},
  successTitle: {fontSize: 24, fontWeight: '800', textAlign: 'center'},
  successSub: {fontSize: 15, textAlign: 'center', marginTop: 10, lineHeight: 22},
  successBtn: {borderRadius: 12, paddingVertical: 16, paddingHorizontal: 28, marginTop: 28, minHeight: 56},
  successBtnText: {color: '#fff', fontWeight: '700', fontSize: 16},
});
