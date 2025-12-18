import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

type ConflictAlertProps = {
  count: number;
  onView?: () => void;
  onDismiss?: () => void;
};

export function ConflictAlert({ count, onView, onDismiss }: ConflictAlertProps) {
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <View style={styles.badge}>
          <Feather name="alert-triangle" size={16} color="#dc2626" />
        </View>
        <View style={styles.textGroup}>
          <Text style={styles.title}>Conflicts detected</Text>
          <Text style={styles.subtitle}>
            You have {count} overlapping events. Resolve to avoid scheduling issues.
          </Text>
        </View>
      </View>
      <View style={styles.actions}>
        <Pressable style={[styles.button, styles.secondary]} onPress={onDismiss}>
          <Text style={[styles.buttonText, styles.secondaryText]}>Dismiss</Text>
        </Pressable>
        <Pressable style={[styles.button, styles.primary]} onPress={onView}>
          <Text style={styles.buttonText}>View conflicts</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    padding: 16,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecdd3',
  },
  row: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  badge: {
    height: 36,
    width: 36,
    borderRadius: 18,
    backgroundColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textGroup: {
    flex: 1,
    marginLeft: 12,
  },
  title: {
    fontWeight: '700',
    color: '#991b1b',
  },
  subtitle: {
    color: '#7f1d1d',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  button: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    minWidth: 120,
    alignItems: 'center',
  },
  primary: {
    backgroundColor: '#dc2626',
  },
  secondary: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecdd3',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
  secondaryText: {
    color: '#b91c1c',
  },
});
