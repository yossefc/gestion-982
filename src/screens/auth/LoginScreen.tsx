// Écran de connexion
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { Colors, Shadows } from '../../theme/colors';
import { PrimaryButton } from '../../components';
import { notifyError } from '../../utils/notify';

const LoginScreen: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      notifyError(new Error('נא למלא את כל השדות'), 'התחברות');
      return;
    }

    setLoading(true);
    try {
      await signIn(email.trim(), password);
    } catch (error) {
      notifyError(error, 'התחברות');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        {/* Logo / Header */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Text style={styles.logoText}>982</Text>
          </View>
          <Text style={styles.title}>מערכת ניהול ציוד</Text>
          <Text style={styles.subtitle}>גדוד 982</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>אימייל</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="example@email.com"
              placeholderTextColor={Colors.text.light}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              textAlign="right"
              accessibilityLabel="שדה הזנת אימייל"
              accessibilityHint="הזן את כתובת האימייל שלך"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>סיסמה</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={Colors.text.light}
              secureTextEntry
              textAlign="right"
              accessibilityLabel="שדה הזנת סיסמה"
              accessibilityHint="הזן את הסיסמה שלך"
            />
          </View>

          <PrimaryButton
            title="התחברות"
            onPress={handleLogin}
            loading={loading}
            disabled={loading}
            accessibilityLabel="כפתור התחברות"
            accessibilityHint="לחץ להתחבר למערכת"
          />
        </View>

        {/* Footer */}
        <Text style={styles.footer}>
          © 2024 מערכת ניהול ציוד צבאי
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  header: {
    alignItems: 'center',
    marginBottom: 50,
  },
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.status.info,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    ...Shadows.large,
  },
  logoText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: Colors.text.white,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.text.white,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: Colors.text.secondary,
  },
  form: {
    backgroundColor: Colors.background.card,
    borderRadius: 20,
    padding: 25,
    ...Shadows.medium,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: 8,
    textAlign: 'right',
  },
  input: {
    backgroundColor: Colors.background.primary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.text.primary,
    borderWidth: 1,
    borderColor: Colors.border.medium,
  },
  footer: {
    textAlign: 'center',
    color: Colors.text.secondary,
    fontSize: 12,
    marginTop: 40,
  },
});

export default LoginScreen;
