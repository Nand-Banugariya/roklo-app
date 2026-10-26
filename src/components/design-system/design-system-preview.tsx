import { ArrowRight, Moon, Sun } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RokloWordmark } from '@/components/brand/roklo-wordmark';
import { CustomAlert } from '@/components/shadcn-custom/customalert';
import { CustomBackButton } from '@/components/shadcn-custom/custombackbutton';
import { CustomButton } from '@/components/shadcn-custom/custombutton';
import { CustomFormField } from '@/components/shadcn-custom/customformfield';
import { CustomInput } from '@/components/shadcn-custom/custominput';
import { CustomOTPInput } from '@/components/shadcn-custom/customotpinput';
import { CustomPhoneInput } from '@/components/shadcn-custom/customphoneinput';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { useRokloTheme } from '@/hooks/use-roklo-theme';
import { sanitizePhone } from '@/lib/auth/phone';
import { cn } from '@/lib/utils';

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <Card className="gap-5">
      <CardHeader><CardTitle>{title}</CardTitle>{description && <CardDescription>{description}</CardDescription>}</CardHeader>
      <CardContent className="gap-5">{children}</CardContent>
    </Card>
  );
}

export default function DesignSystemPreview() {
  const { mode, setColorScheme } = useRokloTheme();
  const [country, setCountry] = useState('in');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [checked, setChecked] = useState(false);
  const [showError, setShowError] = useState(false);
  const [loading, setLoading] = useState(false);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="items-center px-5 pb-28 pt-6 sm:px-8 web:pt-24">
          <View className="w-full max-w-xl gap-6">
            <View className="flex-row items-center justify-between gap-3">
              <RokloWordmark width={174} height={32} />
              <CustomButton variant="secondary" onPress={() => setColorScheme(mode === 'dark' ? 'light' : 'dark')}
                accessibilityLabel={`Switch to ${mode === 'dark' ? 'light' : 'dark'} theme`}
                leadingIcon={<Icon as={mode === 'dark' ? Sun : Moon} size={16} />}>
                {mode === 'dark' ? 'Light' : 'Dark'}
              </CustomButton>
            </View>

            <View className="gap-3 py-3">
              <Badge variant="secondary" className="self-start border-brand-200 bg-brand-50"><Text className="text-brand-800">Roklo design system</Text></Badge>
              <Text className="font-display text-[40px] leading-[44px] tracking-[-0.8px]">Made for better{'\n'}<Text className="font-display-italic text-[40px] leading-[44px] text-brand-700">conversations.</Text></Text>
              <Text className="text-[15px] leading-[23px] text-ink-700">The same colors, type, and controls as Roklo on the web, ready for your phone.</Text>
            </View>

            <Section title="Typography" description="Geist for the interface. Newsreader for the moments that matter.">
              <Text className="font-display text-[32px] leading-10">Welcome to Roklo</Text>
              <Text className="font-sans-semibold text-lg">Your team. One conversation.</Text>
              <Text className="text-sm leading-[22px] text-ink-700">A shared inbox that brings every customer conversation closer.</Text>
              <Text className="font-mono text-xs text-ink-600">Geist Mono · 0123456789</Text>
            </Section>

            <Section title="Colors" description="Roklo green, warm ink neutrals, and clear status colors.">
              <View className="flex-row gap-2">
                {['bg-brand-50', 'bg-brand-200', 'bg-brand-400', 'bg-brand-600', 'bg-brand-800'].map((color) => <View key={color} className={cn('h-12 flex-1 rounded-md', color)} />)}
              </View>
              <View className="flex-row gap-2">
                {['bg-ink-50', 'bg-ink-200', 'bg-ink-400', 'bg-ink-600', 'bg-ink-900'].map((color) => <View key={color} className={cn('h-9 flex-1 rounded-md', color)} />)}
              </View>
            </Section>

            <Section title="Buttons" description="Shared variants, 48px sign-in actions, and loading states.">
              <CustomButton size="xl" fullWidth trailingIcon={<Icon as={ArrowRight} size={16} />} onPress={() => setLoading(!loading)}>Continue</CustomButton>
              <View className="flex-row flex-wrap gap-2">
                <CustomButton variant="secondary">Secondary</CustomButton>
                <CustomButton variant="outline">Outline</CustomButton>
                <CustomButton variant="soft">Soft</CustomButton>
                <CustomButton variant="ghost">Ghost</CustomButton>
                <CustomButton variant="destructive">Remove</CustomButton>
                <CustomButton variant="destructive-solid">Delete</CustomButton>
              </View>
              <CustomButton loading={loading} loadingText="Sending code" size="xl" fullWidth onPress={() => setLoading(true)}>Send code</CustomButton>
              {loading && <CustomButton variant="link" onPress={() => setLoading(false)}>Reset loading preview</CustomButton>}
              <CustomButton disabled size="xl" fullWidth>Disabled action</CustomButton>
              <CustomBackButton>Use a different number</CustomBackButton>
            </Section>

            <Section title="Sign-in fields" description="Country selection, phone and email inputs, and a six-digit code.">
              <CustomFormField id="preview-phone" label="Mobile number" required size="lg"
                help="We’ll text you a 6-digit code. No password needed." error={showError ? 'Enter a valid mobile number.' : null}>
                {(control) => <CustomPhoneInput {...control} variant="auth" country={country}
                  onCountryChange={(next) => { setCountry(next); setPhone(sanitizePhone(phone, next)); }}
                  value={phone} onValueChange={(raw) => setPhone(sanitizePhone(raw, country))}
                  placeholder="98765 43210" invalid={showError} />}
              </CustomFormField>
              <CustomFormField id="preview-email" label="Email" size="lg" optional>
                {(control) => <CustomInput {...control} size="xl" keyboardType="email-address" autoComplete="email"
                  autoCapitalize="none" placeholder="you@business.com" value={email} onChangeText={setEmail} />}
              </CustomFormField>
              <CustomFormField id="preview-otp" label="Verification code" size="lg" required error={showError ? 'That code didn’t match. Try again.' : null}>
                {(control) => <CustomOTPInput {...control} value={otp} onValueChange={setOtp} invalid={showError} />}
              </CustomFormField>
              <CustomButton variant="link" onPress={() => setShowError(!showError)}>{showError ? 'Hide validation errors' : 'Preview validation errors'}</CustomButton>
            </Section>

            <Section title="Feedback">
              <CustomAlert tone="info" title="Stay in sync">Your team’s conversations, all in one place.</CustomAlert>
              <CustomAlert tone="success" title="You’re all set">Your changes have been saved.</CustomAlert>
              <CustomAlert tone="warning" title="Try again shortly">Please wait before requesting another code.</CustomAlert>
              <CustomAlert tone="error" title="Something went wrong">Check your connection and try again.</CustomAlert>
            </Section>

            <Section title="More shared controls">
              <View className="flex-row items-center gap-3">
                <Checkbox checked={checked} onCheckedChange={setChecked} nativeID="preview-checkbox" accessibilityLabel="Keep me signed in" />
                <Label onPress={() => setChecked(!checked)}>Keep me signed in</Label>
              </View>
              <Textarea accessibilityLabel="Message" placeholder="Write a message…" />
              <Separator />
              <Dialog>
                <DialogTrigger asChild><CustomButton variant="outline" size="xl">Open dialog</CustomButton></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>A little more room</DialogTitle><DialogDescription>Dialogs share Roklo’s colors, fonts, and rounded corners.</DialogDescription></DialogHeader>
                  <Text className="text-sm leading-6 text-ink-700">This is a component preview. Close it to return to the design system.</Text>
                </DialogContent>
              </Dialog>
            </Section>
            <Text className="pb-4 text-center text-xs text-ink-600">Roklo · Shared components for Android, iOS, and web</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
