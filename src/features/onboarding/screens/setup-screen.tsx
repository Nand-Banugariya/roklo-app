import { Redirect, router, useFocusEffect } from "expo-router";
import { ArrowRight } from "lucide-react-native";
import { useCallback, useEffect } from "react";
import { BackHandler, Keyboard, View } from "react-native";

import { CustomAlert } from "@/components/shadcn-custom/customalert";
import { CustomBackButton } from "@/components/shadcn-custom/custombackbutton";
import { CustomButton } from "@/components/shadcn-custom/custombutton";
import { CustomIcon } from "@/components/shadcn-custom/customicon";
import { CustomSpinner } from "@/components/shadcn-custom/customspinner";
import { CustomText } from "@/components/shadcn-custom/customtext";
import { useAuthSession } from "@/features/auth/providers/session-provider";
import { useAppDispatch, useAppSelector } from "@/store/hooks";

import { SetupLayout } from "../components/setup-layout";
import { SetupComplete, SetupSubmitting } from "../components/setup-finale";
import { AboutYouStep } from "../components/steps/about-you-step";
import { BusinessStep } from "../components/steps/business-step";
import { SourceStep } from "../components/steps/source-step";
import { UsageStep } from "../components/steps/usage-step";
import { WorkspaceStep } from "../components/steps/workspace-step";
import { STEP_LABELS } from "../constants";
import { useOnboarding } from "../hooks/use-onboarding";
import { useWorkspaceLogo } from "../hooks/use-workspace-logo";
import { onboardingActions } from "../store/onboarding-slice";
import { loadOnboarding } from "../store/onboarding-thunks";

export default function SetupScreen() {
  const userId = useAppSelector((state) => state.auth.user?.id);
  return userId ? <SetupFlow key={userId} /> : <Redirect href="/login" />;
}

function SetupFlow() {
  const dispatch = useAppDispatch();
  const flow = useOnboarding();
  const upload = useWorkspaceLogo();
  const { signOut } = useAuthSession();
  const index = Math.max(0, flow.steps.indexOf(flow.stepId));
  const emailBusy = ["sending", "verifying"].includes(flow.email.status);
  const busy = flow.status === "submitting" || upload.busy || emailBusy;
  const canSkip = ["business", "usage"].includes(flow.stepId);

  useEffect(() => {
    void dispatch(loadOnboarding());
  }, [dispatch]);
  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
        if (busy || flow.status === "completed") return true;
        if (flow.status !== "ready" || index === 0) return false;
        Keyboard.dismiss();
        dispatch(onboardingActions.previousStep());
        return true;
      });
      return () => subscription.remove();
    }, [busy, dispatch, flow.status, index]),
  );

  function advance() {
    if (busy || !flow.canContinue) return;
    Keyboard.dismiss();
    if (flow.isLastStep) void flow.submit({ logo: upload.logo });
    else flow.next();
  }
  function skip() {
    if (busy || !canSkip) return;
    Keyboard.dismiss();
    flow.skip();
  }
  function openInbox() {
    dispatch(onboardingActions.completionDismissed());
    router.replace("/inbox");
  }

  if (flow.status === "submitting")
    return <SetupSubmitting includeWorkspace={flow.includeWorkspace} />;
  if (flow.status === "completed") {
    if (flow.completion !== "created") return <Redirect href="/inbox" />;
    return (
      <SetupComplete
        answers={flow.answers}
        includeWorkspace={flow.includeWorkspace}
        preview={upload.preview}
        onOpenInbox={openInbox}
      />
    );
  }
  if (flow.status === "idle" || flow.status === "loading" || flow.status === "error") {
    return (
      <SetupLayout onSignOut={() => void signOut()}>
        <View className="flex-1 items-center justify-center gap-6 py-12">
          {flow.status === "error" ? (
            <>
              <CustomAlert tone="error" title="Couldn't load setup">
                {flow.error}
              </CustomAlert>
              <CustomButton
                fullWidth
                size="xl"
                onPress={() => void dispatch(loadOnboarding({ force: true }))}
              >
                Try again
              </CustomButton>
            </>
          ) : (
            <>
              <CustomSpinner size="large" accessibilityLabel="Loading your workspace setup" />
              <CustomText className="text-sm text-ink-600">Getting your setup ready…</CustomText>
            </>
          )}
        </View>
      </SetupLayout>
    );
  }

  const optional = ["business", "usage", "source"].includes(flow.stepId);
  return (
    <SetupLayout
      key={flow.stepId}
      current={index}
      steps={flow.steps.map((id) => STEP_LABELS[id])}
      onSignOut={busy ? undefined : () => void signOut()}
      footer={
        <View className="gap-3">
          {flow.error && <CustomAlert tone="error">{flow.error}</CustomAlert>}
          <CustomButton
            size="xl"
            fullWidth
            disabled={!flow.canContinue || busy}
            onPress={advance}
            trailingIcon={
              <CustomIcon as={ArrowRight} size={18} className="text-primary-foreground" />
            }
          >
            {flow.isLastStep ? "Finish setup" : "Continue"}
          </CustomButton>
          <CustomText className="text-center text-xs leading-5 text-ink-600">
            {optional
              ? "This step is optional. You can change these details later."
              : "Your progress is saved as you go."}
          </CustomText>
        </View>
      }
    >
      {(index > 0 || canSkip) && (
        <View className="-mb-3 flex-row items-center justify-between">
          {index > 0 ? (
            <CustomBackButton
              disabled={busy}
              onPress={() => {
                Keyboard.dismiss();
                flow.back();
              }}
            />
          ) : (
            <View />
          )}
          {canSkip && (
            <CustomButton
              variant="ghost"
              size="sm"
              className="min-h-11"
              disabled={busy}
              onPress={skip}
            >
              Skip
            </CustomButton>
          )}
        </View>
      )}
      {flow.stepId === "workspace" && (
        <WorkspaceStep
          name={flow.answers.workspaceName}
          onChange={(workspaceName) => flow.updateAnswers({ workspaceName })}
          upload={upload}
          onContinue={advance}
        />
      )}
      {flow.stepId === "you" && <AboutYouStep flow={flow} />}
      {flow.stepId === "business" && <BusinessStep flow={flow} />}
      {flow.stepId === "usage" && <UsageStep flow={flow} />}
      {flow.stepId === "source" && <SourceStep flow={flow} />}
    </SetupLayout>
  );
}
