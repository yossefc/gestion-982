/**
 * LoginScreen.tsx - Écran de connexion
 * Design militaire professionnel
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Shadows, Spacing, BorderRadius, FontSize } from '../../theme/Colors';
import { useAuth } from '../../contexts/AuthContext';
import { useGoogleSignIn } from '../../hooks/useGoogleSignIn';
import { useAppleSignIn } from '../../hooks/useAppleSignIn';
import { AppModal, ModalType } from '../../components';

const LoginScreen: React.FC = () => {
  const { signIn, signUp } = useAuth();
  const { signInWithGoogle, googleLoading, googleReady, googleError, clearGoogleError } = useGoogleSignIn();
  const { signInWithApple, appleLoading, appleAvailable, appleError, clearAppleError } = useAppleSignIn();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [focusedInput, setFocusedInput] = useState<string | null>(null);

  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState<ModalType>('info');
  const [modalMessage, setModalMessage] = useState('');
  const [modalButtons, setModalButtons] = useState<any[]>([]);

  const handleAction = async () => {
    if (!email.trim() || !password.trim() || (isRegister && !name.trim())) {
      setModalType('error');
      setModalMessage('נא למלא את כל השדות');
      setModalButtons([{ text: 'סגור', style: 'primary', onPress: () => setModalVisible(false) }]);
      setModalVisible(true);
      return;
    }

    try {
      setLoading(true);
      if (isRegister) {
        await signUp(email.trim(), password, name.trim());
      } else {
        await signIn(email.trim(), password);
      }
    } catch (error: any) {
      setModalType('error');
      setModalMessage(error.message || 'פעולה נכשלה');
      setModalButtons([{ text: 'סגור', style: 'primary', onPress: () => setModalVisible(false) }]);
      setModalVisible(true);
    } finally {
      setLoading(false);
    }
  };

  // Afficher l'erreur Google via modal si elle apparaît
  React.useEffect(() => {
    if (googleError) {
      setModalType('error');
      setModalMessage(googleError);
      setModalButtons([{ text: 'סגור', style: 'primary', onPress: () => { setModalVisible(false); clearGoogleError(); } }]);
      setModalVisible(true);
    }
  }, [googleError]);

  // Afficher l'erreur Apple via modal si elle apparaît
  React.useEffect(() => {
    if (appleError) {
      setModalType('error');
      setModalMessage(appleError);
      setModalButtons([{ text: 'סגור', style: 'primary', onPress: () => { setModalVisible(false); clearAppleError(); } }]);
      setModalVisible(true);
    }
  }, [appleError]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo Section */}
        <View style={styles.logoSection}>
          <View style={styles.logoContainer}>
            <View style={styles.logo}>
              <Image
                source={require('../../../assets/images/logo-982.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
            <View style={styles.logoRing} />
          </View>
          <Text style={styles.title}>מערכת ניהול ציוד</Text>
          <Text style={styles.subtitle}>גדוד 982</Text>
        </View>

        {/* Form Container */}
        <View style={styles.formContainer}>
          <View style={styles.formCard}>
            {/* Toggle Header */}
            <View style={styles.toggleHeader}>
              <TouchableOpacity
                style={[styles.toggleBtn, !isRegister && styles.toggleBtnActive]}
                onPress={() => setIsRegister(false)}
              >
                <Text style={[styles.toggleText, !isRegister && styles.toggleTextActive]}>התחברות</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleBtn, isRegister && styles.toggleBtnActive]}
                onPress={() => setIsRegister(true)}
              >
                <Text style={[styles.toggleText, isRegister && styles.toggleTextActive]}>הרשמה</Text>
              </TouchableOpacity>
            </View>

            {/* Name Input (Register Only) */}
            {isRegister && (
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>שם מלא</Text>
                <View style={[
                  styles.inputWrapper,
                  focusedInput === 'name' && styles.inputWrapperFocused,
                ]}>
                  <TextInput
                    style={styles.input}
                    placeholder="הזן שם מלא"
                    placeholderTextColor={Colors.placeholder}
                    value={name}
                    onChangeText={setName}
                    autoCorrect={false}
                    onFocus={() => setFocusedInput('name')}
                    onBlur={() => setFocusedInput(null)}
                  />
                  <Ionicons
                    name="person-outline"
                    size={20}
                    color={focusedInput === 'name' ? Colors.primary : Colors.textLight}
                  />
                </View>
              </View>
            )}

            {/* Email Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>אימייל</Text>
              <View style={[
                styles.inputWrapper,
                focusedInput === 'email' && styles.inputWrapperFocused,
              ]}>
                <TextInput
                  style={styles.input}
                  placeholder="הזן כתובת אימייל"
                  placeholderTextColor={Colors.placeholder}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  onFocus={() => setFocusedInput('email')}
                  onBlur={() => setFocusedInput(null)}
                />
                <Ionicons
                  name="mail-outline"
                  size={20}
                  color={focusedInput === 'email' ? Colors.primary : Colors.textLight}
                />
              </View>
            </View>

            {/* Password Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>סיסמה</Text>
              <View style={[
                styles.inputWrapper,
                focusedInput === 'password' && styles.inputWrapperFocused,
              ]}>
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.passwordToggle}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={Colors.textLight}
                  />
                </TouchableOpacity>
                <TextInput
                  style={styles.input}
                  placeholder="הזן סיסמה"
                  placeholderTextColor={Colors.placeholder}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  onFocus={() => setFocusedInput('password')}
                  onBlur={() => setFocusedInput(null)}
                />
                <Ionicons
                  name="lock-closed-outline"
                  size={20}
                  color={focusedInput === 'password' ? Colors.primary : Colors.textLight}
                />
              </View>
            </View>

            {/* Action Button */}
            <TouchableOpacity
              style={[styles.loginButton, loading && styles.loginButtonDisabled]}
              onPress={handleAction}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator size="small" color={Colors.textWhite} />
              ) : (
                <>
                  <Text style={styles.loginButtonText}>{isRegister ? 'הרשם עכשיו' : 'התחבר'}</Text>
                  <Ionicons name={isRegister ? 'person-add-outline' : 'arrow-back'} size={20} color={Colors.textWhite} />
                </>
              )}
            </TouchableOpacity>

            {/* Séparateur "ou" */}
            <View style={styles.dividerContainer}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Google Sign In Button */}
            <TouchableOpacity
              style={[styles.socialButton, googleLoading && styles.socialButtonDisabled]}
              onPress={signInWithGoogle}
              disabled={googleLoading}
              activeOpacity={0.8}
            >
              {googleLoading ? (
                <ActivityIndicator size="small" color="#4285F4" />
              ) : (
                <>
                  <View style={styles.googleIconContainer}>
                    <Text style={styles.googleIconText}>G</Text>
                  </View>
                  <Text style={styles.socialButtonText}>התחבר עם Google</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Apple Sign In Button — iOS uniquement */}
            {appleAvailable && (
              <TouchableOpacity
                style={[styles.socialButton, styles.appleButton, appleLoading && styles.socialButtonDisabled]}
                onPress={signInWithApple}
                disabled={appleLoading}
                activeOpacity={0.8}
              >
                {appleLoading ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="logo-apple" size={20} color="#FFF" />
                    <Text style={styles.appleButtonText}>התחבר עם Apple</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {/* Switch Mode Link */}
            <TouchableOpacity
              style={styles.forgotPassword}
              onPress={() => setIsRegister(!isRegister)}
            >
              <Text style={styles.forgotPasswordText}>
                {isRegister ? 'כבר יש לך חשבון? התחבר' : 'אין לך חשבון? צור חשבון חדש'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>מערכת ניהול ציוד צה״ל</Text>
          <Text style={styles.versionText}>גרסה 1.0.1</Text>
        </View>
      </ScrollView>

      {/* App Modal */}
      <AppModal
        visible={modalVisible}
        type={modalType}
        message={modalMessage}
        buttons={modalButtons}
        onClose={() => setModalVisible(false)}
      />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primary,
  },

  scrollContent: {
    flexGrow: 1,
    paddingBottom: Spacing.xxl,
  },

  // Logo Section
  logoSection: {
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 80 : 60,
    paddingBottom: Spacing.xxl,
  },

  logoContainer: {
    position: 'relative',
    marginBottom: Spacing.lg,
  },

  logo: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.textWhite,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.large,
    overflow: 'hidden',
  },

  logoImage: {
    width: '90%',
    height: '90%',
  },

  logoRing: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    top: -10,
    left: -10,
  },

  logoText: {
    fontSize: 36,
    fontWeight: '800',
    color: Colors.primary,
  },

  title: {
    fontSize: FontSize.xxl,
    fontWeight: '700',
    color: Colors.textWhite,
    marginTop: Spacing.md,
  },

  subtitle: {
    fontSize: FontSize.lg,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: Spacing.xs,
  },

  // Form Section
  formContainer: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },

  formCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    ...Shadows.large,
  },

  toggleHeader: {
    flexDirection: 'row',
    marginBottom: Spacing.xl,
    backgroundColor: Colors.backgroundInput,
    borderRadius: BorderRadius.md,
    padding: 4,
  },

  toggleBtn: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    borderRadius: BorderRadius.sm,
  },

  toggleBtnActive: {
    backgroundColor: Colors.backgroundCard,
    ...Shadows.xs,
  },

  toggleText: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.textSecondary,
  },

  toggleTextActive: {
    color: Colors.primary,
  },

  inputContainer: {
    marginBottom: Spacing.lg,
  },

  inputLabel: {
    fontSize: FontSize.md,
    fontWeight: '500',
    color: Colors.text,
    marginBottom: Spacing.sm,
    textAlign: 'right',
  },

  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundInput,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
  },

  inputWrapperFocused: {
    borderColor: Colors.primary,
    backgroundColor: Colors.backgroundCard,
  },

  input: {
    flex: 1,
    paddingVertical: Spacing.md,
    fontSize: FontSize.base,
    color: Colors.text,
    textAlign: 'right',
    marginRight: Spacing.sm,
  },

  passwordToggle: {
    padding: Spacing.xs,
  },

  loginButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    ...Shadows.small,
  },

  loginButtonDisabled: {
    backgroundColor: Colors.primaryLight,
  },

  loginButtonText: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.textWhite,
  },

  // Divider "ou"
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },

  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },

  dividerText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginHorizontal: Spacing.md,
    fontWeight: '500',
  },

  // Social Sign In Buttons
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.backgroundCard,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    marginTop: Spacing.sm,
    ...Shadows.xs,
  },

  socialButtonDisabled: {
    opacity: 0.5,
  },

  socialButtonText: {
    fontSize: FontSize.base,
    fontWeight: '600',
    color: Colors.text,
  },

  googleIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#4285F4',
    alignItems: 'center',
    justifyContent: 'center',
  },

  googleIconText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
  },

  // Apple Sign In
  appleButton: {
    backgroundColor: '#000000',
    borderColor: '#000000',
  },

  appleButtonText: {
    fontSize: FontSize.base,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  forgotPassword: {
    alignItems: 'center',
    marginTop: Spacing.lg,
  },

  forgotPasswordText: {
    fontSize: FontSize.md,
    color: Colors.primary,
    fontWeight: '500',
  },

  // Footer
  footer: {
    alignItems: 'center',
    paddingTop: Spacing.xxl,
  },

  footerText: {
    fontSize: FontSize.sm,
    color: 'rgba(255, 255, 255, 0.6)',
  },

  versionText: {
    fontSize: FontSize.xs,
    color: 'rgba(255, 255, 255, 0.4)',
    marginTop: Spacing.xs,
  },
});

export default LoginScreen;