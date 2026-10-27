import React from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '@/context/AppContext';
import { Radius, Spacing, Type } from '@/constants/theme';

export type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

/** Decorative icon: hidden from screen readers so buttons are read by their label only. */
export function Icon({ name, size = 22, color }: { name: IconName; size?: number; color: string }) {
  return (
    <MaterialIcons
      name={name}
      size={size}
      color={color}
      aria-hidden
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}

/** Scrollable page with a large title and an optional action on the right. */
export function Screen({
  title,
  subtitle,
  action,
  children,
  scroll = true,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  scroll?: boolean;
}) {
  const { colors } = useApp();
  const insets = useSafeAreaInsets();
  const header = (
    <View style={[styles.header, { paddingTop: insets.top + Spacing.lg }]}>
      <View style={{ flex: 1 }}>
        <Text style={[Type.title, { color: colors.text }]} accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? <Text style={[Type.small, { color: colors.textSecondary, marginTop: 2 }]}>{subtitle}</Text> : null}
      </View>
      {action}
    </View>
  );
  if (!scroll) {
    return (
      <View style={[styles.flex, { backgroundColor: colors.background }]}>
        {header}
        <View style={[styles.flex, styles.body]}>{children}</View>
      </View>
    );
  }
  return (
    <ScrollView
      style={[styles.flex, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: Spacing.xxl * 3 }}
      keyboardShouldPersistTaps="handled">
      {header}
      <View style={styles.body}>{children}</View>
    </ScrollView>
  );
}

export function Card({ children, style, onPress }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  const { colors } = useApp();
  const base = [styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, style];
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [base, pressed && { opacity: 0.85 }]}>
        {children}
      </Pressable>
    );
  }
  return <View style={base}>{children}</View>;
}

export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  const { colors } = useApp();
  return (
    <View style={styles.sectionRow}>
      <Text style={[Type.tiny, { color: colors.textSecondary, letterSpacing: 0.8, textTransform: 'uppercase' }]}>
        {children}
      </Text>
      {action}
    </View>
  );
}

type ButtonKind = 'primary' | 'secondary' | 'danger' | 'ghost';

export function Button({
  title,
  onPress,
  kind = 'primary',
  icon,
  disabled,
  style,
  compact,
}: {
  title: string;
  onPress: () => void;
  kind?: ButtonKind;
  icon?: IconName;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
}) {
  const { colors } = useApp();
  const bg =
    kind === 'primary' ? colors.primary : kind === 'danger' ? colors.dangerSoft : kind === 'secondary' ? colors.surfaceAlt : 'transparent';
  const fg = kind === 'primary' ? colors.onPrimary : kind === 'danger' ? colors.danger : kind === 'secondary' ? colors.text : colors.primary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        compact && styles.buttonCompact,
        { backgroundColor: bg, opacity: disabled ? 0.45 : pressed ? 0.8 : 1 },
        style,
      ]}>
      {icon ? <Icon name={icon} size={compact ? 18 : 20} color={fg} /> : null}
      <Text style={[Type.h3, { color: fg, fontSize: compact ? 14 : 16 }]}>{title}</Text>
    </Pressable>
  );
}

export function IconButton({ icon, onPress, label, color }: { icon: IconName; onPress: () => void; label: string; color?: string }) {
  const { colors } = useApp();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [styles.iconButton, { backgroundColor: colors.primarySoft, opacity: pressed ? 0.7 : 1 }]}>
      <Icon name={icon} size={22} color={color ?? colors.primary} />
    </Pressable>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  color,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  color?: string;
}) {
  const { colors } = useApp();
  const accent = color ?? colors.primary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.chip,
        {
          borderColor: selected ? accent : colors.border,
          backgroundColor: selected ? accent : colors.surface,
        },
      ]}>
      <Text style={[Type.small, { color: selected ? (color ? '#fff' : colors.onPrimary) : colors.text, fontWeight: '600' }]}>{label}</Text>
    </Pressable>
  );
}

