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
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Shadows, Spacing, BorderRadius, FontSize } from '../../theme/Colors';
import { useAuth } from '../../contexts/AuthContext';

const LoginScreen: React.FC = () => {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [focusedInput, setFocusedInput] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('שגיאה', 'נא למלא את כל השדות');
      return;
    }

    try {
      setLoading(true);
      await signIn(email.trim(), password);
    } catch (error: any) {
      let message = 'שגיאה בהתחברות';
      if (error.code === 'auth/user-not-found') {
        message = 'משתמש לא קיים במערכת';
      } else if (error.code === 'auth/wrong-password') {
        message = 'סיסמה שגויה';
      } else if (error.code === 'auth/invalid-email') {
        message = 'כתובת אימייל לא תקינה';
      }
      Alert.alert('שגיאה', message);
    } finally {
      setLoading(false);
    }
  };

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
              <Text style={styles.logoText}>982</Text>
            </View>
            <View style={styles.logoRing} />
          </View>
          <Text style={styles.title}>מערכת ניהול ציוד</Text>
          <Text style={styles.subtitle}>גדוד 982</Text>
        </View>

        {/* Login Form */}
        <View style={styles.formContainer}>
          <View style={styles.formCard}>
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

            {/* Login Button */}
            <TouchableOpacity
              style={[styles.loginButton, loading && styles.loginButtonDisabled]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator size="small" color={Colors.textWhite} />
              ) : (
                <>
                  <Text style={styles.loginButtonText}>התחבר</Text>
                  <Ionicons name="arrow-back" size={20} color={Colors.textWhite} />
                </>
              )}
            </TouchableOpacity>

            {/* Forgot Password */}
            <TouchableOpacity style={styles.forgotPassword}>
              <Text style={styles.forgotPasswordText}>שכחת סיסמה?</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>מערכת ניהול ציוד צה״ל</Text>
          <Text style={styles.versionText}>גרסה 1.0.0</Text>
        </View>
      </ScrollView>
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
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.textWhite,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.large,
  },

  logoRing: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
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