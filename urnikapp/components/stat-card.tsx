import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

type Trend = {
  value: string;
  isPositive: boolean;
};

export type StatCardProps = {
  title: string;
  value: string | number;
  icon?: keyof typeof Feather.glyphMap;
  description?: string;
  trend?: Trend;
};

export function StatCard({
  title,
  value,
  icon = 'bar-chart-2',
  description,
  trend,
}: StatCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {icon ? <Feather name={icon} size={18} color="#6b7280" /> : null}
      </View>
      <Text style={styles.value}>{value}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
      {trend ? (
        <Text style={[styles.trend, trend.isPositive ? styles.positive : styles.negative]}>
          {trend.value}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 14,
    color: '#4b5563',
    fontWeight: '600',
  },
  value: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
  },
  description: {
    marginTop: 6,
    fontSize: 12,
    color: '#6b7280',
  },
  trend: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '600',
  },
  positive: {
    color: '#16a34a',
  },
  negative: {
    color: '#dc2626',
  },
});