export function Field({ label, hint, ...props }: TextInputProps & { label: string; hint?: string }) {
  const { colors } = useApp();
  return (
    <View style={{ marginBottom: Spacing.md }}>
      <Text style={[Type.small, { color: colors.textSecondary, marginBottom: 6, fontWeight: '600' }]}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.textTertiary}
        {...props}
        style={[
          styles.input,
          { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceAlt },
          props.multiline && { minHeight: 80, textAlignVertical: 'top' },
          props.style,
        ]}
      />
      {hint ? <Text style={[Type.small, { color: colors.textTertiary, marginTop: 4 }]}>{hint}</Text> : null}
    </View>
  );
}

export function Label({ children }: { children: React.ReactNode }) {
  const { colors } = useApp();
  return <Text style={[Type.small, { color: colors.textSecondary, marginBottom: 6, fontWeight: '600' }]}>{children}</Text>;
}

/** Bottom sheet used for every add/edit form. */
export function Sheet({
  visible,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const { colors } = useApp();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <Pressable style={[styles.flex, { backgroundColor: colors.overlay }]} onPress={onClose} accessibilityLabel="Close" />
        <View style={[styles.sheet, { backgroundColor: colors.surface, paddingBottom: insets.bottom + Spacing.lg }]}>
          <View style={styles.sheetHeader}>
            <Text style={[Type.h2, { color: colors.text, flex: 1 }]}>{title}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} hitSlop={10}>
              <Icon name="close" color={colors.textSecondary} />
            </Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: Spacing.lg }}>
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function Empty({ icon, title, body, action }: { icon: IconName; title: string; body: string; action?: React.ReactNode }) {
  const { colors } = useApp();
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.primarySoft }]}>
        <Icon name={icon} size={30} color={colors.primary} />
      </View>
      <Text style={[Type.h3, { color: colors.text, textAlign: 'center' }]}>{title}</Text>
      <Text style={[Type.body, { color: colors.textSecondary, textAlign: 'center', marginTop: 4, marginBottom: Spacing.lg }]}>{body}</Text>
      {action}
    </View>
  );
}

export function ProgressBar({ value, color, track }: { value: number; color: string; track: string }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <View style={[styles.track, { backgroundColor: track }]}>
      <View style={[styles.fill, { width: `${pct}%`, backgroundColor: color }]} />
    </View>
  );
}

export function Stepper({
  value,
  onChange,
  min = 0,
  max = 999,
  step = 1,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label: string;
}) {
  const { colors } = useApp();
  const set = (v: number) => onChange(Math.max(min, Math.min(max, v)));
  return (
    <View style={[styles.stepper, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}>
      <Pressable accessibilityLabel={`Decrease ${label}`} onPress={() => set(value - step)} hitSlop={6} style={styles.stepBtn}>
        <Icon name="remove" color={colors.text} size={20} />
      </Pressable>
      <Text style={[Type.h3, { color: colors.text, minWidth: 44, textAlign: 'center' }]} accessibilityLabel={`${label} ${value}`}>
        {value}
      </Text>
      <Pressable accessibilityLabel={`Increase ${label}`} onPress={() => set(value + step)} hitSlop={6} style={styles.stepBtn}>
        <Icon name="add" color={colors.text} size={20} />
      </Pressable>
    </View>
  );
}

export function Row({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }, style]}>{children}</View>;
}

export function Wrap({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.md }}>{children}</View>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: Spacing.xl, paddingBottom: Spacing.lg, gap: Spacing.md },
  body: { paddingHorizontal: Spacing.xl },
  card: { borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth, padding: Spacing.lg, marginBottom: Spacing.md },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.lg, marginBottom: Spacing.sm },
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: Radius.md, paddingVertical: 14, paddingHorizontal: Spacing.lg },
  buttonCompact: { paddingVertical: 9, paddingHorizontal: Spacing.md },
  iconButton: { width: 42, height: 42, borderRadius: Radius.round, alignItems: 'center', justifyContent: 'center' },
  chip: { borderWidth: 1, borderRadius: Radius.round, paddingHorizontal: 14, paddingVertical: 8 },
  input: { borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 12, fontSize: 16 },
  sheet: { borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg, maxHeight: '88%' },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.lg },
  empty: { alignItems: 'center', paddingVertical: Spacing.xxl, paddingHorizontal: Spacing.lg },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md },
  track: { height: 8, borderRadius: Radius.round, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: Radius.round },
  stepper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: Radius.md, alignSelf: 'flex-start' },
  stepBtn: { padding: 10 },
});